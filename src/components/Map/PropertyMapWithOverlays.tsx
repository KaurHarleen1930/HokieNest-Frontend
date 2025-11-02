// src/components/Map/PropertyMapWithOverlays.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Utensils, Wine, Coffee, Train, MapPin } from 'lucide-react';

// --- MODIFIED: Replaced the default "brown box" icon ---
const DefaultIcon = new DivIcon({
  className: 'custom-property-marker-main',
  html: `
    <div style="
      background-color: #630031; /* VT Maroon */
      color: white;
      font-size: 18px;
      font-weight: bold;
      font-family: sans-serif;
      width: 36px;
      height: 36px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.4);
    ">
      <span style="transform: rotate(45deg);">H</span>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36], // Point of the "teardrop"
  popupAnchor: [0, -38]
});
// --- END OF MODIFICATION ---

interface PropertyMapWithOverlaysProps {
  propertyId: string;
  center: [number, number];
  zoom?: number;
  showAttractions?: boolean;
  showTransit?: boolean;
  onMarkerClick?: (type: string, id: string) => void;
}

interface Attraction {
  id: string;
  name: string;
  address: string;
  category: string;
  rating?: number;
  latitude: number;
  longitude: number;
  distance_miles: number;
}

interface TransitStation {
  id: string;
  name: string;
  station_type: string;
  latitude: number;
  longitude: number;
  lines?: string[];
  distance_miles: number;
}

// Simpler, smaller custom marker icons
const createCustomIcon = (iconText: string, color: string) => {
  return new DivIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      ">
        ${iconText}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

const restaurantIcon = createCustomIcon('🍽️', '#f97316'); // orange
const barIcon = createCustomIcon('🍷', '#8b5cf6'); // purple
const cafeIcon = createCustomIcon('☕', '#10b981'); // green
const transitIcon = createCustomIcon('🚇', '#3b82f6'); // blue


export default function PropertyMapWithOverlays({
  propertyId,
  center,
  zoom = 14,
  showAttractions = true,
  showTransit = true,
  onMarkerClick
}: PropertyMapWithOverlaysProps) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [transit, setTransit] = useState<TransitStation[]>([]);
  const [layerToggles, setLayerToggles] = useState({
    restaurants: true,
    bars: true,
    cafes: true,
    transit: true
  });

  useEffect(() => {
    if (showAttractions) {
      loadAttractions();
    }
    if (showTransit) {
      loadTransit();
    }
  }, [propertyId, showAttractions, showTransit]);

  const loadAttractions = async () => {
    try {
      // NOTE: Using a relative path. Ensure your proxy is set up in vite.config.ts
      const response = await fetch(`/api/v1/attractions/nearby/${propertyId}`);
      const data = await response.json();
      if (data.success) {
        setAttractions(data.data);
      }
    } catch (error) {
      console.error('Error loading attractions:', error);
    }
  };

  const loadTransit = async () => {
    try {
      // NOTE: Using a relative path. Ensure your proxy is set up in vite.config.ts
      const response = await fetch(`/api/v1/transit/nearby/${propertyId}`);
      const data = await response.json();
      if (data.success) {
        setTransit(data.data);
      }
    } catch (error) {
      console.error('Error loading transit:', error);
    }
  };

  const toggleLayer = (layer: keyof typeof layerToggles) => {
    setLayerToggles(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleGetDirections = (lat: number, lng: number) => {
    // ---- **** REPLACE WITH YOUR UNIVERSITY'S COORDINATES **** ----
    const universityCoords = "37.2296,-80.4139"; // Example: Virginia Tech
    
    const url = `http://googleusercontent.com/maps/google.com/0{lat},${lng}&destination=${universityCoords}&travelmode=transit`;
    window.open(url, '_blank');
  };

  const getAttractionIcon = (category: string) => {
    switch (category) {
      case 'restaurant': return restaurantIcon;
      case 'bar': return barIcon;
      case 'cafe': return cafeIcon;
      default: return DefaultIcon;
    }
  };

  const restaurants = attractions.filter(a => a.category === 'restaurant');
  const bars = attractions.filter(a => a.category === 'bar');
  const cafes = attractions.filter(a => a.category === 'cafe');

  return (
    <div className="relative w-full h-full">
      {/* Layer Toggle Controls */}
      <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 space-y-2">
        <div className="text-sm font-semibold mb-2">Map Layers</div>
        
        <Button
          variant={layerToggles.restaurants ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleLayer('restaurants')}
          className="w-full justify-start"
        >
          <Utensils className="w-4 h-4 mr-2" />
          Restaurants ({restaurants.length})
        </Button>

        <Button
          variant={layerToggles.bars ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleLayer('bars')}
          className="w-full justify-start"
        >
          <Wine className="w-4 h-4 mr-2" />
          Bars ({bars.length})
        </Button>

        <Button
          variant={layerToggles.cafes ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleLayer('cafes')}
          className="w-full justify-start"
        >
          <Coffee className="w-4 h-4 mr-2" />
          Cafes ({cafes.length})
        </Button>

        <Button
          variant={layerToggles.transit ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleLayer('transit')}
          className="w-full justify-start"
        >
          <Train className="w-4 h-4 mr-2" />
          Transit ({transit.length})
        </Button>
      </div>

      {/* Map */}
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Property Marker (NOW USES NEW ICON) */}
        <Marker position={center} icon={DefaultIcon}>
          <Popup>
            <div className="text-center flex flex-col gap-2">
              <div>
                <div className="font-semibold">Your Property</div>
                <Badge variant="secondary" className="mt-1">Selected</Badge>
              </div>
              {layerToggles.transit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGetDirections(center[0], center[1])}
                >
                  Get Directions
                </Button>
              )}
            </div>
          </Popup>
        </Marker>

        {/* Search radius circle */}
        <Circle
          center={center}
          radius={3218.69} // 2 miles in meters
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '5, 10'
          }}
        />

        {/* Restaurant Markers */}
        {layerToggles.restaurants && restaurants.map((restaurant) => (
          <Marker
            key={restaurant.id}
            position={[restaurant.latitude, restaurant.longitude]}
            icon={restaurantIcon}
            eventHandlers={{
              click: () => onMarkerClick?.('restaurant', restaurant.id)
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-start gap-2 mb-2">
                  <Utensils className="w-4 h-4 text-orange-500 mt-1" />
                  <div>
                    <div className="font-semibold">{restaurant.name}</div>
                    <div className="text-xs text-gray-600">{restaurant.address}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-3 h-3" />
                  <span>{restaurant.distance_miles.toFixed(2)} mi away</span>
                </div>
                {restaurant.rating && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-sm">{restaurant.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Bar Markers */}
        {layerToggles.bars && bars.map((bar) => (
          <Marker
            key={bar.id}
            position={[bar.latitude, bar.longitude]}
            icon={barIcon}
            eventHandlers={{
              click: () => onMarkerClick?.('bar', bar.id)
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-start gap-2 mb-2">
                  <Wine className="w-4 h-4 text-purple-500 mt-1" />
                  <div>
                    <div className="font-semibold">{bar.name}</div>
                    <div className="text-xs text-gray-600">{bar.address}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-3 h-3" />
                  <span>{bar.distance_miles.toFixed(2)} mi away</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Cafe Markers */}
        {layerToggles.cafes && cafes.map((cafe) => (
          <Marker
            key={cafe.id}
            position={[cafe.latitude, cafe.longitude]}
            icon={cafeIcon}
            eventHandlers={{
              click: () => onMarkerClick?.('cafe', cafe.id)
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-start gap-2 mb-2">
                  <Coffee className="w-4 h-4 text-green-500 mt-1" />
                  <div>
                    <div className="font-semibold">{cafe.name}</div>
                    <div className="text-xs text-gray-600">{cafe.address}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-3 h-3" />
                  <span>{cafe.distance_miles.toFixed(2)} mi away</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Transit Station Markers */}
        {layerToggles.transit && transit.map((station) => (
          <Marker
            key={station.id}
            position={[station.latitude, station.longitude]}
            icon={transitIcon}
            eventHandlers={{
              click: () => onMarkerClick?.('transit', station.id)
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-start gap-2 mb-2">
                  <Train className="w-4 h-4 text-blue-500 mt-1" />
                  <div>
                    <div className="font-semibold">{station.name}</div>
                    <Badge variant="outline" className="text-xs mt-1">
                      {station.station_type}
                    </Badge>
                  </div>
                </div>
                {station.lines && station.lines.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {station.lines.map((line, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {line}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-3 h-3" />
                  <span>{station.distance_miles.toFixed(2)} mi away</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3">
        <div className="text-xs font-semibold mb-2">Legend</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <span>Restaurants</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-purple-500"></div>
            <span>Bars & Nightlife</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span>Cafes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>Transit Stations</span>
          </div>
        </div>
      </div>
    </div>
  );
}