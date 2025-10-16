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
import { Filter, Home, ChevronDown, ChevronUp, MapIcon, Grid3X3 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PriceRange from "@/components/ui/PriceRange";
import { supabase } from "@/lib/supabase";

interface Filters {
  minPrice: string;
  maxPrice: string;
  beds: string[];  // Changed to array for multiselect
  baths: string[]; // Changed to array for multiselect
  intlFriendly: boolean;
}
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
  });

  // ---- 1) Fetch listings ONCE from backend (no price filtering here) ----
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Get all listings from backend - filtering is done on frontend
        const data = await listingsAPI.getAll({});
        setAllListings(data);

        // Use backend data directly - no need for frontend Supabase query
        // Set price bounds from backend data
        let globalMin = Infinity, globalMax = -Infinity;
        data.forEach((l: any) => {
          if (l._priceRange?.min != null) globalMin = Math.min(globalMin, l._priceRange.min);
          if (l._priceRange?.max != null) globalMax = Math.max(globalMax, l._priceRange.max);
        });

        if (Number.isFinite(globalMin) && Number.isFinite(globalMax)) {
          setBounds([globalMin, globalMax]);
          setFilters(prev => ({
            ...prev,
            minPrice: prev.minPrice || String(globalMin),
            maxPrice: prev.maxPrice || String(globalMax),
          }));
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
            // init filter inputs if empty
            setFilters(prev => ({
              ...prev,
              minPrice: prev.minPrice || String(globalMin),
              maxPrice: prev.maxPrice || String(globalMax),
            }));
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
    const min = filters.minPrice ? parseInt(filters.minPrice) : bounds?.[0] ?? 0;
    const max = filters.maxPrice ? parseInt(filters.maxPrice) : bounds?.[1] ?? 999999;

    const result = allListings.filter((l: any) => {
      // Use backend data directly
      const priceRange = l._priceRange || { min: l.price || 0, max: l.price || 0 };

      // price overlap - use backend price range
      const priceOk = priceRange.min <= max && priceRange.max >= min;

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

      return priceOk && bedsOk && bathsOk && intlOk;
    });

    // Sort results to put selected property first
    if (selectedProperty) {
      result.sort((a, b) => {
        if (a.id === selectedProperty.id) return -1;
        if (b.id === selectedProperty.id) return 1;
        return 0;
      });
    }

    return result;
  }, [allListings, filters, bounds, selectedProperty]);

  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    if (bounds) {
      setFilters({
        minPrice: String(bounds[0]),
        maxPrice: String(bounds[1]),
        beds: [],  // Empty array
        baths: [], // Empty array
        intlFriendly: false,
      });
    } else {
      setFilters({ minPrice: "", maxPrice: "", beds: [], baths: [], intlFriendly: false });
    }
  };

  const activeFilterCount = useMemo(
    () => {
      let count = 0;
      if (filters.minPrice !== "") count++;
      if (filters.maxPrice !== "") count++;
      if (filters.beds.length > 0) count++;
      if (filters.baths.length > 0) count++;
      if (filters.intlFriendly) count++;
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
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Properties</h1>
            <p className="text-muted">
              {filtered.length} {filtered.length === 1 ? "property" : "properties"} available
            </p>
          </div>

          <div className="flex items-center gap-3 mt-4 md:mt-0">
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

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="lg:w-80">
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <Card className="bg-surface border-surface-3 sticky top-4">
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
                {filtered.map((listing: any) => (
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                <div className="lg:col-span-2">
                  <PropertyMap
                    properties={filtered as any}
                    selectedProperty={selectedProperty as any}
                    onPropertySelect={setSelectedProperty as any}
                    className="h-full"
                  />
                </div>
                <div className="space-y-4 overflow-y-auto">
                  <h3 className="font-semibold text-lg">Properties ({filtered.length})</h3>
                  {filtered.map((listing: any, index: number) => (
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
          </div>
        </div>
      </div>
    </div>
  );
}
