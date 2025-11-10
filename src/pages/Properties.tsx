// src/pages/Properties.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyMap } from "@/components/PropertyMap";
import { PropertiesListSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { listingsAPI, Listing } from "@/lib/api";
import {
  Filter,
  Home,
  ChevronDown,
  ChevronUp,
  MapIcon,
  Grid3X3,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Target,
  Train, // <-- ADDED
  MapPin, // <-- ADDED
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PriceRange from "@/components/ui/PriceRange";
import { supabase } from "@/lib/supabase";

interface Filters {
  minPrice: string;
  maxPrice: string;
  beds: string[];  // Changed to array for multiselect
  baths: string[]; // Changed to array for multiselect
  intlFriendly: boolean;
  availableOnly: boolean; // New filter for available properties only
  campus: string | null; // Selected campus for filtering
}

type SortOption = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'name-a' | 'name-z';
type Range = [number, number];

type Stats = {
  unitsCount: number;
  minRent: number | null;
  maxRent: number | null;
  minBeds: number | null;
  maxBeds: number | null;
  minBaths: number | null;
  maxBaths: number | null;
};
function parseJSONField(field: any): any {
  if (!field) return null;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return null;
  }
}
function lightMapPropertyToListing(property: any) {
  const photosArray = parseJSONField(property?.photos) || [];
  const amenitiesData = parseJSONField(property?.amenities) || {};
  return {
    id: property?.id,
    title: property?.name || 'Apartment Complex',
    price: 0,
    address: property?.address || '',
    beds: 0,
    baths: 0,
    intlFriendly: Boolean(property?.intl_friendly),
    imageUrl: property?.thumbnail_url || (photosArray.length > 0 ? photosArray[0] : null),
    photos: photosArray,
    description: property?.description || `Apartment complex in ${property?.city || ''}${property?.state ? ', ' + property.state : ''}`,
    amenities: Array.isArray(amenitiesData) ? amenitiesData : Object.keys(amenitiesData),
    contactEmail: property?.email || undefined,
    contactPhone: property?.phone_number || undefined,
    createdAt: property?.created_at,
    updatedAt: property?.updated_at,
    latitude: property?.latitude ?? null,
    longitude: property?.longitude ?? null,
    city: property?.city || '',
    state: property?.state || '',
    _units: [],
    _availableUnits: [],
    _priceRange: { min: 0, max: 0 },
    _unitCount: 0,
    _availableUnitCount: 0,
  } as any;
}
// --- Helper: fetch apartment_units in chunks to avoid huge IN() queries ---
async function fetchUnitsForProperties(ids: string[]) {
  const CHUNK_SIZE = 150; // tune as needed
  const all: any[] = [];

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const slice = ids.slice(i, i + CHUNK_SIZE);

    const { data, error } = await supabase
      .from("apartment_units")
      .select("property_id, rent_min, rent_max, beds, baths, availability_status")
      .in("property_id", slice);

    if (error) throw error;
    if (data) all.push(...data);
  }

  return all;
}

