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
  beds: string;
  baths: string;
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
    beds: "any",
    baths: "any",
    intlFriendly: false,
  });

  // ---- 1) Fetch listings ONCE from backend (no price filtering here) ----
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // send only non-price filters to the backend
        const apiFilters: any = {};
        if (filters.beds !== "any") apiFilters.beds = parseInt(filters.beds);
        if (filters.baths !== "any") apiFilters.baths = parseInt(filters.baths);
        if (filters.intlFriendly) apiFilters.intlFriendly = true;

        const data = await listingsAPI.getAll(apiFilters);
        setAllListings(data);

        // 2) Load units for these properties from Supabase and compute stats
        const ids = data.map((l: any) => l.id);
        if (ids.length) {
          const { data: units, error: uErr } = await supabase
            .from("apartment_units")
            .select("property_id, rent_min, rent_max, beds, baths")
            .in("property_id", ids);

          if (uErr) throw uErr;

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

          // global bounds for slider
          let globalMin = Infinity, globalMax = -Infinity;
          byProp.forEach(s => {
            if (s.minRent != null) globalMin = Math.min(globalMin, s.minRent);
            if (s.maxRent != null) globalMax = Math.max(globalMax, s.maxRent);
          });
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
            }))
          );
        } else {
          setBounds([0, 5000]);
        }
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

    return allListings.filter((l: any) => {
      const s: Stats = l._stats ?? {
        unitsCount: 0, minRent: null, maxRent: null, minBeds: null, maxBeds: null, minBaths: null, maxBaths: null
      };

      // price overlap
      const priceOk =
        s.minRent != null && s.maxRent != null &&
        s.minRent <= max && s.maxRent >= min;

      // beds/baths
      const bedsOk =
        filters.beds === "any" ||
        (s.maxBeds != null && (filters.beds === "4" ? s.maxBeds >= 4 : s.maxBeds >= parseInt(filters.beds)));

      const bathsOk =
        filters.baths === "any" ||
        (s.maxBaths != null && (filters.baths === "3" ? s.maxBaths >= 3 : s.maxBaths >= parseInt(filters.baths)));

      // intl flag (assume boolean on listing)
      const intlOk = !filters.intlFriendly || Boolean((l as any).intlFriendly);

      return priceOk && bedsOk && bathsOk && intlOk;
    });
  }, [allListings, filters, bounds]);

  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    if (bounds) {
      setFilters({
        minPrice: String(bounds[0]),
        maxPrice: String(bounds[1]),
        beds: "any",
        baths: "any",
        intlFriendly: false,
      });
    } else {
      setFilters({ minPrice: "", maxPrice: "", beds: "any", baths: "any", intlFriendly: false });
    }
  };

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(v => v !== "" && v !== false && v !== "any").length,
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
                      <Select value={filters.beds} onValueChange={(v) => handleFilterChange("beds", v)}>
                        <SelectTrigger className="bg-surface-2 border-surface-3"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="1">1 bedroom</SelectItem>
                          <SelectItem value="2">2 bedrooms</SelectItem>
                          <SelectItem value="3">3 bedrooms</SelectItem>
                          <SelectItem value="4">4+ bedrooms</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Bathrooms */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Bathrooms</Label>
                      <Select value={filters.baths} onValueChange={(v) => handleFilterChange("baths", v)}>
                        <SelectTrigger className="bg-surface-2 border-surface-3"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="1">1 bathroom</SelectItem>
                          <SelectItem value="2">2 bathrooms</SelectItem>
                          <SelectItem value="3">3+ bathrooms</SelectItem>
                        </SelectContent>
                      </Select>
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
                      // ensure card sees price stats
                      minRent: listing._stats?.minRent ?? 0,
                      maxRent: listing._stats?.maxRent ?? 0,
                      beds: listing._stats?.maxBeds ?? 0,
                      baths: listing._stats?.maxBaths ?? 0,
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
                  {filtered.map((listing: any) => (
                    <PropertyCard
                      key={listing.id}
                      listing={listing as any}
                      className={`cursor-pointer transition-all ${
                        selectedProperty?.id === listing.id ? "ring-2 ring-accent shadow-lg" : "hover:shadow-md"
                      }`}
                      onClick={() => setSelectedProperty(listing as any)}
                    />
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
