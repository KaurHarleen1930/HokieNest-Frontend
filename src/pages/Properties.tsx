import { useState, useEffect, useMemo } from "react";
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
import { Filter, Home, ChevronDown, ChevronUp, MapIcon, Grid3X3, ArrowUpDown, ChevronLeft, ChevronRight, Target } from "lucide-react";
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

// --- Helper: fetch apartment_units in chunks to avoid huge IN() queries ---
async function fetchUnitsForProperties(ids: string[]) {
  const CHUNK_SIZE = 150; // tune as needed
  const all: any[] = [];

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const slice = ids.slice(i, i + CHUNK_SIZE);

    const { data, error } = await supabase
      .from("apartment_units")
      .select("property_id, rent_min, rent_max, beds, baths")
      .in("property_id", slice);

    if (error) throw error;
    if (data) all.push(...data);
  }

  return all;
}

export default function Properties() {
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [selectedProperty, setSelectedProperty] = useState<Listing | null>(null);

  const [bounds, setBounds] = useState<Range | null>(null);
  const [filters, setFilters] = useState<Filters>({
    minPrice: "",
    maxPrice: "",
    beds: [],  // Empty array for multiselect
    baths: [], // Empty array for multiselect
    intlFriendly: false,
    availableOnly: false, // Show all properties by default
  });

  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // ---- 1) Fetch listings ONCE from backend (no price filtering here) ----
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Get all listings from backend - filtering is done on frontend
        const data = await listingsAPI.getAll({});
        console.log("Properties: Loaded data from backend:", data.length, "properties");
        console.log("Properties: Sample property:", data[0]);
        setAllListings(data);

        // Use backend data directly - no need for frontend Supabase query
        // Set price bounds from backend data - include properties with price 0
        let globalMin = Infinity, globalMax = -Infinity;
        data.forEach((l: any) => {
          if (l._priceRange?.min != null && l._priceRange.min >= 0) {
            globalMin = Math.min(globalMin, l._priceRange.min);
          }
          if (l._priceRange?.max != null && l._priceRange.max >= 0) {
            globalMax = Math.max(globalMax, l._priceRange.max);
          }
        });
        
        // If no properties have pricing data, set default bounds
        if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) {
          globalMin = 0;
          globalMax = 10000;
        }

        if (Number.isFinite(globalMin) && Number.isFinite(globalMax)) {
          setBounds([globalMin, globalMax]);
        } else {
          setBounds([0, 5000]);
        }

        // Skip the frontend Supabase query for now
        /*
        const ids = data.map((l: any) => l.id) as string[];

        if (ids.length) {
          const units = await fetchUnitsForProperties(ids);

          const byProp = new Map<string, Stats>();
          for (const u of units ?? []) {
            const pid = (u as any).property_id as string;
            const rentMin = Number((u as any).rent_min);
            const rentMax = Number((u as any).rent_max ?? (u as any).rent_min);
            const beds = Number((u as any).beds);
            const baths = Number((u as any).baths);

            const cur = byProp.get(pid) ?? {
              unitsCount: 0,
              minRent: null, maxRent: null,
              minBeds: null, maxBeds: null,
              minBaths: null, maxBaths: null,
            };
            cur.unitsCount += 1;
            cur.minRent = cur.minRent == null ? rentMin : Math.min(cur.minRent, rentMin);
            cur.maxRent = cur.maxRent == null ? rentMax : Math.max(cur.maxRent, rentMax);
            cur.minBeds = cur.minBeds == null ? beds : Math.min(cur.minBeds, beds);
            cur.maxBeds = cur.maxBeds == null ? beds : Math.max(cur.maxBeds, beds);
            cur.minBaths = cur.minBaths == null ? baths : Math.min(cur.minBaths, baths);
            cur.maxBaths = cur.maxBaths == null ? baths : Math.max(cur.maxBaths, baths);
            byProp.set(pid, cur);
          }

          // global bounds for slider - use backend data first, then fallback to frontend calculation
          let globalMin = Infinity, globalMax = -Infinity;

          // Try to use backend price data first
          data.forEach((l: any) => {
            if (l._priceRange?.min != null) globalMin = Math.min(globalMin, l._priceRange.min);
            if (l._priceRange?.max != null) globalMax = Math.max(globalMax, l._priceRange.max);
          });

          // Fallback to frontend calculation if backend data not available
          if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) {
            byProp.forEach(s => {
              if (s.minRent != null) globalMin = Math.min(globalMin, s.minRent);
              if (s.maxRent != null) globalMax = Math.max(globalMax, s.maxRent);
            });
          }

          if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) {
            setBounds([0, 5000]);
          } else {
            setBounds([globalMin, globalMax]);
            // Don't auto-set price filters - let user choose
            // setFilters(prev => ({
            //   ...prev,
            //   minPrice: prev.minPrice || String(globalMin),
            //   maxPrice: prev.maxPrice || String(globalMax),
            // }));
          }

          // attach stats to listings for rendering
          setAllListings(cur =>
            cur.map((l: any) => ({
              ...l,
              _stats: byProp.get(l.id) ?? {
                unitsCount: 0,
                minRent: null, maxRent: null,
                minBeds: null, maxBeds: null,
                minBaths: null, maxBaths: null,
              },
              // Use backend's price data if available
              price: l._priceRange?.min || l.price || 0,
            }))
          );
        } else {
          setBounds([0, 5000]);
        }
        */
      } catch (e: any) {
        setError(e?.message || "Failed to fetch properties");
      } finally {
        setLoading(false);
      }
    })();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 3) Local filtering (slider & selects) — NO extra backend calls ----
  const filtered = useMemo(() => {
    console.log("Properties: Filtering with filters:", filters);
    console.log("Properties: Total listings:", allListings.length);
    // If no filters are applied, use all listings
    if (filters.minPrice === "" && filters.maxPrice === "" && 
        filters.beds.length === 0 && filters.baths.length === 0 && 
        !filters.intlFriendly && !filters.availableOnly) {
      return allListings;
    }
    
    // Only apply price bounds if user has set price filters
    const min = filters.minPrice ? parseInt(filters.minPrice) : 0;
    const max = filters.maxPrice ? parseInt(filters.maxPrice) : 999999;

    let result = allListings.filter((l: any) => {
      // Use backend data directly
      const priceRange = l._priceRange || { min: l.price || 0, max: l.price || 0 };

      // price overlap - use backend price range
      // Special handling: if no price filters set, show all properties (including price 0)
      const priceOk = (filters.minPrice === "" && filters.maxPrice === "") || 
                     (priceRange.min <= max && priceRange.max >= min);

      // beds/baths - use exact matches with multiselect support
      const bedsOk =
        filters.beds.length === 0 || // No selection = show all
          filters.beds.includes("4") ? l.beds >= 4 : // 4+ includes 4 and above
          filters.beds.some(bed => l.beds === parseInt(bed)); // Exact matches

      const bathsOk =
        filters.baths.length === 0 || // No selection = show all
          filters.baths.includes("3") ? l.baths >= 3 : // 3+ includes 3 and above
          filters.baths.some(bath => l.baths === parseInt(bath)); // Exact matches

      // intl flag
      const intlOk = !filters.intlFriendly || Boolean(l.intlFriendly);

      // availability filter - show only properties with available units if enabled
      const availabilityOk = !filters.availableOnly || (l._unitCount && l._unitCount > 0);
      if (!availabilityOk && filters.availableOnly) {
        console.log("Properties: Filtering out property", l.title, "because _unitCount:", l._unitCount);
      }
      

      return priceOk && bedsOk && bathsOk && intlOk && availabilityOk;
    });


    // Apply sorting to all results (whether filtered or not)
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
          const priceA = (a as any)._priceRange?.min || a.price || 0;
          const priceB = (b as any)._priceRange?.min || b.price || 0;
          // Move properties with no price (0) to the end
          if (priceA === 0 && priceB === 0) return 0;
          if (priceA === 0) return 1;  // Move A to end
          if (priceB === 0) return -1; // Move B to end
          return priceA - priceB;
        case 'price-high':
          const priceAHigh = (a as any)._priceRange?.min || a.price || 0;
          const priceBHigh = (b as any)._priceRange?.min || b.price || 0;
          // Move properties with no price (0) to the end
          if (priceAHigh === 0 && priceBHigh === 0) return 0;
          if (priceAHigh === 0) return 1;  // Move A to end
          if (priceBHigh === 0) return -1; // Move B to end
          return priceBHigh - priceAHigh;
        case 'name-a':
          return a.title.localeCompare(b.title);
        case 'name-z':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    console.log("Properties: Filtered result count:", result.length);
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
      availableOnly: false 
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
            onClick={() => window.location.href = '/roommate-matching'}
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
                  ({allListings.filter((l: any) => l._unitCount > 0).length} with available units)
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
            <div className="relative z-[999]">
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="w-[180px] h-8">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    <SelectValue placeholder="Sort by..." />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[999]">
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
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">Create Your Roommate Profile</h3>
                  <p className="text-sm text-blue-700">
                    Answer a few questions to create your roommate profile and find better matches
                  </p>
                </div>
              </div>
               <Button
                 onClick={() => window.location.href = '/roommate-questionnaire'}
                 className="bg-blue-600 hover:bg-blue-700"
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
                {paginatedListings.map((listing: any) => (
                  <PropertyCard
                    key={listing.id}
                    listing={{
                      ...listing,
                      // Use backend data directly - no need for _stats override
                    } as any}
                    className={selectedProperty?.id === listing.id ? "ring-2 ring-accent" : ""}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[800px]">
                <div className="lg:col-span-2">
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
                      property_type: undefined
                    }}
                  />
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
