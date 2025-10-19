// src/pages/PropertyDetail.tsx - UPDATED VERSION WITH UNITS DISPLAY
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { PropertyMap } from "@/components/PropertyMap";
import { ArrowLeft, MapPin, Bed, Bath, Globe, Mail, Phone, Home, Wifi, Car, Shield, Zap, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Helper to parse JSON fields
function parseJSONField(field: any): any {
  if (!field) return null;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return null;
  }
}

interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  beds: number;
  baths: number;
  sq_ft: number | null;
  max_occupants: number;
  rent_min: number;
  rent_max: number;
  availability_status: string;
  available_date: string | null;
  unit_type: string;
  floor_number: number | null;
  has_balcony: boolean;
  has_parking: boolean;
  is_furnished: boolean;
  photos: any;
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch property details
        const { data: property, error: propertyError } = await supabase
          .from('apartment_properties_listings')
          .select('*')
          .eq('id', id)
          .single();

        if (propertyError) throw propertyError;
        if (!property) throw new Error('Property not found');

        // Parse photos JSON
        const photosArray = parseJSONField(property.photos) || [];
        const amenitiesData = parseJSONField(property.amenities) || {};

        // Fetch units for this property
        const { data: unitsData, error: unitsError } = await supabase
          .from('apartment_units')
          .select('*')
          .eq('property_id', id)
          .order('rent_min', { ascending: true });

        if (unitsError) throw unitsError;

        // Parse unit photos
        const parsedUnits = (unitsData || []).map(unit => ({
          ...unit,
          photos: parseJSONField(unit.photos) || []
        }));

        // Calculate aggregated data
        const prices = parsedUnits.map(u => [u.rent_min, u.rent_max]).flat().filter(p => p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

        const beds = parsedUnits.map(u => u.beds).filter(b => b > 0);
        const baths = parsedUnits.map(u => u.baths).filter(b => b > 0);
        const maxBeds = beds.length > 0 ? Math.max(...beds) : 0;
        const maxBaths = baths.length > 0 ? Math.max(...baths) : 0;

        setListing({
          id: property.id,
          title: property.name,
          address: property.address,
          city: property.city,
          state: property.state,
          price: minPrice,
          maxPrice: maxPrice,
          beds: maxBeds,
          baths: maxBaths,
          imageUrl: property.thumbnail_url || (photosArray.length > 0 ? photosArray[0] : null),
          photos: photosArray,
          description: property.description,
          amenities: Array.isArray(amenitiesData) ? amenitiesData : Object.keys(amenitiesData),
          contactEmail: property.email,
          contactPhone: property.phone_number,
          intlFriendly: property.intl_friendly || false,
          latitude: property.latitude,
          longitude: property.longitude,
          website_url: property.website_url,
          year_built: property.year_built,
          total_units: property.total_units
        });

        setUnits(parsedUnits);

      } catch (err) {
        console.error('Error loading property:', err);
        setError(err instanceof Error ? err.message : 'Failed to load property');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted">Loading property details...</p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-surface border-surface-3">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-4">Property Not Found</h2>
              <p className="text-muted mb-6">{error || 'This property does not exist.'}</p>
              <Button onClick={() => navigate('/properties')}>
                Back to Properties
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const amenitiesMap: Record<string, { icon: typeof Wifi; label: string }> = {
    wifi: { icon: Wifi, label: "WiFi" },
    parking: { icon: Car, label: "Parking" },
    security: { icon: Shield, label: "Security" },
    utilities: { icon: Zap, label: "Utilities Included" },
    furnished: { icon: Home, label: "Furnished" },
    laundry: { icon: Home, label: "Laundry" },
    gym: { icon: Users, label: "Fitness Center" },
    pool: { icon: Home, label: "Pool" },
  };

  // Get all available photos (property + units)
  const allPhotos = [
    ...(listing.photos || []),
    ...units.flatMap(unit => unit.photos || [])
  ].filter(Boolean);

  const displayPhotos = allPhotos.length > 0 ? allPhotos : [listing.imageUrl].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Navigation */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/properties')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Properties
        </Button>

        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Image Gallery */}
          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-lg mb-4">
              <img
                src={displayPhotos[selectedImageIndex] || listing.imageUrl}
                alt={listing.title}
                className="w-full h-[400px] object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=600&fit=crop';
                }}
              />
              {listing.intlFriendly && (
                <Badge 
                  variant="accent" 
                  className="absolute top-4 right-4 shadow-lg"
                >
                  <Globe className="h-3 w-3 mr-1" />
                  International Friendly
                </Badge>
              )}
            </div>

            {/* Photo Thumbnails */}
            {displayPhotos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {displayPhotos.slice(0, 6).map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all ${
                      selectedImageIndex === idx ? 'border-accent' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={photo}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
                {displayPhotos.length > 6 && (
                  <div className="flex-shrink-0 w-20 h-20 rounded-md bg-surface-2 flex items-center justify-center text-xs text-muted">
                    +{displayPhotos.length - 6} more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Key Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {listing.title}
              </h1>
              <p className="text-3xl font-bold text-accent mb-4">
                ${listing.price.toLocaleString()}
                {listing.maxPrice > listing.price && ` - $${listing.maxPrice.toLocaleString()}`}
                /mo
              </p>
              <div className="flex items-center gap-2 text-muted mb-4">
                <MapPin className="h-4 w-4" />
                <span>{listing.address}, {listing.city}, {listing.state}</span>
              </div>
              
              {/* Property Features */}
              <div className="flex gap-3 mb-6">
                <Chip variant="muted" size="sm">
                  <Bed className="h-4 w-4" />
                  {listing.beds} bed{listing.beds !== 1 ? 's' : ''}
                </Chip>
                <Chip variant="muted" size="sm">
                  <Bath className="h-4 w-4" />
                  {listing.baths} bath{listing.baths !== 1 ? 's' : ''}
                </Chip>
              </div>

              <div className="text-sm text-muted space-y-1">
                {listing.total_units && (
                  <p>Total Units: {listing.total_units}</p>
                )}
                {listing.year_built && (
                  <p>Year Built: {listing.year_built}</p>
                )}
              </div>
            </div>

            {/* Contact CTA */}
            <Card className="bg-surface border-surface-3">
              <CardHeader>
                <CardTitle className="text-lg">Contact Property</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {listing.contactEmail && (
                  <Button variant="accent" className="w-full gap-2" asChild>
                    <a href={`mailto:${listing.contactEmail}`}>
                      <Mail className="h-4 w-4" />
                      Email Property
                    </a>
                  </Button>
                )}
                {listing.contactPhone && (
                  <Button variant="outline" className="w-full gap-2" asChild>
                    <a href={`tel:${listing.contactPhone}`}>
                      <Phone className="h-4 w-4" />
                      {listing.contactPhone}
                    </a>
                  </Button>
                )}
                {listing.website_url && (
                  <Button variant="outline" className="w-full gap-2" asChild>
                    <a href={listing.website_url} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4" />
                      Visit Website
                    </a>
                  </Button>
                )}
                {!listing.contactEmail && !listing.contactPhone && !listing.website_url && (
                  <Button variant="accent" className="w-full">
                    Contact Landlord
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            <Card className="bg-surface border-surface-3">
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed">
                  {listing.description || 
                    `Beautiful ${listing.beds}-bedroom, ${listing.baths}-bathroom property located at ${listing.address}. This well-maintained home offers comfortable living space perfect for Virginia Tech students and staff.`
                  }
                </p>
              </CardContent>
            </Card>

            {/* Available Units */}
            <Card className="bg-surface border-surface-3">
              <CardHeader>
                <CardTitle>Available Units ({units.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {units.length === 0 ? (
                  <p className="text-muted text-center py-8">No units available at this time.</p>
                ) : (
                  <div className="space-y-4">
                    {units.map((unit) => (
                      <Card key={unit.id} className="bg-surface-2 border-surface-3">
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-lg">
                                  Unit {unit.unit_number}
                                </h3>
                                <Badge 
                                  variant={unit.availability_status === 'available' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {unit.availability_status}
                                </Badge>
                              </div>
                              
                              <div className="flex flex-wrap gap-3 mb-3">
                                <Chip variant="muted" size="sm">
                                  <Bed className="h-3 w-3" />
                                  {unit.beds} bed{unit.beds !== 1 ? 's' : ''}
                                </Chip>
                                <Chip variant="muted" size="sm">
                                  <Bath className="h-3 w-3" />
                                  {unit.baths} bath{unit.baths !== 1 ? 's' : ''}
                                </Chip>
                                {unit.sq_ft && (
                                  <Chip variant="muted" size="sm">
                                    {unit.sq_ft.toLocaleString()} sq ft
                                  </Chip>
                                )}
                                {unit.floor_number && (
                                  <Chip variant="muted" size="sm">
                                    Floor {unit.floor_number}
                                  </Chip>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2 text-xs text-muted">
                                {unit.has_balcony && (
                                  <span className="px-2 py-1 bg-surface-3 rounded">Balcony</span>
                                )}
                                {unit.has_parking && (
                                  <span className="px-2 py-1 bg-surface-3 rounded">Parking</span>
                                )}
                                {unit.is_furnished && (
                                  <span className="px-2 py-1 bg-surface-3 rounded">Furnished</span>
                                )}
                                {unit.max_occupants && (
                                  <span className="px-2 py-1 bg-surface-3 rounded">
                                    Max {unit.max_occupants} occupants
                                  </span>
                                )}
                              </div>

                              {unit.available_date && (
                                <p className="text-xs text-muted mt-2">
                                  Available: {new Date(unit.available_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>

                            <div className="text-right">
                              <p className="text-2xl font-bold text-accent">
                                ${unit.rent_min.toLocaleString()}
                                {unit.rent_max > unit.rent_min && ` - ${unit.rent_max.toLocaleString()}`}
                              </p>
                              <p className="text-xs text-muted">/month</p>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="mt-2"
                                onClick={() => {
                                  // Handle contact for specific unit
                                  if (listing.contactEmail) {
                                    window.location.href = `mailto:${listing.contactEmail}?subject=Inquiry about Unit ${unit.unit_number}`;
                                  }
                                }}
                              >
                                Inquire
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <Card className="bg-surface border-surface-3">
                <CardHeader>
                  <CardTitle>Amenities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {listing.amenities.map((amenity: string, index: number) => {
                      const amenityKey = amenity.toLowerCase();
                      const amenityInfo = amenitiesMap[amenityKey] || {
                        icon: Home,
                        label: amenity
                      };
                      const IconComponent = amenityInfo.icon;
                      
                      return (
                        <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-surface-2">
                          <IconComponent className="h-4 w-4 text-accent" />
                          <span className="text-sm text-foreground">{amenityInfo.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Property Map */}
            {listing.latitude && listing.longitude && (
              <Card className="bg-surface border-surface-3">
                <CardHeader>
                  <CardTitle>Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80 rounded-lg overflow-hidden">
                    <PropertyMap
                      properties={[listing]}
                      selectedProperty={listing}
                      onPropertySelect={() => {}}
                      className="h-full"
                    />
                  </div>
                  <div className="mt-3 text-center">
                    <p className="text-sm text-muted">{listing.address}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-surface border-surface-3 sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-surface-3">
                  <span className="text-muted">Total Units</span>
                  <span className="font-semibold">{units.length}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-surface-3">
                  <span className="text-muted">Available Units</span>
                  <span className="font-semibold text-accent">
                    {units.filter(u => u.availability_status === 'available').length}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-surface-3">
                  <span className="text-muted">Price Range</span>
                  <span className="font-semibold">
                    ${listing.price.toLocaleString()}
                    {listing.maxPrice > listing.price && ` - ${listing.maxPrice.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-surface-3">
                  <span className="text-muted">Bedrooms</span>
                  <span className="font-semibold">Up to {listing.beds}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Bathrooms</span>
                  <span className="font-semibold">Up to {listing.baths}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}