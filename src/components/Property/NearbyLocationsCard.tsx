// src/components/Property/NearbyLocationsCard.tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Utensils, Wine, Coffee, Train, Bus } from 'lucide-react';
import type { Attraction } from '@/services/attractionsService';
import type { TransitStation } from '@/services/transitService';

type NearbyLocationsCardProps = {
  attractions: Attraction[];
  transit: TransitStation[];
};

// Helper to get an icon and type label for each item
const getLocationDetails = (item: any) => {
  if (item.category) { // It's an Attraction
    switch (item.category) {
      case 'restaurant':
        return { icon: <Utensils className="h-4 w-4 text-orange-500" />, type: "Restaurant" };
      case 'bar':
        return { icon: <Wine className="h-4 w-4 text-purple-500" />, type: "Bar" };
      case 'cafe':
        return { icon: <Coffee className="h-4 w-4 text-green-500" />, type: "Cafe" };
      default:
        return { icon: <MapPin className="h-4 w-4 text-gray-500" />, type: "Attraction" };
    }
  }
  if (item.station_type) { // It's a TransitStation
    switch (item.station_type) {
      case 'metro':
        return { icon: <Train className="h-4 w-4 text-blue-500" />, type: "Metro Station" };
      case 'bus_stop':
        return { icon: <Bus className="h-4 w-4 text-sky-500" />, type: "Bus Stop" };
      default:
        return { icon: <Train className="h-4 w-4 text-gray-500" />, type: "Transit" };
    }
  }
  return { icon: <MapPin className="h-4 w-4 text-gray-500" />, type: "Location" };
};

// Helper to safely parse distance
const parseDistance = (distance: string | number | undefined): number => {
  if (typeof distance === 'number') return distance;
  if (typeof distance === 'string') return parseFloat(distance);
  return Infinity;
};

export const NearbyLocationsCard = ({ attractions, transit }: NearbyLocationsCardProps) => {
  // Combine, map to a common format, and sort all locations
  const combinedLocations = [
    ...attractions.map(item => ({ ...item, distance: parseDistance(item.distance_miles) })),
    ...transit.map(item => ({ ...item, distance: parseDistance(item.distance_miles) })),
  ].sort((a, b) => a.distance - b.distance);

  if (!combinedLocations || combinedLocations.length === 0) {
    return (
        <Card className="bg-surface border-surface-3">
            <CardHeader>
                <CardTitle>Nearby Locations</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted">No nearby locations data available.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="bg-surface border-surface-3">
      <CardHeader>
        <CardTitle>Nearby Locations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {combinedLocations.map((item) => {
            const { icon, type } = getLocationDetails(item);
            return (
              <Badge 
                key={item.id} 
                variant="outline" 
                className="flex items-center gap-2 p-2"
              >
                {icon}
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">({type})</span>
                <span className="text-accent-foreground font-semibold">
                  {item.distance.toFixed(2)} mi
                </span>
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default NearbyLocationsCard;