export default function Properties() {
  const navigate = useNavigate();
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [selectedProperty, setSelectedProperty] = useState<Listing | null>(null);

  // --- ADDED STATE ---
  const [showTransit, setShowTransit] = useState(false);
  const [showAttractions, setShowAttractions] = useState(false);
  // -------------------

  const [bounds, setBounds] = useState<Range | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [autoRetried, setAutoRetried] = useState(false);
  const hydratedRef = useRef(false);
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const saved = localStorage.getItem("props.filters");
      if (saved) return JSON.parse(saved);
    } catch { }
    return {
      minPrice: "",
      maxPrice: "",
      beds: [],
      baths: [],
      intlFriendly: false,
      availableOnly: false,
      campus: null,
    } as Filters;
  });

  // Campus definitions matching backend
  const campuses = [
    {
      id: "arlington",
      name: "VT Research Center – Arlington",
      lat: 38.8869,
      lng: -77.1022,
      radius: 3219, // 2 miles in meters
    },
    {
      id: "alexandria",
      name: "Washington–Alexandria Architecture Center",
      lat: 38.8051,
      lng: -77.0470,
      radius: 3219, // 2 miles
    },
    {
      id: "academic",
      name: "Academic Building One (Northern VA)",
      lat: 38.8539,
      lng: -77.0503,
      radius: 3219, // 2 miles
    },
  ];

  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem("props.sortBy");
    return (saved as SortOption) || 'newest';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Persist filters and sort so they survive navigation/back
  useEffect(() => {
    try { localStorage.setItem("props.filters", JSON.stringify(filters)); } catch { }
  }, [filters]);
  useEffect(() => {
    try { localStorage.setItem("props.sortBy", sortBy); } catch { }
  }, [sortBy]);

  // Hydrate from cache immediately so Back is instant
  useEffect(() => {
    if (hydratedRef.current) return;
    try {
      const cached = localStorage.getItem('props.all');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const looksMapped = typeof parsed[0]?.title === 'string';
          const hydrated = looksMapped ? parsed : parsed.map(lightMapPropertyToListing);
          setAllListings(hydrated);
          console.log('Properties: Hydrated from cache:', hydrated.length);
        }
      }
    } catch { }
    hydratedRef.current = true;
  }, []);

  // ---- 1) Fetch listings directly from Supabase (frontend) ----
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch properties directly from Supabase
        const PAGE = 800; // slightly smaller pages to avoid resource spikes
        let from = 0;
        let properties: any[] = [];
        while (true) {
          let data: any[] | null = null; let error: any = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            const res = await supabase
              .from('apartment_properties_listings')
              .select('id,name,address,city,state,zip_code,thumbnail_url,photos,amenities,description,email,phone_number,created_at,updated_at,latitude,longitude,is_active')
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .range(from, from + PAGE - 1);
            data = res.data as any[] | null; error = res.error;
            if (!error) break; // success
            const delay = 200 * Math.pow(2, attempt); // 200..3200ms
            await new Promise(r => setTimeout(r, delay));
          }
          if (error) throw error;
          if (!data || data.length === 0) break;
          properties.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
          // small pacing delay to reduce pressure on the browser/network
          await new Promise(r => setTimeout(r, 150));
        }

        if (properties.length === 0) {
          setAllListings([]);
          setBounds([0, 5000]);
          return;
        }

        console.log("Properties: Loaded from Supabase:", properties.length, "properties");
        // We will cache the mapped listings (not raw properties) so hydration has correct shape

        // Get property IDs
        const propertyIds = properties.map(p => p.id);

        // Fetch units for all properties
        const units = await fetchUnitsForProperties(propertyIds);

        // Group units by property
        const unitsByProperty = new Map();
        (units || []).forEach(unit => {
          if (!unitsByProperty.has(unit.property_id)) {
            unitsByProperty.set(unit.property_id, []);
          }
          unitsByProperty.get(unit.property_id).push(unit);
        });


        // Build listings with unit data
        const listings = properties.map(property => {
          const propertyUnits = unitsByProperty.get(property.id) || [];

          //image and ammenities
          const photosArray = parseJSONField(property.photos) || [];
          const amenitiesData = parseJSONField(property.amenities) || {};

          // Calculate price range
          const prices = propertyUnits.map((u: any) => [u.rent_min, u.rent_max]).flat().filter((p: any) => p > 0);
          const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
          const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

          // Calculate beds/baths range
          const beds = propertyUnits.map((u: any) => u.beds).filter((b: any) => b > 0);
          const baths = propertyUnits.map((u: any) => u.baths).filter((b: any) => b > 0);
          const maxBeds = beds.length > 0 ? Math.max(...beds) : 0;
          const maxBaths = baths.length > 0 ? Math.max(...baths) : 0;

          // Count available units
          const availableUnits = propertyUnits.filter((u: any) => {
            const s = String(u.availability_status ?? '').toLowerCase().trim();
            return s.includes('available') || s === 'vacant' || s === 'ready';
          });

          // Simulate random VT resident count for demo purposes
          const showBadge = Math.random() < 0.35; // ~35% of listings show badge
          const vtResidentCount = showBadge ? Math.floor(Math.random() * 5) + 1 : 0; 

          return {
            id: property.id,
            title: property.name || 'Apartment Complex',
            price: minPrice,
            address: property.address || '',
            beds: maxBeds,
            baths: maxBaths,
            intlFriendly: Boolean((property as any).intl_friendly ?? (property as any).international_friendly ?? (property as any).intl ?? false),
            imageUrl: property.thumbnail_url || (photosArray.length > 0 ? photosArray[0] : null),
            photos: photosArray,
            description: property.description || `Apartment complex in ${property.city}, ${property.state}`,
            amenities: Array.isArray(amenitiesData) ? amenitiesData : Object.keys(amenitiesData),
            contactEmail: property.email || undefined,
            contactPhone: property.phone_number || undefined,
            createdAt: property.created_at,
            updatedAt: property.updated_at,
            latitude: property.latitude || null,
            longitude: property.longitude || null,
            city: property.city || '',
            state: property.state || '',
            _units: propertyUnits,
            _availableUnits: availableUnits,
            _priceRange: { min: minPrice, max: maxPrice },
            _unitCount: propertyUnits.length,
            _availableUnitCount: availableUnits.length,
            vtResidentCount,
          };
        });

        console.log("✅ Sample listing:", listings[0]);
        console.log("👀 vtResidentCount sample:", listings[0]?.vtResidentCount);

        setAllListings(listings);
        try { localStorage.setItem('props.all', JSON.stringify(listings)); } catch { }

        // Set price bounds
        let globalMin = Infinity, globalMax = -Infinity;
        listings.forEach((l: any) => {
          if (l._priceRange?.min != null && l._priceRange.min >= 0) {
            globalMin = Math.min(globalMin, l._priceRange.min);
          }
          if (l._priceRange?.max != null && l._priceRange.max >= 0) {
            globalMax = Math.max(globalMax, l._priceRange.max);
          }
        });

        if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) {
          globalMin = 0;
          globalMax = 10000;
        }

        setBounds([globalMin, globalMax]);

      } catch (e: any) {
        console.error("Error fetching properties:", e);
        setError(e?.message || "Failed to fetch properties from Supabase");
        // One-time auto-retry after a short delay (helps when navigating back)
        const msg: string = (e?.message || '').toString();
        const resourceStarved = msg.includes('INSUFFICIENT_RESOURCES') || msg.includes('Failed to fetch');
        if (!autoRetried && resourceStarved) {
          setAutoRetried(true);
          setTimeout(() => setRetryTick((t) => t + 1), 1500);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [retryTick]);

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  };

  // ---- 3) Local filtering (slider & selects) — NO extra backend calls ----
  const filtered = useMemo(() => {
    console.log("Properties: Filtering with filters:", filters);
    console.log("Properties: Total listings:", allListings.length);
    console.log("Properties: Sorting by:", sortBy);

    // Only apply price bounds if user has set price filters
    const min = filters.minPrice ? parseInt(filters.minPrice) : 0;
    const max = filters.maxPrice ? parseInt(filters.maxPrice) : 999999;

    // Apply filters
    let result = allListings.filter((l: any) => {
      // Use backend data directly
      const priceRange = l._priceRange || { min: l.price || 0, max: l.price || 0 };

      // price overlap - use backend price range
      const priceOk = (filters.minPrice === "" && filters.maxPrice === "") ||
        (priceRange.min <= max && priceRange.max >= min);

      // beds/baths - FIXED LOGIC
      const bedsOk =
        filters.beds.length === 0 || // No selection = show all
        (filters.beds.includes("4") && l.beds >= 4) || // 4+ includes 4 and above
        filters.beds.some(bed => bed !== "4" && l.beds === parseInt(bed)); // Exact matches for 1,2,3

      const bathsOk =
        filters.baths.length === 0 || // No selection = show all
        (filters.baths.includes("3") && l.baths >= 3) || // 3+ includes 3 and above
        filters.baths.some(bath => bath !== "3" && l.baths === parseInt(bath)); // Exact matches for 1,2

      // intl flag
      const intlOk = !filters.intlFriendly || Boolean(l.intlFriendly);

      // availability filter
      const availabilityOk = !filters.availableOnly || (l._availableUnitCount && l._availableUnitCount > 0);

      // campus filter
      let campusOk = true;
      if (filters.campus) {
        const selectedCampus = campuses.find(c => c.id === filters.campus);
        if (selectedCampus && l.latitude && l.longitude) {
          const distance = calculateDistance(selectedCampus.lat, selectedCampus.lng, l.latitude, l.longitude);
          campusOk = distance <= selectedCampus.radius;
        } else {
          campusOk = false;
        }
      }

      return priceOk && bedsOk && bathsOk && intlOk && availabilityOk && campusOk;
    });

    console.log("Properties: After filtering:", result.length);

    // ALWAYS APPLY SORTING
    result.sort((a, b) => {
      // Sort results to put selected property first
      if (selectedProperty) {
        if (a.id === selectedProperty.id) return -1;
        if (b.id === selectedProperty.id) return 1;
      }

      // Apply the selected sort option
      switch (sortBy) {
        case 'newest':
          return new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime();
        case 'oldest':
          return new Date((a as any).createdAt).getTime() - new Date((b as any).createdAt).getTime();
        case 'price-low':
          const priceA = (a as any)._priceRange?.min || (a as any).price || 0;
          const priceB = (b as any)._priceRange?.min || (b as any).price || 0;
          if (priceA === 0 && priceB === 0) return 0;
          if (priceA === 0) return 1;
          if (priceB === 0) return -1;
          return priceA - priceB;
        case 'price-high':
          const priceAHigh = (a as any)._priceRange?.min || (a as any).price || 0;
          const priceBHigh = (b as any)._priceRange?.min || (b as any).price || 0;
          if (priceAHigh === 0 && priceBHigh === 0) return 0;
          if (priceAHigh === 0) return 1;
          if (priceBHigh === 0) return -1;
          return priceBHigh - priceAHigh;
        case 'name-a':
          return a.title.localeCompare(b.title);
        case 'name-z':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    console.log("Properties: After sort, first 3:", result.slice(0, 3).map(r => String(r?.title ?? '').substring(0, 30)));
    return result;
  }, [allListings, filters, bounds, selectedProperty, sortBy]);

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedListings = filtered.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      minPrice: "",
      maxPrice: "",
      beds: [],
      baths: [],
      intlFriendly: false,
      availableOnly: false,
      campus: null
    });
  };

  const activeFilterCount = useMemo(
    () => {
      let count = 0;
      if (filters.minPrice !== "") count++;
      if (filters.maxPrice !== "") count++;
      if (filters.beds.length > 0) count++;
      if (filters.baths.length > 0) count++;
      if (filters.intlFriendly) count++;
      if (filters.availableOnly) count++;
      if (filters.campus) count++;
      return count;
    },
    [filters]
  );

  if (loading && !allListings.length) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Properties</h1>
            <p className="text-muted">Find your perfect housing near Virginia Tech</p>
          </div>
          <PropertiesListSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <ErrorState
            title="Failed to load properties"
            description={`${error}. Make sure the backend server is running on port 4000.`}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  const currentMin = filters.minPrice ? parseInt(filters.minPrice) : bounds?.[0] ?? 0;
  const currentMax = filters.maxPrice ? parseInt(filters.maxPrice) : bounds?.[1] ?? 5000;

  const priceLabel = (min: number | null, max: number | null) => {
    if (min == null) return "Call for pricing";
    if (max == null || max === min) return `$${Math.round(min).toLocaleString()}/mo`;
    return `$${Math.round(min).toLocaleString()}–$${Math.round(max).toLocaleString()}/mo`;
  };

  const handleSortChange = (value: string) => {
    console.log("🔄 Sort changed to:", value);
    setSortBy(value as SortOption);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 relative z-[250]">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold text-foreground">Properties</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/roommate-matching')}
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Find Roommates
              </Button>
            </div>
            <p className="text-muted">
              {filtered.length} {filtered.length === 1 ? "property" : "properties"} total
              {allListings.length > 0 && (
                <span className="ml-2 text-sm">
                  ({allListings.filter((l: any) => l._availableUnitCount > 0).length} with available units)
                </span>
              )}
              {filtered.length > 0 && (
                <span className="ml-2 text-sm">
                  • {filtered.filter((l: any) => l.distanceFromCampus).length} with distance info
                </span>
              )}
              {totalPages > 1 && (
                <span className="ml-2 text-sm">
                  • Page {currentPage} of {totalPages}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-4 md:mt-0">
            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted" />
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="name-a">Name: A to Z</SelectItem>
                  <SelectItem value="name-z">Name: Z to A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-surface-3 rounded-lg p-1">
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")} className="h-8">
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "map" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("map")} className="h-8">
                <MapIcon className="h-4 w-4" />
              </Button>
            </div>

            <Badge variant="muted">
              {filtered.filter((l: any) => l.intlFriendly).length} International Friendly
            </Badge>
          </div>
        </div>

        {/* Roommate Questionnaire Call-to-Action */}
        <Card className="mb-6 border border-accent/40 bg-gradient-to-r from-accent/15 via-accent/5 to-transparent dark:border-accent/30 dark:bg-surface-2/80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/20 dark:bg-accent/25">
                  <Target className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Create Your Roommate Profile</h3>
                  <p className="text-sm text-muted-foreground">
                    Answer a few questions to create your roommate profile and find better matches
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/roommate-questionnaire')}
                variant="accent"
                className="gap-2"
              >
                Start Questionnaire
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="lg:w-80">
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <Card className="bg-surface border-surface-3 sticky top-4 z-[200]">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full justify-between p-0 h-auto">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Filter className="h-5 w-5" />
                        Filters
                        {activeFilterCount > 0 && <Badge variant="accent" className="ml-2 text-xs">{activeFilterCount}</Badge>}
                      </CardTitle>
                      {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="space-y-6">
                    {/* Price Range */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Price Range</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <PriceRange
                            value={[currentMin, currentMax]}
                            onChange={([min, max]) => {
                              handleFilterChange("minPrice", String(min));
                              handleFilterChange("maxPrice", String(max));
                            }}
                            min={bounds?.[0] ?? 0}
                            max={bounds?.[1] ?? 5000}
                            step={50}
                          />
                        </div>
                        <div>
                          <Label htmlFor="minPrice" className="text-xs text-muted">Min</Label>
                          <Input
                            id="minPrice"
                            type="number"
                            placeholder={`$${bounds?.[0] ?? 0}`}
                            value={filters.minPrice}
                            onChange={(e) => handleFilterChange("minPrice", e.target.value)}
                            className="bg-surface-2 border-surface-3"
                          />
                        </div>
                        <div>
                          <Label htmlFor="maxPrice" className="text-xs text-muted">Max</Label>
                          <Input
                            id="maxPrice"
                            type="number"
                            placeholder={`$${bounds?.[1] ?? 5000}`}
                            value={filters.maxPrice}
                            onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
                            className="bg-surface-2 border-surface-3"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Campus Filter */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Filter by Campus</Label>
                      <Select
                        value={filters.campus || "all"}
                        onValueChange={(value) => handleFilterChange("campus", value === "all" ? null : value)}
                      >
                        <SelectTrigger className="bg-surface-2 border-surface-3">
                          <SelectValue placeholder="All Campuses" />
                        </SelectTrigger>
                        <SelectContent className="z-[999]">
                          <SelectItem value="all">All Campuses</SelectItem>
                          {campuses.map((campus) => (
                            <SelectItem key={campus.id} value={campus.id}>
                              {campus.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {filters.campus && (
                        <p className="text-xs text-muted">
                          Showing properties within ~{Math.round(campuses.find(c => c.id === filters.campus)!.radius / 1609 * 10) / 10} miles
                        </p>
                      )}
                    </div>

                    {/* Bedrooms */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Bedrooms</Label>
                      <div className="space-y-2">
                        {[
                          { value: "1", label: "1 bedroom" },
                          { value: "2", label: "2 bedrooms" },
                          { value: "3", label: "3 bedrooms" },
                          { value: "4", label: "4+ bedrooms" }
                        ].map((option) => (
                          <div key={option.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`beds-${option.value}`}
                              checked={filters.beds.includes(option.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFilters(prev => ({
                                    ...prev,
                                    beds: [...prev.beds, option.value]
                                  }));
                                } else {
                                  setFilters(prev => ({
                                    ...prev,
                                    beds: prev.beds.filter(bed => bed !== option.value)
                                  }));
                                }
                              }}
                            />
                            <Label htmlFor={`beds-${option.value}`} className="text-sm">
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bathrooms */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Bathrooms</Label>
                      <div className="space-y-2">
                        {[
                          { value: "1", label: "1 bathroom" },
                          { value: "2", label: "2 bathrooms" },
                          { value: "3", label: "3+ bathrooms" }
                        ].map((option) => (
                          <div key={option.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`baths-${option.value}`}
                              checked={filters.baths.includes(option.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFilters(prev => ({
                                    ...prev,
                                    baths: [...prev.baths, option.value]
                                  }));
                                } else {
                                  setFilters(prev => ({
                                    ...prev,
                                    baths: prev.baths.filter(bath => bath !== option.value)
                                  }));
                                }
                              }}
                            />
                            <Label htmlFor={`baths-${option.value}`} className="text-sm">
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* International Friendly */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="intlFriendly"
                        checked={filters.intlFriendly}
                        onCheckedChange={(checked) => handleFilterChange("intlFriendly", Boolean(checked))}
                      />
                      <Label htmlFor="intlFriendly" className="text-sm font-medium">International Student Friendly</Label>
                    </div>

                    {/* Available Properties Only */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="availableOnly"
                        checked={filters.availableOnly}
                        onCheckedChange={(checked) => handleFilterChange("availableOnly", Boolean(checked))}
                      />
                      <Label htmlFor="availableOnly" className="text-sm font-medium">Available Properties Only</Label>
                    </div>

                    {activeFilterCount > 0 && (
                      <div className="pt-4 border-t border-surface-3">
                        <Button onClick={clearFilters} variant="outline" className="w-full">Clear All Filters</Button>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Home className="h-12 w-12" />}
                title="No properties found"
                description="Try adjusting your filters or check back later for new listings."
                action={{ label: "Clear Filters", onClick: clearFilters }}
              />
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {paginatedListings.map((listing: any, index: number) => (
                  <div key={listing.id} className="relative">
                    {/* DEBUG: Visual indicator */}
                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded z-20 font-mono">
                      #{index + 1}: {String(listing?.title ?? '').substring(0, 20)}... ${listing?.price ?? 0}
                    </div>

                    <PropertyCard
                      listing={{
                        ...listing,
                      } as any}
                      className={selectedProperty?.id === listing.id ? "ring-2 ring-accent" : ""}
                    />
                  </div>
                ))}
              </div>
            ) : (
              // --- MAP VIEW ---
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[800px]">
                {/* --- MODIFIED SECTION --- */}
                <div className="lg:col-span-2 relative"> {/* Added relative positioning */}
                  <PropertyMap
                    properties={filtered as any}
                    selectedProperty={selectedProperty as any}
                    onPropertySelect={setSelectedProperty as any}
                    className="h-full"
                    filters={{
                      min_rent: filters.minPrice ? parseInt(filters.minPrice) : undefined,
                      max_rent: filters.maxPrice ? parseInt(filters.maxPrice) : undefined,
                      beds: filters.beds.length > 0 ? parseInt(filters.beds[0]) : undefined,
                      city: undefined,
                      property_type: undefined,
                      campus: filters.campus
                    }}
                    selectedCampus={filters.campus}
                    showTransit={showTransit} // <-- ADDED: Pass showTransit
                    showAttractions={showAttractions} // <-- ADDED: Pass showAttractions
                  />
                  {/* --- ADDED: Transit/Attractions Buttons Overlay --- */}
                  <div className="absolute top-4 right-4 z-[401] flex flex-col sm:flex-row gap-2">
                    <Button
                      variant={showTransit ? "default" : "outline"}
                      onClick={() => setShowTransit(!showTransit)}
                      className={`shadow-lg ${showTransit ? "" : "bg-surface/95 hover:bg-surface-2 text-foreground"}`}
                    >
                      <Train className="h-4 w-4 mr-2" />
                      Transit
                    </Button>
                    <Button
                      variant={showAttractions ? "default" : "outline"}
                      onClick={() => setShowAttractions(!showAttractions)}
                      className={`shadow-lg ${showAttractions ? "" : "bg-surface/95 hover:bg-surface-2 text-foreground"}`}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Attractions
                    </Button>
                  </div>
                  {/* --- END OF MODIFIED SECTION --- */}
                </div>
                <div className="space-y-4 overflow-y-auto">
                  <h3 className="font-semibold text-lg">Properties ({filtered.length})</h3>
                  {paginatedListings.map((listing: any, index: number) => (
                    <div key={listing.id} className="relative">
                      {selectedProperty?.id === listing.id && (
                        <Badge className="absolute -top-2 -right-2 z-10 bg-accent text-white">
                          Selected
                        </Badge>
                      )}
                      <PropertyCard
                        listing={listing as any}
                        className={`cursor-pointer transition-all ${selectedProperty?.id === listing.id ? "ring-2 ring-accent shadow-lg" : "hover:shadow-md"
                          }`}
                        onClick={() => setSelectedProperty(listing as any)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filtered.length)} of {filtered.length} properties
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    <div className="flex items-center space-x-1">
                      {/* First page */}
                      {totalPages > 5 && currentPage > 3 && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            className="w-8 h-8 p-0"
                          >
                            1
                          </Button>
                          {currentPage > 4 && <span className="text-muted-foreground px-1">...</span>}
                        </>
                      )}

                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}

                      {/* Last page */}
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          {currentPage < totalPages - 3 && <span className="text-muted-foreground px-1">...</span>}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-8 h-8 p-0"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}