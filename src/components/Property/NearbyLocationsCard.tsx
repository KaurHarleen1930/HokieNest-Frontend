// src/components/Property/NearbyLocationsCard.tsx
import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Utensils, Wine, Coffee, Train, Bus, Navigation } from 'lucide-react';

type Attraction = {
  id: string;
  name: string;
  address?: string; // Made optional to match service type
  latitude: number;
  longitude: number;
  category: string;
  distance_miles?: string | number;
  walking_time_minutes?: number;
  rating?: number;
  price_level?: number;
};

type TransitStation = {
  id: string;
  name: string;
  address?: string; // Made optional to match service type
  latitude: number;
  longitude: number;
  station_type: string;
  distance_miles?: string | number;
  walking_time_minutes?: number;
  lines?: string[];
  has_parking?: boolean;
};

type NearbyLocationsCardProps = {
  attractions: Attraction[];
  transit: TransitStation[];
};

// Helper to get an icon and styling for each category
const getCategoryInfo = (category: string) => {
  switch (category) {
    case 'restaurant':
      return { 
        icon: <Utensils className="h-5 w-5" />, 
        label: "Restaurant", 
        color: "text-orange-600 bg-orange-50 border-orange-200" 
      };
    case 'bar':
      return { 
        icon: <Wine className="h-5 w-5" />, 
        label: "Bar", 
        color: "text-purple-600 bg-purple-50 border-purple-200" 
      };
    case 'cafe':
      return { 
        icon: <Coffee className="h-5 w-5" />, 
        label: "Cafe", 
        color: "text-green-600 bg-green-50 border-green-200" 
      };
    default:
      return { 
        icon: <MapPin className="h-5 w-5" />, 
        label: "Attraction", 
        color: "text-gray-600 bg-gray-50 border-gray-200" 
      };
  }
};

const getTransitInfo = (station_type: string) => {
  switch (station_type) {
    case 'metro':
      return { 
        icon: <Train className="h-5 w-5" />, 
        label: "Metro", 
        color: "text-blue-600 bg-blue-50 border-blue-200" 
      };
    case 'bus':
    case 'bus_stop':
      return { 
        icon: <Bus className="h-5 w-5" />, 
        label: "Bus", 
        color: "text-sky-600 bg-sky-50 border-sky-200" 
      };
    default:
      return { 
        icon: <Train className="h-5 w-5" />, 
        label: "Transit", 
        color: "text-gray-600 bg-gray-50 border-gray-200" 
      };
  }
};

// Helper to safely parse distance
const parseDistance = (distance: string | number | undefined): number => {
  if (typeof distance === 'number') return distance;
  if (typeof distance === 'string') return parseFloat(distance);
  return Infinity;
};

export const NearbyLocationsCard = ({ attractions, transit }: NearbyLocationsCardProps) => {
  // Separate attractions by category
  const restaurants = attractions.filter(a => a.category === 'restaurant');
  const bars = attractions.filter(a => a.category === 'bar');
  const cafes = attractions.filter(a => a.category === 'cafe');
  const otherAttractions = attractions.filter(a => 
    !['restaurant', 'bar', 'cafe'].includes(a.category)
  );

  // Separate transit by type
  const metroStations = transit.filter(t => t.station_type === 'metro');
  const busStops = transit.filter(t => ['bus', 'bus_stop'].includes(t.station_type));

  // Helper to render location item
  const renderLocationItem = (item: Attraction | TransitStation, isTransit: boolean = false) => {
    const distance = parseDistance(isTransit ? (item as TransitStation).distance_miles : (item as Attraction).distance_miles);
    const walkingTime = item.walking_time_minutes;
    
    let info;
    if (isTransit) {
      info = getTransitInfo((item as TransitStation).station_type);
    } else {
      info = getCategoryInfo((item as Attraction).category);
    }

    return (
      <div 
        key={item.id} 
        className={`flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-md ${info.color}`}
      >
        <div className="mt-1">{info.icon}</div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-gray-900 truncate">{item.name}</h4>
          {item.address && (
            <p className="text-xs text-gray-600 truncate mt-0.5">{item.address}</p>
          )}
          
          {/* Distance and walking time */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-700">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {distance < Infinity ? `${distance.toFixed(2)} mi` : 'N/A'}
            </span>
            {walkingTime && (
              <span className="flex items-center gap-1">
                <Navigation className="h-3 w-3" />
                {walkingTime} min walk
              </span>
            )}
          </div>

          {/* Transit-specific: Metro lines */}
          {isTransit && (item as TransitStation).lines && (item as TransitStation).lines!.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {(item as TransitStation).lines!.map(line => (
                <Badge 
                  key={line} 
                  variant="secondary" 
                  className="text-xs"
                >
                  {line}
                </Badge>
              ))}
            </div>
          )}

          {/* Transit-specific: Parking */}
          {isTransit && (item as TransitStation).has_parking && (
            <Badge variant="outline" className="mt-2 text-xs">
              🅿️ Parking Available
            </Badge>
          )}

          {/* Attraction-specific: Rating */}
          {!isTransit && (item as Attraction).rating && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-yellow-500">⭐</span>
              <span className="text-xs font-medium">{(item as Attraction).rating}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const totalLocations = attractions.length + transit.length;

  if (totalLocations === 0) {
    return (
      <Card className="bg-surface border-surface-3">
        <CardHeader>
          <CardTitle className="text-lg">Nearby Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">No nearby locations data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface border-surface-3">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Nearby Attractions & Transit
          <Badge variant="secondary">{totalLocations} locations</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Restaurants Section */}
        {restaurants.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
              <Utensils className="h-4 w-4 text-orange-600" />
              Restaurants ({restaurants.length})
            </h3>
            <div className="space-y-2">
              {restaurants.slice(0, 6).map(restaurant => renderLocationItem(restaurant))}
            </div>
          </div>
        )}

        {/* Bars Section */}
        {bars.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
              <Wine className="h-4 w-4 text-purple-600" />
              Bars & Nightlife ({bars.length})
            </h3>
            <div className="space-y-2">
              {bars.slice(0, 6).map(bar => renderLocationItem(bar))}
            </div>
          </div>
        )}

        {/* Cafes Section */}
        {cafes.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
              <Coffee className="h-4 w-4 text-green-600" />
              Cafes ({cafes.length})
            </h3>
            <div className="space-y-2">
              {cafes.slice(0, 6).map(cafe => renderLocationItem(cafe))}
            </div>
          </div>
        )}

        {/* Metro Stations Section */}
        {metroStations.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
              <Train className="h-4 w-4 text-blue-600" />
              Metro Stations ({metroStations.length})
            </h3>
            <div className="space-y-2">
              {metroStations.map(station => renderLocationItem(station, true))}
            </div>
          </div>
        )}

        {/* Bus Stops Section */}
        {busStops.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
              <Bus className="h-4 w-4 text-sky-600" />
              Bus Stops ({busStops.length})
            </h3>
            <div className="space-y-2">
              {busStops.map(stop => renderLocationItem(stop, true))}
            </div>
          </div>
        )}

        {/* Other Attractions */}
        {otherAttractions.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-600" />
              Other Locations ({otherAttractions.length})
            </h3>
            <div className="space-y-2">
              {otherAttractions.slice(0, 6).map(attraction => renderLocationItem(attraction))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default NearbyLocationsCard;