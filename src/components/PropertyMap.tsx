// src/components/PropertyMap.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import { mapAPI, PropertyMarker, Listing } from '@/lib/api';
import { SafetyControls } from '@/components/safety/SafetyControls';
import { supabase } from '@/lib/supabase';

import {
  MapPin,
  Navigation,
  Zap,
  Building,
} from 'lucide-react';

// --- Fix for default markers in Leaflet with Vite ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// --- VT Campus locations (DC area only) ---
const VT_CAMPUSES = [
  {
    name: 'VT Research Center – Arlington',
    lat: 38.883222,
    lng: -77.111517,
    id: 'arlington',
    radius: 2500,
  },
  {
    name: 'Washington–Alexandria Architecture Center',
    lat: 38.806012,
    lng: -77.050518,
    id: 'alexandria',
    radius: 2500,
  },
  {
    name: 'Academic Building One (Northern VA)',
    lat: 38.947211,
    lng: -77.336989,
    id: 'academic',
    radius: 3000,
  },
];

// --- Center point for DC area campuses ---
const MAP_CENTER = [38.85, -77.1] as [number, number];

// --- Base map layers ---
const mapLayers = {
  streets: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }),
  transit: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }
  ),
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
    campus?: string | null;
  };
  selectedCampus?: string | null;
  onCampusChange?: (campusId: string | null) => void;
}

