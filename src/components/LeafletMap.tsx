import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Listing, mapAPI, PropertyMarker } from '@/lib/api';
import { MapPin, Navigation, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Fix for default markers in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Debug: Check if Leaflet is loaded
// console.log('LeafletMap: Leaflet object:', L);
// console.log('LeafletMap: L.map available:', typeof L.map);

interface LeafletMapProps {
  properties?: Listing[];
  onPropertySelect?: (property: Listing) => void;
  selectedProperty?: Listing | null;
  className?: string;
  filters?: {
    city?: string;
    min_rent?: number;
    max_rent?: number;
    beds?: number;
    property_type?: string;
  };
}

export function LeafletMap({
  properties,
  onPropertySelect,
  selectedProperty,
  className = "",
  filters
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapProperties, setMapProperties] = useState<PropertyMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLayer, setCurrentLayer] = useState<'streets' | 'satellite' | 'transit'>('streets');
  const [showVTMarkers, setShowVTMarkers] = useState(true);

  // Map control functions
  const centerMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(MAP_CENTER, 11);
    }
  };

  const fitToMarkers = () => {
    if (mapInstanceRef.current && markersRef.current.length > 0) {
      const group = new L.FeatureGroup(markersRef.current);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  };

  const toggleVTMarkers = () => {
    setShowVTMarkers(!showVTMarkers);
  };

  // VT Campus locations (DC area only)
  const VT_CAMPUSES = [
    { name: 'VT Innovation Campus (Alexandria)', lat: 38.8051, lng: -77.0470 },
    { name: 'VT Arlington Research Center', lat: 38.8816, lng: -77.1025 },
    { name: 'VT Falls Church Campus', lat: 38.8842, lng: -77.1714 }
  ];

  // Center point for DC area campuses
  const MAP_CENTER = [38.85, -77.1] as [number, number];

  // Map layers
  const mapLayers = {
    streets: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
      maxZoom: 19,
    }),
    transit: L.tileLayer('https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=your-api-key', {
      attribution: '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a>',
      maxZoom: 19,
    })
  };

  // Fetch map data
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        setLoading(true);
        const data = await mapAPI.getMapMarkers(filters);
        setMapProperties(data);
      } catch (error) {
        console.error('Error fetching map data:', error);
      } finally {
        setLoading(false);
        console.log('LeafletMap: Data fetching completed');
      }
    };

    fetchMapData();
  }, [filters]);

  useEffect(() => {
    console.log('LeafletMap: Map init useEffect running, mapRef.current:', mapRef.current);
    
    // Add a small delay to ensure DOM is ready
    let retryCount = 0;
    const maxRetries = 50; // 5 seconds max
    
    const initMap = () => {
      if (!mapRef.current) {
        retryCount++;
        if (retryCount > maxRetries) {
          console.error('LeafletMap: Failed to initialize map after', maxRetries, 'retries');
          return;
        }
        console.log('LeafletMap: mapRef.current is null, retrying...', retryCount, '/', maxRetries);
        setTimeout(initMap, 100);
        return;
      }

      console.log('LeafletMap: Creating map with container:', mapRef.current);
      console.log('LeafletMap: Container dimensions:', {
        width: mapRef.current.offsetWidth,
        height: mapRef.current.offsetHeight
      });

      // Create map
      const map = L.map(mapRef.current).setView(MAP_CENTER, 11);

      // Add default layer (streets)
      mapLayers.streets.addTo(map);

      mapInstanceRef.current = map;
      setIsLoaded(true);
      console.log('LeafletMap: Map loaded successfully');

      // Add VT campus markers with custom icons (only if showVTMarkers is true)
      if (showVTMarkers) {
        VT_CAMPUSES.forEach(campus => {
          const vtIcon = L.divIcon({
            className: 'custom-vt-marker',
            html: `
              <div style="
                background: #E87722;
                border: 2px solid white;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                color: white;
                font-size: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              ">
                VT
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          L.marker([campus.lat, campus.lng], { icon: vtIcon })
            .addTo(map)
            .bindPopup(`
              <div style="text-align: center;">
                <strong style="color: #E87722;">${campus.name}</strong>
                <br>
                <small>Virginia Tech Campus</small>
              </div>
            `);
        });
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || loading) {
      return;
    }

    // Use mapProperties from API or fallback to props
    const propertiesToShow = mapProperties.length > 0 ? mapProperties : properties || [];

    // Clear existing property markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    // Add property markers
    propertiesToShow.forEach((property, index) => {
      if (property.latitude && property.longitude) {
        const isSelected = selectedProperty?.id === property.id;
        
        // Handle both PropertyMarker and Listing types
        const title = (property as any).name || (property as any).title || 'Property';
        const address = property.address;
        const price = (property as any).rent_min || (property as any).price || 0;
        const beds = (property as any).beds || (property as any).unit_beds || 0;
        const baths = (property as any).baths || (property as any).unit_baths || 0;
        const intlFriendly = (property as any).intlFriendly || false;
        
        // Create custom property icon
        const propertyIcon = L.divIcon({
          className: 'custom-property-marker',
          html: `
            <div style="
              background: ${isSelected ? '#E87722' : '#3B82F6'};
              border: 2px solid white;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 12px;
              font-weight: bold;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
            ">
              $
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([property.latitude, property.longitude], { icon: propertyIcon })
          .addTo(mapInstanceRef.current!)
          .bindPopup(`
            <div style="min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: #1F2937; font-size: 14px; font-weight: 600;">
                ${title}
              </h3>
              <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 12px;">
                ${address}
              </p>
              <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                ${price && price > 0 ? 
                  `<span style="background: #E87722; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                    $${Number(price).toLocaleString()}/mo
                  </span>` : 
                  `<span style="background: #6B7280; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                    Call for pricing
                  </span>`
                }
                <span style="background: #3B82F6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                  ${beds} bed${beds !== 1 ? 's' : ''}
                </span>
                <span style="background: #10B981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                  ${baths} bath${baths !== 1 ? 's' : ''}
                </span>
              </div>
              ${intlFriendly ? 
                `<div style="margin-top: 8px;">
                  <span style="background: #8B5CF6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                    🌍 International Friendly
                  </span>
                </div>` : ''
              }
              <button onclick="window.selectProperty('${property.id}')" 
                style="
                  background: #E87722; 
                  color: white; 
                  border: none; 
                  padding: 6px 12px; 
                  border-radius: 4px; 
                  font-size: 12px; 
                  cursor: pointer; 
                  margin-top: 8px; 
                  width: 100%;
                ">
                View Details
              </button>
            </div>
          `);

        // Add click handler
        marker.on('click', () => {
          if (onPropertySelect) {
            onPropertySelect(property);
          }
        });

        markersRef.current.push(marker);
      }
    });

    // Fit map to show all markers if there are properties
    if (propertiesToShow.length > 0 && propertiesToShow.some(p => p.latitude && p.longitude)) {
      const group = new L.FeatureGroup(markersRef.current);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }

    // Add global function for popup button
    (window as any).selectProperty = (propertyId: string) => {
      const property = propertiesToShow.find(p => p.id === propertyId);
      if (property && onPropertySelect) {
        onPropertySelect(property as any);
      }
    };

  }, [mapProperties, properties, selectedProperty, onPropertySelect, isLoaded, loading]);

  // Center map on selected property
  useEffect(() => {
    if (selectedProperty && selectedProperty.latitude && selectedProperty.longitude && mapInstanceRef.current) {
      mapInstanceRef.current.setView([selectedProperty.latitude, selectedProperty.longitude], 15);
    }
  }, [selectedProperty]);

  // Handle layer switching
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const map = mapInstanceRef.current;
    
    // Remove all layers
    Object.values(mapLayers).forEach(layer => {
      map.removeLayer(layer);
    });

    // Add selected layer
    if (currentLayer === 'transit') {
      // Use a free transit layer instead of Thunderforest
      const transitLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      });
      transitLayer.addTo(map);
    } else {
      mapLayers[currentLayer].addTo(map);
    }
  }, [currentLayer, isLoaded]);

  // Handle VT markers toggle
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const map = mapInstanceRef.current;
    
    // Remove existing VT markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && (layer as any)._icon?.className?.includes('custom-vt-marker')) {
        map.removeLayer(layer);
      }
    });

    // Add VT markers if showVTMarkers is true
    if (showVTMarkers) {
      VT_CAMPUSES.forEach(campus => {
        const vtIcon = L.divIcon({
          className: 'custom-vt-marker',
          html: `
            <div style="
              background: #E87722;
              border: 2px solid white;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              color: white;
              font-size: 10px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">
              VT
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        L.marker([campus.lat, campus.lng], { icon: vtIcon })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center;">
              <strong style="color: #E87722;">${campus.name}</strong>
              <br>
              <small>Virginia Tech Campus</small>
            </div>
          `);
      });
    }
  }, [showVTMarkers, isLoaded]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg shadow-lg"
        style={{ height: '600px', minHeight: '600px' }}
      />
      
      {/* Loading overlay */}
      {(!isLoaded || loading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 backdrop-blur-sm rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading map...</p>
            <p className="text-xs text-gray-500 mt-1">isLoaded: {isLoaded.toString()}, loading: {loading.toString()}</p>
          </div>
        </div>
      )}
      
      {/* Map Controls Panel */}
      <div className="absolute top-4 left-4 z-50">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {/* Layer Controls */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="h-4 w-4 text-orange-500" />
              <span className="font-semibold text-sm text-gray-800">Map Layers</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setCurrentLayer('streets')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  currentLayer === 'streets' 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Streets
              </button>
              <button
                onClick={() => setCurrentLayer('satellite')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  currentLayer === 'satellite' 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Satellite
              </button>
              <button
                onClick={() => setCurrentLayer('transit')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  currentLayer === 'transit' 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Transit
              </button>
            </div>
          </div>

          {/* Map Controls */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <span className="font-semibold text-sm text-gray-800">Controls</span>
            </div>
            <div className="space-y-1">
              <button
                onClick={centerMap}
                className="w-full px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
              >
                Center Map
              </button>
              <button
                onClick={fitToMarkers}
                className="w-full px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
              >
                Fit to Properties
              </button>
              <button
                onClick={toggleVTMarkers}
                className={`w-full px-2 py-1 text-xs rounded transition-colors ${
                  showVTMarkers 
                    ? 'bg-orange-50 text-orange-700 hover:bg-orange-100' 
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {showVTMarkers ? 'Hide' : 'Show'} VT Campuses
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="font-semibold text-sm text-gray-800">Legend</span>
            </div>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>VT Campuses</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Properties</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full scale-125"></div>
                <span>Selected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Property Count Badge */}
      <div className="absolute top-4 right-4 z-50">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-800">
              {(mapProperties.length > 0 ? mapProperties : properties || []).filter(p => p.latitude && p.longitude).length} Properties
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

