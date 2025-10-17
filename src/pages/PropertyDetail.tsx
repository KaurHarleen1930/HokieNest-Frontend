import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ErrorState } from "@/components/ui/error-state";
import { listingsAPI, Listing } from "@/lib/api";
import { PropertyMap } from "@/components/PropertyMap";
import { 
  ArrowLeft, 
  Bed, 
  Bath, 
  Globe, 
  MapPin, 
  Mail, 
  Phone,
  Wifi,
  Car,
  Shield,
  Zap,
  Home
} from "lucide-react";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        const data = await listingsAPI.getById(id);
        setListing(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch property");
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-surface-2 rounded w-1/4"></div>
            <div className="h-64 bg-surface-2 rounded"></div>
            <div className="space-y-4">
              <div className="h-8 bg-surface-2 rounded w-3/4"></div>
              <div className="h-6 bg-surface-2 rounded w-1/2"></div>
              <div className="h-4 bg-surface-2 rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <ErrorState
            title="Property not found"
            description={error || "The property you're looking for doesn't exist or has been removed."}
            onRetry={() => navigate('/properties')}
          />
        </div>
      </div>
    );
  }

  const amenitiesMap: Record<string, { icon: typeof Wifi; label: string }> = {
    wifi: { icon: Wifi, label: "WiFi" },
    parking: { icon: Car, label: "Parking" },
    security: { icon: Shield, label: "Security" },
    utilities: { icon: Zap, label: "Utilities Included" },
  };

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
          {/* Image */}
          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-lg">
              <img
                src={listing.imageUrl}
                alt={listing.title}
                className="w-full h-[400px] object-cover"
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
          </div>

          {/* Key Info */}
          <div className="space-y-6">
            <div>
              <h1 
                className="text-3xl font-bold text-foreground mb-2"
                data-testid="listing-title"
              >
                {listing.title}
              </h1>
              <p className="text-3xl font-bold text-accent mb-4">
                ${listing.price.toLocaleString()}/mo
              </p>
              <div className="flex items-center gap-2 text-muted mb-4">
                <MapPin className="h-4 w-4" />
                <span>{listing.address}</span>
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
            </div>

            {/* Contact CTA */}
            <Card className="bg-surface border-surface-3">
              <CardHeader>
                <CardTitle className="text-lg">Contact Property</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {listing.contactEmail && (
                  <Button variant="accent" className="w-full gap-2">
                    <Mail className="h-4 w-4" />
                    {listing.contactEmail}
                  </Button>
                )}
                {listing.contactPhone && (
                  <Button variant="outline" className="w-full gap-2">
                    <Phone className="h-4 w-4" />
                    {listing.contactPhone}
                  </Button>
                )}
                {!listing.contactEmail && !listing.contactPhone && (
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
                    `Beautiful ${listing.beds}-bedroom, ${listing.baths}-bathroom property located at ${listing.address}. This well-maintained home offers comfortable living space perfect for Virginia Tech students and staff. The property features modern amenities and is conveniently located near campus with easy access to transportation and local attractions.`
                  }
                </p>
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
                    {listing.amenities.map((amenity, index) => {
                      const amenityInfo = amenitiesMap[amenity.toLowerCase()] || {
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Property Details */}
            <Card className="bg-surface border-surface-3">
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted">Bedrooms</span>
                  <span className="text-foreground font-medium">{listing.beds}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted">Bathrooms</span>
                  <span className="text-foreground font-medium">{listing.baths}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted">International Friendly</span>
                  <span className="text-foreground font-medium">
                    {listing.intlFriendly ? "Yes" : "No"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted">Monthly Rent</span>
                  <span className="text-accent font-bold text-lg">
                    ${listing.price.toLocaleString()}
                  </span>
                </div>
                {listing.distanceFromCampus && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted">Distance to VT Campus</span>
                      <span className="text-foreground font-medium">
                        {listing.distanceFromCampus} miles
                      </span>
                    </div>
                    <div className="text-xs text-muted">
                      Nearest: {listing.nearestCampus?.name}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-surface border-surface-3">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full gap-2">
                  <Phone className="h-4 w-4" />
                  Schedule Tour
                </Button>
                <Button variant="outline" className="w-full gap-2">
                  <Mail className="h-4 w-4" />
                  Ask Question
                </Button>
                <Button variant="ghost" className="w-full">
                  Save Property
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}