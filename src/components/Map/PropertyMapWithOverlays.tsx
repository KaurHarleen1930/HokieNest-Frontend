// src/components/Map/PropertyMapWithOverlays.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Pane } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Utensils, Wine, Coffee, Train, Bus, MapPin } from 'lucide-react';

// --- FIX: Fix for default Leaflet icon ---
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});
// --- END FIX ---

// --- NEW: Added constant for metro line colors ---
const METRO_LINE_COLORS: Record<string, string> = {
  RD: '#BE123C', // Red
  BL: '#007ACC', // Blue
  YL: '#FCD116', // Yellow
  OR: '#F59E0B', // Orange
  SV: '#A0A0A0', // Silver (adjusted for visibility)
  GR: '#059669', // Green
  Metro: '#5A6370', // Default Gray
};
// --- END NEW ---

// --- MODIFIED: Replaced the default "H" icon with a building icon ---
const propertyIcon = new DivIcon({
  className: 'custom-property-marker-main',
  html: `<div style="
    background-color:#6366F1;
    width:32px;
    height:32px;
    border-radius:50%;
    display:flex;
    align-items:center;
    justify-content:center;
    border:3px solid #fff;
    box-shadow:0 2px 5px rgba(0,0,0,0.4);
    color:#fff;
    font-size:14px;
    font-weight:600;
  ">P</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
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

// --- MODIFIED: Updated types to match backend data ---
interface Attraction {
  id: string;
  name: string;
  address: string;
  category: string; // 'restaurant', 'bar', 'cafe', etc.
  rating?: number;
  latitude: number;
  longitude: number;
  distance_miles: number;
}

interface TransitStation {
  id: string;
  name: string;
  station_type: string; // 'metro' or 'bus_stop'
  latitude: number;
  longitude: number;
  lines?: string[]; // e.g., ['BL', 'YL']
  distance_miles: number;
}
// --- END OF MODIFICATION ---

// --- NEW: Replaced simple icon with advanced SVG icon factory ---
const createLetterIcon = (color: string, letter: string) =>
  L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background:${color};
      width:24px;
      height:24px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#fff;
      font-size:11px;
      font-weight:600;
      border:2px solid #fff;
      box-shadow:0 2px 4px rgba(0,0,0,0.25);
    ">${letter}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });

const getMetroIcon = (lines: string[] = []) => {
  const normalized = lines.map((line) => line.toUpperCase());
  const primary = normalized.find((line) => METRO_LINE_COLORS[line]) ?? 'Metro';
  const color = METRO_LINE_COLORS[primary] ?? METRO_LINE_COLORS.Metro;
  return createLetterIcon(color, 'M');
};

const restaurantIcon = createLetterIcon('#EA580C', 'R');
const barIcon = createLetterIcon('#DB2777', 'B');
const cafeIcon = createLetterIcon('#78350F', 'C');
const busIcon = createLetterIcon('#0284C7', 'B');
const attractionIcon = createLetterIcon('#65A30D', 'A');

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
    attractions: true, // Added for "other"
    metro: true,       // Split transit
    bus: true,         // Split transit
  });

  useEffect(() => {
    if (showAttractions && propertyId) {
      loadAttractions();
    }
    if (showTransit && propertyId) {
      loadTransit();
    }
  }, [propertyId, showAttractions, showTransit]);

  const loadAttractions = async () => {
    try {
      // NOTE: Using a relative path. Ensure your proxy is set up in vite.config.ts
      const response = await fetch(`/api/v1/attractions/nearby/${propertyId}`);
      if (!response.ok) throw new Error('Failed to fetch attractions');
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
      if (!response.ok) throw new Error('Failed to fetch transit');
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
    const universityCoords = "38.8816,-77.1025"; // Example: VT Arlington
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${universityCoords}&travelmode=transit`;
    window.open(url, '_blank');
  };

  // --- MODIFIED: Data filtering now includes 'other' attractions and splits transit ---
  const restaurants = attractions.filter(a => a.category === 'restaurant');
  const bars = attractions.filter(a => a.category === 'bar');
  const cafes = attractions.filter(a => a.category === 'cafe');
  const otherAttractions = attractions.filter(
    a => !['restaurant', 'bar', 'cafe'].includes(a.category)
  );
  const metros = transit.filter(t => String(t.station_type).toLowerCase().includes('metro'));
  const buses = transit.filter(t => String(t.station_type).toLowerCase().includes('bus'));
  // --- END MODIFICATION ---

  return (
    <div className="relative w-full h-full">
      {/* Layer Toggle Controls */}
      <div className="absolute top-4 right-4 z-[12000] bg-white rounded-lg shadow-lg p-3 space-y-2 max-w-[260px] max-h-[calc(100%-2rem)] overflow-y-auto pointer-events-auto">
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
          variant={layerToggles.attractions ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleLayer('attractions')}
          className="w-full justify-start"
        >
          <MapPin className="w-4 h-4 mr-2" />
          Other ({otherAttractions.length})
        </Button>

        <Button
          variant={layerToggles.metro ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleLayer('metro')}
          className="w-full justify-start"
        >
          <Train className="w-4 h-4 mr-2" />
          Metro ({metros.length})
        </Button>

        <Button
          variant={layerToggles.bus ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleLayer('bus')}
          className="w-full justify-start"
        >
          <Bus className="w-4 h-4 mr-2" />
          Bus ({buses.length})
        </Button>
      </div>

      {/* Map */}
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        className="rounded-lg"
        doubleClickZoom={false}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Property Marker (NOW USES NEW ICON) */}
        <Marker position={center} icon={propertyIcon}>
          <Popup>
            <div className="text-center flex flex-col gap-2">
              <div>
                <div className="font-semibold">Your Property</div>
                <Badge variant="secondary" className="mt-1">Selected</Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleGetDirections(center[0], center[1])}
              >
                Get Directions
              </Button>
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
                  <Utensils className="w-4 h-4 text-orange-600 mt-1" />
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
                  <Wine className="w-4 h-4 text-pink-600 mt-1" />
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
                  <Coffee className="w-4 h-4 text-yellow-800 mt-1" />
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

        {/* --- NEW: Other Attractions Markers --- */}
        {layerToggles.attractions && otherAttractions.map((item) => (
          <Marker
            key={item.id}
            position={[item.latitude, item.longitude]}
            icon={attractionIcon}
            eventHandlers={{
              click: () => onMarkerClick?.('attraction', item.id)
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-lime-600 mt-1" />
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-xs text-gray-600">{item.address}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-3 h-3" />
                  <span>{item.distance_miles.toFixed(2)} mi away</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* --- MODIFIED: Split Transit into Metro and Bus --- */}

        {/* Metro Station Markers */}
        <Pane name="metroPane" style={{ zIndex: 480 }}>
          {layerToggles.metro && metros.map((station) => (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={getMetroIcon(station.lines)} // Uses new dynamic icon
              eventHandlers={{
                click: () => onMarkerClick?.('transit', station.id)
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <div className="flex items-start gap-2 mb-2">
                    <Train className="w-4 h-4 text-gray-700 mt-1" />
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
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="text-xs"
                          style={{
                            backgroundColor: METRO_LINE_COLORS[line] || '#ccc',
                            color: (line === 'YL' || line === 'OR') ? '#000' : '#fff'
                          }}
                        >
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
        </Pane>

        {/* Bus Station Markers */}
        <Pane name="busPane" style={{ zIndex: 470 }}>
          {layerToggles.bus && buses.map((station) => (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={busIcon} // Uses new bus icon
              eventHandlers={{
                click: () => onMarkerClick?.('transit', station.id)
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <div className="flex items-start gap-2 mb-2">
                    <Bus className="w-4 h-4 text-sky-600 mt-1" />
                    <div>
                      <div className="font-semibold">{station.name}</div>
                      <Badge variant="outline" className="text-xs mt-1">
                        Bus Stop
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-3 h-3" />
                    <span>{station.distance_miles.toFixed(2)} mi away</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </Pane>
        {/* --- END MODIFICATION --- */}
      </MapContainer>

      {/* Legend --- MODIFIED to show all types --- */}
      <div className="absolute bottom-4 left-4 z-[12000] bg-surface/95 border border-border rounded-lg shadow-lg p-3 space-y-2 text-foreground">
        <div className="text-sm font-semibold mb-2">Legend</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#EA580C'}}></div>
            <span>Restaurant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#DB2777'}}></div>
            <span>Bar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#78350F'}}></div>
            <span>Cafe</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#65A30D'}}></div>
            <span>Other</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#5A6370'}}></div>
            <span>Metro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#0284C7'}}></div>
            <span>Bus</span>
          </div>
        </div>
        
        {/* Metro Line Legend */}
        <div className="mt-2 pt-2 border-t border-border/60">
          <div className="text-xs font-semibold mb-2 text-foreground">Metro Lines</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
            {Object.entries(METRO_LINE_COLORS).filter(([line]) => line !== 'Metro').map(([line, color]) => (
              <div key={line} className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs">{line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* --- END MODIFICATION --- */}
    </div>
  );
}