// --- Safety types/state helpers ---
type SafetyMode = 'heat' | 'points';
type Preset = '7d' | '30d' | '90d' | '1y';
const presetWindow = (p: Preset) => {
  const to = new Date();
  const from = new Date(to);
  const days = p === '7d' ? 7 : p === '30d' ? 30 : p === '90d' ? 90 : 365;
  from.setDate(to.getDate() - days);
  return { from, to };
};

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties = [],
  onPropertySelect,
  selectedProperty,
  className = '',
  filters = {},
  selectedCampus,
  onCampusChange,
}) => {
  // --- Map refs/state ---
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeBaseLayerRef = useRef<L.TileLayer | null>(null);

  const markersRef = useRef<L.Marker[]>([]);
  const vtMarkersRef = useRef<L.Marker[]>([]);
  const referenceMarkersRef = useRef<L.Marker[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [mapProperties, setMapProperties] = useState<PropertyMarker[]>([]);
  const [referenceLocations, setReferenceLocations] = useState<any[]>([]);
  const [currentLayer, setCurrentLayer] = useState<'streets' | 'transit'>('streets');
  const [showVTMarkers, setShowVTMarkers] = useState(true);
  const [showReferenceMarkers, setShowReferenceMarkers] = useState(true);

  // --- Safety state/refs (from Mohammad) ---
  const [safetyOn, setSafetyOn] = useState(false);
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('heat');
  const [preset, setPreset] = useState<Preset>('30d');
  const [incidentCount, setIncidentCount] = useState<number | null>(null);
  const heatLayerRef = useRef<any>(null);
  const pointsLayerRef = useRef<L.LayerGroup | null>(null);
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);

  // --- Initialize map ---
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView(MAP_CENTER, 11);
    mapInstanceRef.current = map;

    // add default base layer
    activeBaseLayerRef.current = mapLayers.streets.addTo(map);

    // track bbox for safety queries with throttling
    const b0 = map.getBounds();
    setBbox([b0.getWest(), b0.getSouth(), b0.getEast(), b0.getNorth()]);
    
    let bboxTimeout: NodeJS.Timeout;
    map.on('moveend', () => {
      clearTimeout(bboxTimeout);
      bboxTimeout = setTimeout(() => {
        const b = map.getBounds();
        setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      }, 300); // Throttle to 300ms
    });

    setIsLoaded(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // --- Fetch map data ---
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const [propertiesData, referenceData] = await Promise.all([
          mapAPI.getMapMarkers(filters),
          mapAPI.getReferenceLocations(),
        ]);
        setMapProperties(propertiesData);
        setReferenceLocations(referenceData);
      } catch (error) {
        console.error('PropertyMap: Error fetching map data:', error);
      }
    };
    fetchMapData();
  }, [filters]);

  // --- Add VT campus markers ---
  const addVTCampusMarkers = (map: L.Map) => {
    VT_CAMPUSES.forEach((campus) => {
      const vtIcon = L.divIcon({
        className: 'custom-vt-marker',
        html: `
          <div style="
            background:#E87722;border:2px solid white;border-radius:50%;
            width:32px;height:32px;display:flex;align-items:center;justify-content:center;
            font-weight:bold;color:white;font-size:10px;box-shadow:0 2px 4px rgba(0,0,0,0.3);
          ">VT</div>
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

  // --- Add reference location markers ---
  const addReferenceLocationMarkers = (map: L.Map) => {
    referenceLocations.forEach((location) => {
      const getIcon = (type: string) => {
        const color =
          type === 'university' ? '#3B82F6' : type === 'transit' ? '#10B981' : '#8B5CF6';
        return L.divIcon({
          className: 'custom-reference-marker',
          html: `
            <div style="
              background:${color};border:2px solid white;border-radius:50%;
              width:24px;height:24px;display:flex;align-items:center;justify-content:center;
              color:white;font-size:10px;box-shadow:0 2px 4px rgba(0,0,0,0.3);
            ">
              ${type === 'university' ? 'U' : type === 'transit' ? 'T' : 'E'}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
      };

      const marker = L.marker([location.latitude, location.longitude], {
        icon: getIcon(location.type),
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

  // --- Debounced marker update function ---
  const updateMarkersDebounced = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (!mapInstanceRef.current || !isLoaded) return;
          updateMarkers();
        }, 150); // 150ms debounce
      };
    })(),
    []
  );

  // --- Memoized properties to show ---
  const propertiesToShow = useMemo(() => {
    return mapProperties.length > 0 ? mapProperties : (properties || []);
  }, [mapProperties, properties]);

  // --- Optimized marker update function ---
  const updateMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    const map = mapInstanceRef.current;

    // Only update if properties actually changed
    const currentMarkerIds = markersRef.current.reduce((acc, marker) => {
      const id = (marker as any).propertyId;
      if (id) acc.add(id);
      return acc;
    }, new Set<string>());

    const newMarkerIds = new Set(propertiesToShow.map(p => p.id));

    // Check if we need to update markers
    const needsUpdate = 
      markersRef.current.length !== propertiesToShow.length ||
      [...currentMarkerIds].some(id => !newMarkerIds.has(id)) ||
      [...newMarkerIds].some(id => !currentMarkerIds.has(id));

    if (!needsUpdate && selectedProperty) {
      // Just update selected marker styling
      markersRef.current.forEach(marker => {
        const markerId = (marker as any).propertyId;
        const isSelected = selectedProperty?.id === markerId;
        // Update icon if needed - could be optimized further
      });
      return;
    }

    // clear old markers only if we need a full update
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const isDetailPage = propertiesToShow.length === 1;

    propertiesToShow.forEach((property) => {
      if (!property.latitude || !property.longitude) return;

      const isSelected = selectedProperty?.id === property.id;
      const title = (property as any).name || (property as any).title || 'Property';
      const address = property.address;
      const price = (property as any).rent_min || (property as any).price || 0;

      const propertyIcon = L.divIcon({
        className: 'custom-property-marker',
        html: isDetailPage
          ? `
            <div style="
              background:#E87722;border:3px solid white;border-radius:50% 50% 50% 0;
              width:30px;height:30px;display:flex;align-items:center;justify-content:center;
              color:white;font-size:16px;font-weight:bold;box-shadow:0 4px 8px rgba(0,0,0,0.3);
              transform:rotate(-45deg);
            ">
              <span style="transform:rotate(45deg);">📍</span>
            </div>
          `
          : `
            <div style="
              background:${isSelected ? '#E87722' : '#3B82F6'};
              border:2px solid white;border-radius:50%;
              width:${isSelected ? '24px' : '20px'};
              height:${isSelected ? '24px' : '20px'};
              display:flex;align-items:center;justify-content:center;
              color:white;font-size:10px;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.3);
              transform:${isSelected ? 'scale(1.2)' : 'scale(1)'};
            ">
              ${isSelected ? '★' : 'P'}
            </div>
          `,
        iconSize: isDetailPage ? [30, 30] : isSelected ? [24, 24] : [20, 20],
        iconAnchor: isDetailPage ? [15, 30] : isSelected ? [12, 12] : [10, 10],
      });

      const marker = L.marker([property.latitude, property.longitude], {
        icon: propertyIcon,
      }) as L.Marker & { propertyId: string };
      
      // Store property ID for optimization
      marker.propertyId = property.id;
      
      marker.addTo(map).bindPopup(`
          <div class="p-3 min-w-[200px]">
            <h3 class="font-bold text-lg mb-2">${title}</h3>
            <p class="text-sm text-gray-600 mb-2">${address ?? ''}</p>
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
            ${(property as any).distanceFromCampus
              ? `<div class="text-xs text-gray-600 mb-2">📍 ${(property as any).distanceFromCampus} miles from ${(property as any).nearestCampus?.name || 'VT Campus'}</div>`
              : ''
            }
            <button
              onclick="selectProperty('${property.id}')"
              class="w-full bg-orange-500 text-white px-3 py-2 rounded text-sm hover:bg-orange-600 transition-colors"
            >
              View Details
            </button>
          </div>
        `);

      marker.on('click', () => {
        onPropertySelect?.(property as any);
        if (!isDetailPage && mapInstanceRef.current) {
          mapInstanceRef.current.setView([property.latitude!, property.longitude!], 16, {
            animate: true,
            duration: 1,
          } as any);
        }
      });

      markersRef.current.push(marker);
    });

    // fit bounds logic - prioritize selected property over fitting all markers
    if (propertiesToShow.length > 0 && propertiesToShow.some((p) => p.latitude && p.longitude)) {
      if (isDetailPage) {
        // Detail page: center on the single property
        const property = propertiesToShow[0];
        map.setView([property.latitude!, property.longitude!], 16);
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([property.latitude!, property.longitude!], 16);
          }
        }, 100);
      } else if (selectedProperty && selectedProperty.latitude && selectedProperty.longitude) {
        // Property is selected: center on selected property instead of fitting all
        map.setView([selectedProperty.latitude, selectedProperty.longitude], 16, {
          animate: true,
          duration: 0.5
        });
      } else {
        // No property selected: fit to show all markers
        const group = new L.FeatureGroup(markersRef.current);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }

    // global helper for popup button
    (window as any).selectProperty = (propertyId: string) => {
      const property = propertiesToShow.find((p) => p.id === propertyId);
      if (property && onPropertySelect) onPropertySelect(property as any);
    };
  }, [propertiesToShow, selectedProperty, isLoaded, onPropertySelect]);

  // --- Use debounced marker updates ---
  useEffect(() => {
    if (mapInstanceRef.current && isLoaded) {
      updateMarkers();
    }
  }, [propertiesToShow, selectedProperty, isLoaded]);

  // --- Ensure selected property is centered after marker updates ---
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !selectedProperty) return;
    
    // Small delay to ensure markers are updated first
    const timer = setTimeout(() => {
      if (mapInstanceRef.current && selectedProperty.latitude && selectedProperty.longitude) {
        mapInstanceRef.current.setView([selectedProperty.latitude, selectedProperty.longitude], 16, {
          animate: true,
          duration: 0.5
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedProperty, isLoaded]);

  // --- Detail page re-center safeguard ---
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    const isDetailPage = properties.length === 1;
    if (isDetailPage && properties[0]?.latitude && properties[0]?.longitude) {
      const p = properties[0];
      mapInstanceRef.current.setView([p.latitude, p.longitude], 16);
    }
  }, [properties, isLoaded]);

  // --- Campus selection centers map ---
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !selectedCampus) return;
    const campus = VT_CAMPUSES.find((c) => c.id === selectedCampus);
    if (campus) {
      mapInstanceRef.current.setView([campus.lat, campus.lng], 13, { animate: true, duration: 1 } as any);
    }
  }, [selectedCampus, isLoaded]);

  // --- Base layer switching ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;

    if (activeBaseLayerRef.current) {
      map.removeLayer(activeBaseLayerRef.current);
    }
    const next = currentLayer === 'streets' ? mapLayers.streets : mapLayers.transit;
    next.addTo(map);
    activeBaseLayerRef.current = next;
  }, [currentLayer, isLoaded]);

  // --- Toggle VT markers ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;

    vtMarkersRef.current.forEach((m) => map.removeLayer(m));
    vtMarkersRef.current = [];
    if (showVTMarkers) addVTCampusMarkers(map);
  }, [showVTMarkers, isLoaded]);

  // --- Toggle reference markers ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;

    referenceMarkersRef.current.forEach((m) => map.removeLayer(m));
    referenceMarkersRef.current = [];
    if (showReferenceMarkers && referenceLocations.length > 0) {
      addReferenceLocationMarkers(map);
    }
  }, [showReferenceMarkers, referenceLocations, isLoaded]);

  // --- Safety overlay render/update ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !bbox) return;

    // clear old safety layers
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    if (pointsLayerRef.current) {
      map.removeLayer(pointsLayerRef.current);
      pointsLayerRef.current = null;
    }

    if (!safetyOn) {
      setIncidentCount(null);
      return;
    }

    const run = async () => {
      const { from, to } = presetWindow(preset);
      const [west, south, east, north] = bbox!;
      const { data, error } = await supabase.rpc('incidents_geojson', {
        start_ts: from.toISOString(),
        end_ts: to.toISOString(),
        min_lat: south,
        min_lng: west,
        max_lat: north,
        max_lng: east,
        limit_rows: 5000,
      });

      if (error || !data) {
        console.warn('incidents_geojson error', error);
        setIncidentCount(null);
        return;
      }

      const features: any[] = Array.isArray(data.features) ? data.features : [];
      const count = features.length;
      setIncidentCount(count);
      if (count === 0) return;

      if (safetyMode === 'heat') {
        const pts = features.map((f: any) => {
          const [lng, lat] = f.geometry.coordinates;
          const w = Math.max(0.2, Math.min(1, (f.properties?.severity ?? 1) / 3));
          return [lat, lng, w] as [number, number, number];
        });
        const layer = (L as any).heatLayer(pts, { radius: 18 });
        layer.addTo(map);
        heatLayerRef.current = layer;
      } else {
        const g = L.layerGroup();
        features.forEach((f: any) => {
          const [lng, lat] = f.geometry.coordinates;
          const sev = f.properties?.severity ?? 0;
          const color = sev >= 3 ? '#dc2626' : sev === 2 ? '#f59e0b' : sev === 1 ? '#22c55e' : '#6b7280';
          L.circleMarker([lat, lng], { radius: 6, color, weight: 1, fillOpacity: 0.85 })
            .bindPopup(`
              <div style="min-width:180px">
                <div style="font-weight:600">${f.properties?.type ?? 'Incident'}</div>
                <div style="font-size:12px;color:#555">${new Date(f.properties?.occurred_at).toLocaleString()}</div>
                ${
                  f.properties?.details?.BLOCK
                    ? `<div style="font-size:12px;margin-top:4px">${f.properties.details.BLOCK}</div>`
                    : ''
                }
                ${f.properties?.source ? `<div style="font-size:11px;color:#777;margin-top:4px">Source: ${f.properties.source}</div>` : ''}
              </div>
            `)
            .addTo(g);
        });
        g.addTo(map);
        pointsLayerRef.current = g;
      }
    };

    run();
  }, [safetyOn, safetyMode, preset, bbox, isLoaded]);

  // --- Small helpers for her controls ---
  const centerMap = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.setView(MAP_CENTER, 11);
  };
  const fitToMarkers = () => {
    const map = mapInstanceRef.current;
    if (!map || markersRef.current.length === 0) return;
    const group = new L.FeatureGroup(markersRef.current);
    map.fitBounds(group.getBounds().pad(0.1));
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

      {/* Map Controls Panel */}
      <div className="absolute top-2 left-2 z-[110]">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {/* Layer Controls */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-1">
              <Navigation className="h-3 w-3 text-orange-500" />
              <span className="text-xs font-medium text-gray-700">Layers:</span>
              <button
                onClick={() => setCurrentLayer('streets')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  currentLayer === 'streets' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Streets
              </button>
              <button
                onClick={() => setCurrentLayer('transit')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  currentLayer === 'transit' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

          {/* VT & Reference Toggles */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-1">
              <Building className="h-3 w-3 text-purple-500" />
              <span className="text-xs font-medium text-gray-700">VT:</span>
              <button
                onClick={() => setShowVTMarkers((v) => !v)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  showVTMarkers ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showVTMarkers ? 'Hide' : 'Show'}
              </button>

              <MapPin className="h-3 w-3 text-green-500 ml-1" />
              <span className="text-xs font-medium text-gray-700">Ref:</span>
              <button
                onClick={() => setShowReferenceMarkers((v) => !v)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  showReferenceMarkers ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showReferenceMarkers ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Legend (compact) */}
          <div className="p-2">
            <div className="flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3 text-gray-500" />
              <span className="text-xs font-medium text-gray-700">Legend:</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <span>VT</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span>Properties</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Transit</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                <span>Employers</span>
              </div>
            </div>
          </div>
        </div>
      </div>

{/* Safety Controls */}
<div className="absolute bottom-4 left-4 z-[120] pointer-events-auto">
  <SafetyControls
    enabled={safetyOn}
    onToggle={setSafetyOn}
    preset={preset}
    onPresetChange={setPreset}
    mode={safetyMode === 'heat' ? 'heat' : 'clusters'}
    onModeChange={(m) => setSafetyMode(m === 'heat' ? 'heat' : 'points')}
  />
</div>


      {/* Badges (counts) */}
      <div className="absolute top-2 right-2 z-[120] space-y-1">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span className="text-xs font-medium text-gray-800">
              {(mapProperties.length > 0 ? mapProperties : properties || []).filter(
                (p) => p.latitude && p.longitude
              ).length}{' '}
              Properties
            </span>
          </div>
        </div>
        {incidentCount !== null && safetyOn && (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1 text-xs">
            {incidentCount} incidents in view
          </div>
        )}
      </div>
    </div>
  );
};
