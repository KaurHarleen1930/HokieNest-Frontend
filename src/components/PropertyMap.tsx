// src/components/PropertyMap.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import { mapAPI, PropertyMarker, Listing } from '@/lib/api';
import { SafetyControls } from '@/components/safety/SafetyControls';
import { supabase } from '@/lib/supabase';

// --- CORRECTED IMPORTS ---
import { fetchTransitStations, fetchMetroLines, TransitStation, MetroLine } from '@/services/transitService'; // Correct function
import { fetchAttractions, Attraction } from '@/services/attractionsService';
// -----------------------------

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

// --- VT Campus locations (Blacksburg) ---
const VT_CAMPUSES = [
  {
    name: 'VT Research Center – Arlington',
    lat: 38.883222,
    lng: -77.111517,
    id: 'arlington',
    radius: 2500,
  },
];

// --- Center point for DC area campuses ---
const MAP_CENTER = [38.85, -77.1] as [number, number];
// --- ADDED: Campus coordinate lookup for "Get Directions" ---
const CAMPUS_CENTERS: Record<string, { lat: number; lng: number }> = {
  academic: { lat: 38.8539, lng: -77.0503 }, // Academic Building One
  alexandria: { lat: 38.8051, lng: -77.0470 }, // Alexandria Architecture Center
  arlington: { lat: 38.8869, lng: -77.1022 }, // VT Research Center – Arlington
};
// -----------------------------------------------------------

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
  showTransit?: boolean; // <-- Prop from Properties.tsx
  showAttractions?: boolean; // <-- Prop from Properties.tsx
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

