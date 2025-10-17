import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapAPI, PropertyMarker, Listing } from '@/lib/api';
import { MapPin, Navigation, Zap, Globe, Building, Train, Briefcase } from 'lucide-react';

// Fix for default markers in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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
  transit: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  }),
};

interface PropertyMapProps {
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

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties = [],
  onPropertySelect,
  selectedProperty,
  className = '',
  filters = {}
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const vtMarkersRef = useRef<L.Marker[]>([]);
  const referenceMarkersRef = useRef<L.Marker[]>([]);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapProperties, setMapProperties] = useState<PropertyMarker[]>([]);
  const [referenceLocations, setReferenceLocations] = useState<any[]>([]);
  const [currentLayer, setCurrentLayer] = useState<'streets' | 'transit'>('streets');
  const [showVTMarkers, setShowVTMarkers] = useState(true);
  const [showReferenceMarkers, setShowReferenceMarkers] = useState(true);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let retryCount = 0;
    const maxRetries = 50;
    
    const initMap = () => {
      if (!mapRef.current) {
        retryCount++;
        if (retryCount > maxRetries) {
          console.error('PropertyMap: Failed to initialize map after', maxRetries, 'retries');
          return;
        }
        setTimeout(initMap, 100);
      return;
    }

      // Create map - check if this is a detail page first
      const isDetailPage = properties.length === 1;
      const initialCenter = isDetailPage && properties[0]?.latitude && properties[0]?.longitude 
        ? [properties[0].latitude, properties[0].longitude] as [number, number]
        : MAP_CENTER;
      const initialZoom = isDetailPage ? 16 : 11;
      
      const map = L.map(mapRef.current).setView(initialCenter, initialZoom);

      // Add default layer
      mapLayers.streets.addTo(map);

      mapInstanceRef.current = map;
      setIsLoaded(true);

      // Add VT campus markers
      if (showVTMarkers) {
        addVTCampusMarkers(map);
      }

      // Add reference location markers
      if (showReferenceMarkers && referenceLocations.length > 0) {
        addReferenceLocationMarkers(map);
      }

    };

    initMap();
    
    // Fallback timeout to ensure loading state is cleared
    const timeout = setTimeout(() => {
      setIsLoaded(true);
    }, 5000); // 5 second timeout
    
    // Cleanup
    return () => {
      clearTimeout(timeout);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Fetch map data
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const [propertiesData, referenceData] = await Promise.all([
          mapAPI.getMapMarkers(filters),
          mapAPI.getReferenceLocations()
        ]);
        setMapProperties(propertiesData);
        setReferenceLocations(referenceData);
      } catch (error) {
        console.error('PropertyMap: Error fetching map data:', error);
        // Don't set loading to false on error, let the map initialization handle it
      }
    };

    fetchMapData();
  }, [filters]);

  // Add VT campus markers
  const addVTCampusMarkers = (map: L.Map) => {
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

      const marker = L.marker([campus.lat, campus.lng], { icon: vtIcon })
        .addTo(map)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold text-orange-600">${campus.name}</h3>
            <p class="text-sm text-gray-600">Virginia Tech Campus</p>
              </div>
        `);
      
      vtMarkersRef.current.push(marker);
    });
  };

  // Add reference location markers
  const addReferenceLocationMarkers = (map: L.Map) => {
    referenceLocations.forEach(location => {
      const getIcon = (type: string) => {
        const color = type === 'university' ? '#3B82F6' : 
                     type === 'transit' ? '#10B981' : '#8B5CF6';
        
        return L.divIcon({
          className: 'custom-reference-marker',
          html: `
            <div style="
              background: ${color};
              border: 2px solid white;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 10px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">
              ${type === 'university' ? 'U' : type === 'transit' ? 'T' : 'E'}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
      };

      const marker = L.marker([location.latitude, location.longitude], { 
        icon: getIcon(location.type) 
      })
        .addTo(map)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold">${location.name}</h3>
            <p class="text-sm text-gray-600">${location.type}</p>
            ${location.address ? `<p class="text-xs text-gray-500">${location.address}</p>` : ''}
          </div>
        `);
      
      referenceMarkersRef.current.push(marker);
    });
  };

  // Update markers when data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) {
      return;
    }

    const map = mapInstanceRef.current;

    // Clear existing property markers
    markersRef.current.forEach(marker => {
      map.removeLayer(marker);
    });
    markersRef.current = [];

    // Use mapProperties from API or fallback to props
    const propertiesToShow = mapProperties.length > 0 ? mapProperties : properties || [];
    
    // Check if this is a detail page (single property)
    const isDetailPage = propertiesToShow.length === 1;

    // Add property markers
    propertiesToShow.forEach((property, index) => {
      if (property.latitude && property.longitude) {
        const isSelected = selectedProperty?.id === property.id;
        
        // Handle both PropertyMarker and Listing types
        const title = (property as any).name || (property as any).title || 'Property';
        const address = property.address;
        const price = (property as any).rent_min || (property as any).price || 0;

        // Create custom icon - special pointer for detail page
        const propertyIcon = L.divIcon({
          className: 'custom-property-marker',
          html: isDetailPage ? `
            <div style="
              background: #E87722;
              border: 3px solid white;
              border-radius: 50% 50% 50% 0;
              width: 30px;
              height: 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 16px;
              font-weight: bold;
              box-shadow: 0 4px 8px rgba(0,0,0,0.3);
              transform: rotate(-45deg);
            ">
              <span style="transform: rotate(45deg);">📍</span>
            </div>
          ` : `
            <div style="
              background: ${isSelected ? '#E87722' : '#3B82F6'};
              border: 2px solid white;
              border-radius: 50%;
              width: ${isSelected ? '24px' : '20px'};
              height: ${isSelected ? '24px' : '20px'};
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 10px;
              font-weight: bold;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
            ">
              ${isSelected ? '★' : 'P'}
            </div>
          `,
          iconSize: isDetailPage ? [30, 30] : (isSelected ? [24, 24] : [20, 20]),
          iconAnchor: isDetailPage ? [15, 30] : (isSelected ? [12, 12] : [10, 10]),
        });

        const marker = L.marker([property.latitude, property.longitude], { 
          icon: propertyIcon 
        })
          .addTo(map)
          .bindPopup(`
            <div class="p-3 min-w-[200px]">
              <h3 class="font-bold text-lg mb-2">${title}</h3>
              <p class="text-sm text-gray-600 mb-2">${address}</p>
              <p class="text-lg font-bold text-orange-600 mb-2">
                ${price > 0 ? `$${price.toLocaleString()}/mo` : 'Call for pricing'}
              </p>
              <div class="flex gap-2 mb-3">
                <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  ${(property as any).beds || 0} bed${(property as any).beds !== 1 ? 's' : ''}
                </span>
                <span class="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                  ${(property as any).baths || 0} bath${(property as any).baths !== 1 ? 's' : ''}
                </span>
              </div>
              ${(property as any).distanceFromCampus ? `
                <div class="text-xs text-gray-600 mb-2">
                  📍 ${(property as any).distanceFromCampus} miles from ${(property as any).nearestCampus?.name || 'VT Campus'}
                </div>
              ` : ''}
              <button 
                onclick="selectProperty('${property.id}')"
                class="w-full bg-orange-500 text-white px-3 py-2 rounded text-sm hover:bg-orange-600 transition-colors"
              >
                View Details
              </button>
            </div>
          `);

        // Add click handler with zoom functionality
        marker.on('click', () => {
          if (onPropertySelect) {
            onPropertySelect(property as any);
          }
          
          // Zoom to property (unless it's already a detail page)
          if (!isDetailPage && mapInstanceRef.current) {
            mapInstanceRef.current.setView([property.latitude, property.longitude], 16, {
              animate: true,
              duration: 1
            });
          }
        });

        markersRef.current.push(marker);
      }
    });

    // Fit map to show all markers if there are properties
    if (propertiesToShow.length > 0 && propertiesToShow.some(p => p.latitude && p.longitude)) {
      if (isDetailPage) {
        // For detail page, center on the single property with higher zoom
        const property = propertiesToShow[0];
        map.setView([property.latitude, property.longitude], 16);
        
        // Ensure the map is properly centered after a short delay
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([property.latitude, property.longitude], 16);
          }
        }, 100);
      } else {
        // For properties page, fit all markers
        const group = new L.FeatureGroup(markersRef.current);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }

    // Add global function for popup button
    (window as any).selectProperty = (propertyId: string) => {
      const property = propertiesToShow.find(p => p.id === propertyId);
      if (property && onPropertySelect) {
        onPropertySelect(property as any);
      }
    };

  }, [mapProperties, properties, selectedProperty, isLoaded]);

  // Special effect for detail page centering
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    
    const isDetailPage = properties.length === 1;
    if (isDetailPage && properties[0]?.latitude && properties[0]?.longitude) {
      const property = properties[0];
      mapInstanceRef.current.setView([property.latitude, property.longitude], 16);
    }
  }, [properties, isLoaded]);

  // Handle layer switching
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const map = mapInstanceRef.current;

    // Remove all layers
    map.eachLayer((layer) => {
      if (layer !== mapLayers.streets && layer !== mapLayers.transit) {
        return; // Keep markers and other non-tile layers
      }
      map.removeLayer(layer);
    });

    // Add selected layer
    mapLayers[currentLayer].addTo(map);

  }, [currentLayer, isLoaded]);

  // Handle VT markers toggle
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const map = mapInstanceRef.current;

    if (showVTMarkers) {
      addVTCampusMarkers(map);
    } else {
      vtMarkersRef.current.forEach(marker => {
        map.removeLayer(marker);
      });
      vtMarkersRef.current = [];
    }
  }, [showVTMarkers, isLoaded]);

  // Handle reference markers toggle
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const map = mapInstanceRef.current;

    if (showReferenceMarkers && referenceLocations.length > 0) {
      addReferenceLocationMarkers(map);
    } else {
      referenceMarkersRef.current.forEach(marker => {
        map.removeLayer(marker);
      });
      referenceMarkersRef.current = [];
    }
  }, [showReferenceMarkers, referenceLocations, isLoaded]);

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

  const toggleReferenceMarkers = () => {
    setShowReferenceMarkers(!showReferenceMarkers);
  };

    return (
    <div className={`relative ${className}`} style={{ isolation: 'isolate', zIndex: 1 }}>
      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg overflow-hidden relative z-0" 
        style={{ zIndex: 0, minHeight: '600px', backgroundColor: '#f0f0f0' }}
      />
      
      {/* Loading Overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Map Controls Panel - Compact */}
      <div className="absolute top-2 left-2 z-[100]">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {/* Layer Controls */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-1">
              <Navigation className="h-3 w-3 text-orange-500" />
              <span className="text-xs font-medium text-gray-700">Layers:</span>
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
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-blue-500" />
              <span className="text-xs font-medium text-gray-700">Controls:</span>
              <button
                onClick={centerMap}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Center
              </button>
              <button
                onClick={fitToMarkers}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Fit
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-1">
              <Building className="h-3 w-3 text-purple-500" />
              <span className="text-xs font-medium text-gray-700">VT:</span>
              <button
                onClick={toggleVTMarkers}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  showVTMarkers 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showVTMarkers ? 'Hide' : 'Show'}
              </button>
              <MapPin className="h-3 w-3 text-green-500 ml-1" />
              <span className="text-xs font-medium text-gray-700">Ref:</span>
              <button
                onClick={toggleReferenceMarkers}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  showReferenceMarkers 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showReferenceMarkers ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Legend - Compact */}
          <div className="p-2">
            <div className="flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3 text-gray-500" />
              <span className="text-xs font-medium text-gray-700">Legend:</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>VT</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Properties</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Transit</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>Employers</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Property Count Badge - Compact */}
      <div className="absolute top-2 right-2 z-[100]">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-xs font-medium text-gray-800">
              {(mapProperties.length > 0 ? mapProperties : properties || []).filter(p => p.latitude && p.longitude).length} Properties
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
