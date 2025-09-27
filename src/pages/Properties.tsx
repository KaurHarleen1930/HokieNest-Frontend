import { useState, useEffect } from "react";
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
import { Search, Filter, Home, ChevronDown, ChevronUp, MapIcon, Grid3X3 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Filters {
  minPrice: string;
  maxPrice: string;
  beds: string;
  baths: string;
  intlFriendly: boolean;
}

export default function Properties() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedProperty, setSelectedProperty] = useState<Listing | null>(null);
  const [filters, setFilters] = useState<Filters>({
    minPrice: "",
    maxPrice: "",
    beds: "",
    baths: "",
    intlFriendly: false,
  });

  const fetchListings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🏠 Fetching listings with filters:', filters);
      
      const apiFilters: any = {};
      if (filters.minPrice) apiFilters.minPrice = parseInt(filters.minPrice);
      if (filters.maxPrice) apiFilters.maxPrice = parseInt(filters.maxPrice);
      if (filters.beds) apiFilters.beds = parseInt(filters.beds);
      if (filters.baths) apiFilters.baths = parseInt(filters.baths);
      if (filters.intlFriendly) apiFilters.intlFriendly = true;

      const data = await listingsAPI.getAll(apiFilters);
      console.log('🏠 Listings fetched successfully:', data?.length, 'properties');
      setListings(data);
    } catch (err) {
      console.error('🚨 Failed to fetch listings:', err);
      setError(err instanceof Error ? err.message : "Failed to fetch properties");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [filters]); // Auto-apply filters when they change

  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };


  const clearFilters = () => {
    setFilters({
      minPrice: "",
      maxPrice: "",
      beds: "",
      baths: "",
      intlFriendly: false,
    });
    // Apply cleared filters immediately
    setTimeout(() => {
      fetchListings();
    }, 0);
  };

  const activeFilterCount = Object.values(filters).filter(value => 
    value !== "" && value !== false
  ).length;

  if (loading) {
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
            onRetry={fetchListings}
          />
          <div className="mt-6 p-4 bg-surface-2 rounded-lg border border-surface-3">
            <h3 className="font-semibold text-foreground mb-2">Quick Fix:</h3>
            <div className="text-sm text-muted space-y-1">
              <p>1. Open a terminal and run: <code className="bg-surface px-2 py-1 rounded">cd server && npm install</code></p>
              <p>2. Set up the database: <code className="bg-surface px-2 py-1 rounded">npm run prisma:generate && npm run prisma:migrate && npm run prisma:seed</code></p>
              <p>3. Start the backend: <code className="bg-surface px-2 py-1 rounded">npm run dev</code></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Properties</h1>
            <p className="text-muted">
              {listings.length} {listings.length === 1 ? 'property' : 'properties'} available
            </p>
          </div>
          
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-surface-3 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('map')}
                className="h-8"
              >
                <MapIcon className="h-4 w-4" />
              </Button>
            </div>
            <Badge variant="muted">
              {listings.filter(l => l.intlFriendly).length} International Friendly
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
                    <Button 
                      type="button"
                      variant="ghost" 
                      className="w-full justify-between p-0 h-auto"
                    >
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Filter className="h-5 w-5" />
                        Filters
                        {activeFilterCount > 0 && (
                          <Badge variant="accent" className="ml-2 text-xs">
                            {activeFilterCount}
                          </Badge>
                        )}
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
                        <div>
                          <Label htmlFor="minPrice" className="text-xs text-muted">Min</Label>
                          <Input
                            id="minPrice"
                            type="number"
                            placeholder="$500"
                            value={filters.minPrice}
                            onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                            className="bg-surface-2 border-surface-3"
                          />
                        </div>
                        <div>
                          <Label htmlFor="maxPrice" className="text-xs text-muted">Max</Label>
                          <Input
                            id="maxPrice"
                            type="number"
                            placeholder="$2000"
                            value={filters.maxPrice}
                            onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                            className="bg-surface-2 border-surface-3"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bedrooms */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Bedrooms</Label>
                      <Select
                        value={filters.beds}
                        onValueChange={(value) => handleFilterChange('beds', value)}
                      >
                        <SelectTrigger className="bg-surface-2 border-surface-3">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any</SelectItem>
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
                      <Select
                        value={filters.baths}
                        onValueChange={(value) => handleFilterChange('baths', value)}
                      >
                        <SelectTrigger className="bg-surface-2 border-surface-3">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any</SelectItem>
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
                        onCheckedChange={(checked) => handleFilterChange('intlFriendly', checked)}
                      />
                      <Label htmlFor="intlFriendly" className="text-sm font-medium">
                        International Student Friendly
                      </Label>
                    </div>

                    {/* Filter Actions */}
                    {activeFilterCount > 0 && (
                      <div className="pt-4 border-t border-surface-3">
                        <Button onClick={clearFilters} variant="outline" className="w-full">
                          Clear All Filters
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {listings.length === 0 ? (
              <EmptyState
                icon={<Home className="h-12 w-12" />}
                title="No properties found"
                description="Try adjusting your filters or check back later for new listings."
                action={{
                  label: "Clear Filters",
                  onClick: clearFilters
                }}
              />
            ) : viewMode === 'grid' ? (
              /* Properties Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <PropertyCard 
                    key={listing.id} 
                    listing={listing}
                    className={selectedProperty?.id === listing.id ? 'ring-2 ring-accent' : ''}
                  />
                ))}
              </div>
            ) : (
              /* Map View */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
                <div className="lg:col-span-2">
                  <PropertyMap
                    properties={listings}
                    selectedProperty={selectedProperty}
                    onPropertySelect={setSelectedProperty}
                    className="h-full"
                  />
                </div>
                <div className="space-y-4 overflow-y-auto">
                  <h3 className="font-semibold text-lg">Properties ({listings.length})</h3>
                  {listings.map((listing) => (
                    <PropertyCard 
                      key={listing.id} 
                      listing={listing}
                      className={`cursor-pointer transition-all ${
                        selectedProperty?.id === listing.id 
                          ? 'ring-2 ring-accent shadow-lg' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedProperty(listing)}
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