// --- ADDED: Helper for data layer icons ---
const createDataIcon = (color: string, size: number = 10) => {
  return L.divIcon({
    className: 'custom-data-marker',
    html: `<div style="background-color:${color};width:${size}px;height:${size}px;border-radius:50%;border:1px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.5);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};
const metroIcon = createDataIcon('#FF4136', 12); // Red for Metro
const busIcon = createDataIcon('#0074D9', 8); // Blue for Bus
const attractionIcon = createDataIcon('#2ECC40', 10); // Green for Attraction
// ------------------------------------------

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties = [],
  onPropertySelect,
  selectedProperty,
  className = '',
  filters = {},
  selectedCampus,
  onCampusChange,
  showTransit, // <-- Get the prop
  showAttractions, // <-- Get the prop
}) => {
  // --- Map refs/state ---
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeBaseLayerRef = useRef<L.TileLayer | null>(null);

  const markersRef = useRef<L.Marker[]>([]);
  const vtMarkersRef = useRef<L.Marker[]>([]);
  const referenceMarkersRef = useRef<L.Marker[]>([]);

  // --- ADDED: Refs for data layers ---
  const transitLayerRef = useRef<L.LayerGroup | null>(null); // For stations and stops
  const metroLinesLayerRef = useRef<L.LayerGroup | null>(null); // For the colored lines
  const attractionsLayerRef = useRef<L.LayerGroup | null>(null);
  // ---------------------------------

  const [isLoaded, setIsLoaded] = useState(false);
  const [mapProperties, setMapProperties] = useState<PropertyMarker[]>([]);
  const [referenceLocations, setReferenceLocations] = useState<any[]>([]);
  const [currentLayer, setCurrentLayer] = useState<'streets' | 'transit'>('streets');
  const [showVTMarkers, setShowVTMarkers] = useState(true);
  const [showReferenceMarkers, setShowReferenceMarkers] = useState(true);

  // --- ADDED: State for overlay data ---
  const [transitStations, setTransitStations] = useState<TransitStation[]>([]);
  const [busStops, setBusStops] = useState<TransitStation[]>([]);
  const [metroLines, setMetroLines] = useState<MetroLine[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  // -------------------------------------

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

    // Create panes for layering
    if (!map.getPane('vtPane')) {
      map.createPane('vtPane');
      const pane = map.getPane('vtPane');
      if (pane) (pane.style as any).zIndex = '700'; // VT campuses on top
    }
    if (!map.getPane('refPane')) {
      map.createPane('refPane');
      const pane = map.getPane('refPane');
      if (pane) (pane.style as any).zIndex = '650'; // Properties
    }
    // --- ADDED: Pane for data overlays ---
    if (!map.getPane('dataPane')) {
      map.createPane('dataPane');
      const pane = map.getPane('dataPane');
      if (pane) (pane.style as any).zIndex = '600'; // Data layers (transit, attractions)
    }
    if (!map.getPane('linePane')) {
      map.createPane('linePane');
      const pane = map.getPane('linePane');
      if (pane) (pane.style as any).zIndex = '500'; // Metro lines (below markers)
    }
    // -------------------------------------

    // track bbox for safety queries
    const b0 = map.getBounds();
    setBbox([b0.getWest(), b0.getSouth(), b0.getEast(), b0.getNorth()]);
    map.on('moveend', () => {
      const b = map.getBounds();
      setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    });

    setIsLoaded(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // --- MODIFIED: Fetch overlay data ---
  useEffect(() => {
    const fetchOverlayData = async () => {
      try {
        // Fetch all data points using the correct function
        const [stationsRes, stopsRes, attractionsRes, linesRes] = await Promise.all([
          fetchTransitStations({ type: 'metro' }), // <-- CORRECTED
          fetchTransitStations({ type: 'bus_stop' }), // <-- CORRECTED
          fetchAttractions(),
          fetchMetroLines() // <-- ADDED
        ]);
        
        if (stationsRes.success) setTransitStations(stationsRes.data);
        if (stopsRes.success) setBusStops(stopsRes.data);
        if (attractionsRes.success) setAttractions(attractionsRes.data);
        if (linesRes.success) setMetroLines(linesRes.data); // <-- ADDED

        console.log(`[PropertyMap] Fetched ${stationsRes.data.length} stations, ${stopsRes.data.length} stops, ${linesRes.data.length} lines, ${attractionsRes.data.length} attractions.`);

      } catch (error) {
        console.error("PropertyMap: Error fetching overlay data:", error);
      }
    };
    fetchOverlayData();
  }, []); // Runs once on load
  // ---------------------------------

  // --- Fetch map data ---
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        // If caller passed properties, use them and skip backend markers call
        if (Array.isArray(properties) && properties.length > 0) {
          setMapProperties(properties as any);
        } else {
          // fetch markers with a light retry; if it fails, leave mapProperties empty
          let propsData: any[] = [];
          let ok = false;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              propsData = await mapAPI.getMapMarkers(filters);
              ok = true;
              break;
            } catch (e) {
              await new Promise(r => setTimeout(r, 400));
            }
          }
          if (ok && Array.isArray(propsData)) {
            setMapProperties(propsData);
          } else {
            console.warn('[PropertyMap] Skipping markers due to fetch failure; falling back to passed properties');
            setMapProperties(Array.isArray(properties) ? (properties as any) : []);
          }
        }

        // fetch refs with a light retry (handles cold server or transient empty)
        let refs: any[] = [];
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const r = await mapAPI.getReferenceLocations();
            if (Array.isArray(r)) refs = r;
            if (refs.length > 0) break;
          } catch (e) {
            // ignore to retry
          }
          await new Promise(r => setTimeout(r, 500));
        }
        setReferenceLocations(refs);
        console.info(`[PropertyMap] fetched refs: ${Array.isArray(refs) ? refs.length : 0}`);
      } catch (error) {
        console.error('PropertyMap: Error fetching map data:', error);
      }
    };
    fetchMapData();
  }, [filters, properties]);

  // --- Add VT campus markers ---
  const addVTCampusMarkers = (map: L.Map) => {
    VT_CAMPUSES.forEach((campus) => {
      const vtIcon = L.divIcon({
        className: 'custom-vt-marker',
        html: `
          <div style="
            background:#E87722;border:2px solid white;border-radius:50%;
            width:28px;height:28px;display:flex;align-items:center;justify-content:center;
            color:white;font-size:10px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.3);
          ">VT</div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
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
        const name = String(location.name || '').trim().toLowerCase();
        const isVT = name.includes('virginia tech') || name.startsWith('vt ') || [
          'virginia tech alexandria center',
          'virginia tech arlington center',
          'virginia tech innovation campus',
          'vt research center',
          'washington–alexandria architecture center',
          'washington-alexandria architecture center',
        ].includes(name);
        const color = isVT ? '#E87722' : (type === 'university' ? '#3B82F6' : type === 'transit' ? '#10B981' : '#8B5CF6');
        return {
          isVT, icon: L.divIcon({
            className: 'custom-reference-marker',
            html: `
            <div style="
              background:${color};border:2px solid white;border-radius:50%;
              width:24px;height:24px;display:flex;align-items:center;justify-content:center;
              color:white;font-size:10px;box-shadow:0 2px 4px rgba(0,0,0,0.3);
            ">
              ${isVT ? 'VT' : (type === 'university' ? 'U' : type === 'transit' ? 'T' : 'E')}
            </div>
          `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })
        };
      };

      const lat = Number((location as any).latitude);
      const lng = Number((location as any).longitude);
      if (!isFinite(lat) || !isFinite(lng)) return;
      const iconData = getIcon((location as any).type);
      // Exclude VT campuses from references; they are rendered separately via VT pins
      if (iconData.isVT) return;
      const marker = L.marker([lat, lng], {
        icon: iconData.icon,
        pane: 'refPane' as any,
        zIndexOffset: 800,
      })
        .addTo(map)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold">${location.name}</h3>
            <p class="text-sm text-gray-600">${location.type || 'reference'}</p>
            ${location.address ? `<p class="text-xs text-gray-500">${location.address}</p>` : ''}
          </div>
        `);

      referenceMarkersRef.current.push(marker);
    });
    console.info(`[PropertyMap] Plotted references: ${referenceMarkersRef.current.length}`);
  };

  // --- Create/refresh property markers ---
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    const map = mapInstanceRef.current;

    // clear old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const propertiesToShow =
      mapProperties.length > 0 ? mapProperties : (properties || []);

    const isDetailPage = propertiesToShow.length === 1;

    // Campus distance filter (~5 miles) if a campus is selected
    const campusFilter: any = (filters as any)?.campus ?? selectedCampus ?? null;
    const normalizeCampus = (v: any): 'innovation' | 'alexandria' | 'research' | null => {
      if (!v || v === 'All Campuses') return null;
      const s = String(v).toLowerCase().replace(/\u2013|\u2014|–|—/g, '-'); // normalize dashes
      if (s.includes('innovation') || s.includes('academic building one') || s.includes('ab1') || s === 'innovation') return 'innovation';
      if (s.includes('alexandria') || s.includes('architecture') || s === 'alexandria') return 'alexandria';
      if (s.includes('research') || s.includes('arlington') || s === 'research') return 'research';
      return null;
    };
    const key = normalizeCampus(campusFilter);
    const CENTERS: Record<'innovation' | 'alexandria' | 'research', { lat: number; lng: number }> = {
      innovation: { lat: 38.8539, lng: -77.0503 },
      alexandria: { lat: 38.8051, lng: -77.0470 },
      research: { lat: 38.8869, lng: -77.1022 },
    };
    const R = 3958.8; // miles
    const distMiles = (aLat: number, aLng: number, bLat: number, bLng: number) => {
      const toRad = (d: number) => d * Math.PI / 180;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
    };
    const radiusMiles = 2;

    const filteredProps = key ? propertiesToShow.filter(p => {
      const c = CENTERS[key];
      const lat = Number((p as any).latitude);
      const lng = Number((p as any).longitude);
      if (!isFinite(lat) || !isFinite(lng)) return false;
      return distMiles(c.lat, c.lng, lat, lng) <= radiusMiles;
    }) : propertiesToShow;

    if (key) console.info(`[PropertyMap] Campus=${key}, radius=${radiusMiles}mi, results=${filteredProps.length}`);

    filteredProps.forEach((property) => {
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
      })
        .addTo(map)
        .bindPopup(`
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
              onclick="viewProperty('${property.id}')"
              class="w-full bg-orange-500 text-white px-3 py-2 rounded text-sm hover:bg-orange-600 transition-colors"
            >
              View Details
            </button>
            
            ${showTransit ? `
              <button
                onclick="getDirections(${property.latitude}, ${property.longitude})"
                class="w-full bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600 transition-colors mt-2"
              >
                Get Directions
              </button>
            ` : ''}
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

    // fit bounds logic
    if (filteredProps.length > 0 && filteredProps.some((p) => p.latitude && p.longitude)) {
      if (isDetailPage) {
        const property = filteredProps[0];
        map.setView([property.latitude!, property.longitude!], 16);
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([property.latitude!, property.longitude!], 16);
          }
        }, 100);
      } else {
        const group = new L.FeatureGroup(markersRef.current);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }

    // global helper for popup buttons
    (window as any).selectProperty = (propertyId: string) => {
      const property = filteredProps.find((p) => p.id === propertyId);
      if (property && onPropertySelect) onPropertySelect(property as any);
    };
    (window as any).viewProperty = (propertyId: string) => {
      // navigate to details route; fallback to selection if id missing
      if (propertyId) {
        window.location.href = `/properties/${propertyId}`;
      } else {
        (window as any).selectProperty?.(propertyId);
      }
    };
    
    // --- MODIFIED: "Get Directions" now uses the campus filter ---
    (window as any).getDirections = (lat: number, lng: number) => {
      // Use the 'filters' prop which contains the selected campus
      const selectedCampusKey = (filters as any)?.campus ?? selectedCampus ?? 'arlington';
      const destination = CAMPUS_CENTERS[selectedCampusKey] || CAMPUS_CENTERS.arlington;
      const destinationCoords = `${destination.lat},${destination.lng}`;

      const url = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${destinationCoords}&travelmode=transit`;
      window.open(url, '_blank');
    };
    // --- End of modification ---

  }, [mapProperties, properties, selectedProperty, isLoaded, onPropertySelect, filters, selectedCampus, showTransit]); // Added showTransit

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
  
  // --- MODIFIED: Toggle Transit data layer ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;

    // Always set base layer based on prop
    setCurrentLayer(showTransit ? 'transit' : 'streets');

    // Clear previous marker layers
    if (transitLayerRef.current) {
      map.removeLayer(transitLayerRef.current);
      transitLayerRef.current = null;
    }
    if (metroLinesLayerRef.current) {
      map.removeLayer(metroLinesLayerRef.current);
      metroLinesLayerRef.current = null;
    }

    // If toggled on, add new layers
    if (showTransit) {
      // 1. Add Station and Stop Markers
      const stations = transitStations.map(station => {
        return L.marker([station.latitude, station.longitude], {
          icon: metroIcon,
          pane: 'dataPane'
        }).bindPopup(`<b>${station.name}</b><br>Metro Station`);
      });
      
      const stops = busStops.map(stop => {
         return L.marker([stop.latitude, stop.longitude], {
          icon: busIcon,
          pane: 'dataPane'
        }).bindPopup(`<b>${stop.name}</b><br>Bus Stop`);
      });

      const stationLayerGroup = L.layerGroup([...stations, ...stops]);
      stationLayerGroup.addTo(map);
      transitLayerRef.current = stationLayerGroup;
      
      // 2. Add Metro Lines
      try {
        const linesLayer = L.geoJSON(undefined, {
          pane: 'linePane', // Draw lines below markers
          style: (feature) => {
            return {
              color: feature?.properties.color || '#888888',
              weight: 4,
              opacity: 0.7
            };
          },
          onEachFeature: (feature, layer) => {
            layer.bindPopup(feature.properties.name);
          }
        });

        let linesDrawn = 0;
        metroLines.forEach(line => {
          if (line.route_path && (line.route_path.type === "MultiLineString" || line.route_path.type === "LineString")) {
            // Re-format as a valid GeoJSON Feature
            const lineFeature = {
              "type": "Feature",
              "properties": {
                "name": line.route_name,
                "color": line.line_color || '#888888'
              },
              "geometry": line.route_path
            };
            linesLayer.addData(lineFeature as any);
            linesDrawn++;
          }
        });
        
        console.log(`[PropertyMap] Added ${linesDrawn} metro lines to map.`);
        linesLayer.addTo(map);
        metroLinesLayerRef.current = linesLayer;

      } catch (e) {
        console.error("Failed to draw Metro lines:", e);
      }
    }
  }, [showTransit, isLoaded, transitStations, busStops, metroLines]);
  
  // --- MODIFIED: Toggle Attractions data layer ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;

    // Clear previous layer
    if (attractionsLayerRef.current) {
      map.removeLayer(attractionsLayerRef.current);
      attractionsLayerRef.current = null;
    }

    // If toggled on, add new layer
    if (showAttractions) {
      const attractionMarkers = attractions.map(attraction => {
        return L.marker([attraction.latitude, attraction.longitude], {
          icon: attractionIcon,
          pane: 'dataPane'
        }).bindPopup(`<b>${attraction.name}</b><br>${attraction.category}`);
      });

      const layerGroup = L.layerGroup(attractionMarkers);
      layerGroup.addTo(map);
      attractionsLayerRef.current = layerGroup;
    }
  }, [showAttractions, isLoaded, attractions]);
  // ------------------------------------------

  // --- Toggle VT markers ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;

    vtMarkersRef.current.forEach((m) => map.removeLayer(m));
    vtMarkersRef.current = [];
    if (showVTMarkers) addVTCampusMarkers(map);
  }, [showVTMarkers, isLoaded]);

  // --- Render VT reference locations in orange; controlled by VT toggle and Campus filter ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;
    if (!showVTMarkers) return;

    // Ensure VT pane exists (avoids appendChild on undefined)
    if (!map.getPane('vtPane')) {
      map.createPane('vtPane');
      const pane = map.getPane('vtPane');
      if (pane) (pane.style as any).zIndex = '700';
    }

    // Remove previously added VT ref markers
    vtMarkersRef.current.forEach((m) => map.removeLayer(m));
    vtMarkersRef.current = [];

    const vtIcon = L.divIcon({
      className: 'custom-vt-marker',
      html: `
        <div style="
          background:#E87722;border:2px solid white;border-radius:50%;
          width:28px;height:28px;display:flex;align-items:center;justify-content:center;
          color:white;font-size:10px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.3);
        ">VT</div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    // HARD-CODED VT POINTS (bypass API)
    const vtPoints: Array<{ key: 'innovation' | 'alexandria' | 'research'; name: string; lat: number; lng: number; address?: string }> = [
      { key: 'innovation', name: 'Academic Building One (Northern VA)', lat: 38.8539, lng: -77.0503 },
      { key: 'alexandria', name: 'Washington–Alexandria Architecture Center', lat: 38.8051, lng: -77.0470, address: '1021 Prince St, Alexandria, VA' },
      { key: 'research', name: 'VT Research Center – Arlington', lat: 38.8869, lng: -77.1022, address: '900 N Glebe Rd, Arlington, VA' },
    ];

    const campusFilter: any = (filters as any)?.campus ?? selectedCampus ?? null;
    const normalizeCampus = (v: any): 'innovation' | 'alexandria' | 'research' | null => {
      if (!v || v === 'All Campuses') return null;
      const s = String(v).toLowerCase();
      if (s.includes('academic') || s.includes('innovation')) return 'innovation';
      if (s.includes('alexandria') || s.includes('architecture')) return 'alexandria';
      if (s.includes('research') || s.includes('arlington')) return 'research';
      return null;
    };
    const selectedKey = normalizeCampus(campusFilter);

    vtPoints
      .filter(p => !selectedKey || p.key === selectedKey)
      .forEach((p) => {
        const marker = L.marker([p.lat, p.lng], { icon: vtIcon, pane: 'vtPane' as any, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(`
            <div class="p-2">
              <h3 class="font-bold text-orange-600">${p.name}</h3>
              ${p.address ? `<p class="text-xs text-gray-600">${p.address}</p>` : ''}
            </div>
          `);
        vtMarkersRef.current.push(marker);
      });
  }, [referenceLocations, isLoaded, showVTMarkers, filters, selectedCampus]);

  // --- Toggle reference markers ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;

    console.info(`[PropertyMap] Ref toggle: ${showReferenceMarkers}, refs in state=${referenceLocations.length}`);

    // remove markers we created and any lingering reference markers on the map
    referenceMarkersRef.current.forEach((m) => map.removeLayer(m));
    referenceMarkersRef.current = [];
    map.eachLayer((layer: any) => {
      if (layer instanceof (L as any).Marker && layer._icon?.className?.includes('custom-reference-marker')) {
        map.removeLayer(layer);
      }
    });

    const ensureAndDraw = async () => {
      let refs = referenceLocations;
      if (showReferenceMarkers && refs.length === 0) {
        try {
          refs = await mapAPI.getReferenceLocations();
          setReferenceLocations(refs);
          console.info(`[PropertyMap] re-fetched refs on toggle: ${refs.length}`);
        } catch (e) {
          console.error('PropertyMap: failed to fetch refs on toggle', e);
          refs = [];
        }
      }
      if (showReferenceMarkers && refs.length > 0) {
        addReferenceLocationMarkers(map);
      }
    };

    ensureAndDraw();
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
                ${f.properties?.details?.BLOCK
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
                className={`px-2 py-1 text-xs rounded transition-colors ${currentLayer === 'streets' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Streets
              </button>
              <button
                onClick={() => setCurrentLayer('transit')}
                className={`px-2 py-1 text-xs rounded transition-colors ${currentLayer === 'transit' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                className={`px-2 py-1 text-xs rounded transition-colors ${showVTMarkers ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {showVTMarkers ? 'Hide' : 'Show'}
              </button>

              <MapPin className="h-3 w-3 text-green-500 ml-1" />
              <span className="text-xs font-medium text-gray-700">Ref:</span>
              <button
                onClick={() => setShowReferenceMarkers((v) => !v)}
                className={`px-2 py-1 text-xs rounded transition-colors ${showReferenceMarkers ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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