// src/components/PropertyMap.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import { mapAPI, PropertyMarker, Listing } from '@/lib/api';
import { SafetyControls } from '@/components/safety/SafetyControls';
import { supabase } from '@/lib/supabase';

// --- CORRECTED IMPORTS ---
import {
  fetchTransitStations,
  fetchMetroLines,
  TransitStation,
  MetroLine,
  fetchCommuteRoute,
  CommuteRouteResponse
} from '@/services/transitService'; // Correct function
import { fetchNearbyAttractions, Attraction } from '@/services/attractionsService';
// -----------------------------

import {
  MapPin,
  Navigation,
  Zap,
  Building,
} from 'lucide-react';
import { useTheme } from 'next-themes';

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
  academic: { lat: 38.8539, lng: -77.0503 },   // Academic Building One
  alexandria: { lat: 38.8051, lng: -77.0470 }, // Alexandria Architecture Center
  arlington: { lat: 38.8869, lng: -77.1022 },  // VT Research Center – Arlington
};
// -----------------------------------------------------------

// --- Base map layer helpers ---

interface PropertyMapProps {
  properties?: Listing[];
  onPropertySelect?: (property: Listing | null) => void;
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
  showTransit?: boolean;     // <-- Prop from Properties.tsx
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

// ADDED: shared risk gradient for heatmap
const RISK_GRADIENT: Record<number, string> = {
  0.0:  '#d9f99d', // very light green
  0.35: '#84cc16', // green-yellow
  0.55: '#facc15', // yellow
  0.75: '#fb923c', // orange
  1.0:  '#dc2626', // red (highest risk)
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
const busIcon = createDataIcon('#0074D9', 8);    // Blue for Bus
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
  showTransit,     // <-- Get the prop
  showAttractions, // <-- Get the prop
}) => {
  // --- Map refs/state ---
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeBaseLayerRef = useRef<L.TileLayer | null>(null);

  const markersRef = useRef<L.Marker[]>([]);
  const vtMarkersRef = useRef<L.Marker[]>([]);
  const referenceMarkersRef = useRef<L.Marker[]>([]);
  const selectionFromMapRef = useRef(false);
  const lastSelectedPropertyIdRef = useRef<string | null>(null);

  // --- ADDED: Refs for data layers ---
  const transitLayerRef = useRef<L.LayerGroup | null>(null);    // For stations and stops
  const metroLinesLayerRef = useRef<L.LayerGroup | null>(null); // For the colored lines
  const attractionsLayerRef = useRef<L.LayerGroup | null>(null);
  const [commute, setCommute] = useState<CommuteRouteResponse['data'] | null>(null);
  const commuteLayerRef = useRef<L.LayerGroup | null>(null);
  // ---------------------------------

  const [isLoaded, setIsLoaded] = useState(false);
  const [mapProperties, setMapProperties] = useState<PropertyMarker[]>([]);
  const [referenceLocations, setReferenceLocations] = useState<any[]>([]);
  const [currentLayer, setCurrentLayer] = useState<'streets' | 'transit'>('streets');
  const [showVTMarkers, setShowVTMarkers] = useState(true);
  const [showReferenceMarkers, setShowReferenceMarkers] = useState(true);

  const { resolvedTheme } = useTheme();

  const baseLayers = useMemo(() => ({
    streets: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }),
  }), []);

  const createTransitLayer = useCallback(
    () =>
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }),
    []
  );

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
  const safetyOnRef = useRef<boolean>(safetyOn);
  useEffect(() => {
    safetyOnRef.current = safetyOn;
  }, [safetyOn]);
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);

  const handleClearSelection = useCallback(() => {
    selectionFromMapRef.current = false;
    lastSelectedPropertyIdRef.current = null;
    mapInstanceRef.current?.closePopup();
    onPropertySelect?.(null);
  }, [onPropertySelect]);

  // --- Initialize map ---
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      doubleClickZoom: false,
    }).setView(MAP_CENTER, 11);
    mapInstanceRef.current = map;

    // add default base layer
    activeBaseLayerRef.current = baseLayers.streets.addTo(map);

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
  }, [baseLayers]);

  // --- MODIFIED: Fetch overlay data ---
  useEffect(() => {
    const fetchOverlayData = async () => {
      try {
        const [stationsRes, stopsRes, linesRes] = await Promise.all([
          fetchTransitStations({ type: 'metro' }),
          fetchTransitStations({ type: 'bus_stop' }),
          fetchMetroLines(),
        ]);

        if (stationsRes.success) setTransitStations(stationsRes.data);
        if (stopsRes.success) setBusStops(stopsRes.data);
        if (linesRes.success) setMetroLines(linesRes.data);

        console.log(
          `[PropertyMap] Fetched ${stationsRes.data.length} stations, ${stopsRes.data.length} stops, ${linesRes.data.length} lines.`
        );
      } catch (error) {
        console.error('PropertyMap: Error fetching overlay data:', error);
      }
    };
    fetchOverlayData();
  }, []);
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
          background:hsl(var(--primary));border:2px solid hsl(var(--background));border-radius:50%;
            width:28px;height:28px;display:flex;align-items:center;justify-content:center;
          color:hsl(var(--primary-foreground));font-size:10px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.3);
          ">VT</div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([campus.lat, campus.lng], { icon: vtIcon })
        .addTo(map)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold" style="color:hsl(var(--primary));">${campus.name}</h3>
            <p class="text-sm" style="color:hsl(var(--map-popup-subtext));">Virginia Tech Campus</p>
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
        const color = isVT
          ? 'hsl(var(--primary))'
          : type === 'university'
            ? 'hsl(var(--map-marker-accent))'
            : type === 'transit'
              ? 'hsl(var(--accent))'
              : 'hsl(var(--primary-dark))';
        return {
          isVT, icon: L.divIcon({
            className: 'custom-reference-marker',
            html: `
            <div style="
              background:${color};border:2px solid hsl(var(--background));border-radius:50%;
              width:24px;height:24px;display:flex;align-items:center;justify-content:center;
              color:hsl(var(--primary-foreground));font-size:10px;box-shadow:0 2px 4px rgba(0,0,0,0.3);
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
            <p class="text-sm text-muted-foreground">${location.type || 'reference'}</p>
            ${location.address ? `<p class="text-xs text-muted-foreground/80">${location.address}</p>` : ''}
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
              background:hsl(var(--map-marker-selected));border:3px solid hsl(var(--background));border-radius:50% 50% 50% 0;
              width:30px;height:30px;display:flex;align-items:center;justify-content:center;
              color:hsl(var(--primary-foreground));font-size:16px;font-weight:bold;box-shadow:0 4px 8px rgba(0,0,0,0.4);
              transform:rotate(-45deg);
            ">
              <span style="transform:rotate(45deg);">📍</span>
            </div>
          `
          : `
            <div style="
              background:${isSelected ? 'hsl(var(--map-marker-selected))' : 'hsl(var(--map-marker-primary))'};
              border:2px solid hsl(var(--background));border-radius:50%;
              width:${isSelected ? '24px' : '20px'};
              height:${isSelected ? '24px' : '20px'};
              display:flex;align-items:center;justify-content:center;
              color:hsl(var(--primary-foreground));font-size:10px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.28);
              transform:${isSelected ? 'scale(1.15)' : 'scale(1)'};
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
          <div style="min-width:220px;padding:12px;color:hsl(var(--map-popup-text));">
            <h3 style="margin:0 0 8px 0;font-weight:700;font-size:16px;color:hsl(var(--map-popup-text));">${title}</h3>
            <p style="margin:0 0 8px 0;font-size:13px;color:hsl(var(--map-popup-subtext));">
              ${address ?? ''}
            </p>
            <p style="margin:0 0 12px 0;font-weight:700;font-size:15px;color:hsl(var(--accent));">
              ${price > 0 ? `$${price.toLocaleString()}/mo` : 'Call for pricing'}
            </p>
            <div style="display:flex;gap:8px;margin-bottom:12px;">
              <span style="padding:4px 8px;background:hsl(var(--map-marker-accent));color:hsl(var(--primary-foreground));border-radius:6px;font-size:11px;font-weight:600;">
                ${(property as any).beds || 0} bed${(property as any).beds !== 1 ? 's' : ''}
              </span>
              <span style="padding:4px 8px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));border-radius:6px;font-size:11px;font-weight:600;">
                ${(property as any).baths || 0} bath${(property as any).baths !== 1 ? 's' : ''}
              </span>
            </div>
            ${(property as any).distanceFromCampus
            ? `<div style="font-size:11px;color:hsl(var(--map-popup-subtext));margin-bottom:12px;">📍 ${(property as any).distanceFromCampus} miles from ${(property as any).nearestCampus?.name || 'VT Campus'}</div>`
            : ''}
            <button
              onclick="viewProperty('${property.id}')"
              style="
                width:100%;
                background:hsl(var(--primary));
                color:hsl(var(--primary-foreground));
                padding:8px 12px;
                border:none;
                border-radius:6px;
                font-size:13px;
                font-weight:600;
                cursor:pointer;
                transition:filter 0.2s ease;
              "
              onmouseover="this.style.filter='brightness(1.05)'"
              onmouseout="this.style.filter=''"
            >
              View Details
            </button>
            ${showTransit ? `
              <button
                onclick="getDirections(${property.latitude}, ${property.longitude})"
                style="
                  width:100%;
                  background:hsl(var(--map-marker-accent));
                  color:hsl(var(--primary-foreground));
                  padding:8px 12px;
                  border:none;
                  border-radius:6px;
                  font-size:13px;
                  font-weight:600;
                  cursor:pointer;
                  margin-top:8px;
                  transition:filter 0.2s ease;
                "
                onmouseover="this.style.filter='brightness(1.05)'"
                onmouseout="this.style.filter=''"
              >
                Get Directions
              </button>
            ` : ''}
          </div>
        `);

      marker.on('click', () => {
        selectionFromMapRef.current = true;
        onPropertySelect?.(property as any);
        marker.openPopup();
      });

      marker.on('dblclick', (event: L.LeafletMouseEvent) => {
        event.originalEvent?.preventDefault();
        event.originalEvent?.stopPropagation();
        const map = mapInstanceRef.current;
        if (map) {
          map.setView([property.latitude!, property.longitude!], 16, {
            animate: true,
            duration: 1,
          } as any);
        }
      });

      markersRef.current.push(marker);
    });

    // fit bounds logic
    if (!selectedProperty) {
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
      lastSelectedPropertyIdRef.current = null;
    } else if (selectedProperty.latitude && selectedProperty.longitude) {
      const alreadySelected =
        lastSelectedPropertyIdRef.current === selectedProperty.id;
      if (!selectionFromMapRef.current && !alreadySelected) {
        map.setView([selectedProperty.latitude, selectedProperty.longitude], 16, {
          animate: true,
          duration: 1,
        } as any);
      }
      const marker = markersRef.current.find(
        (m) =>
          Math.abs(m.getLatLng().lat - Number(selectedProperty.latitude)) < 1e-6 &&
          Math.abs(m.getLatLng().lng - Number(selectedProperty.longitude)) < 1e-6
      );
      if (marker && !selectionFromMapRef.current && !alreadySelected) {
        marker.openPopup();
      }
      lastSelectedPropertyIdRef.current = selectedProperty.id ?? null;
    }
    selectionFromMapRef.current = false;

    // global helper for popup buttons
    (window as any).selectProperty = (propertyId: string) => {
      const property = filteredProps.find((p) => p.id === propertyId);
      if (property && onPropertySelect) onPropertySelect(property as any);
    };
    (window as any).viewProperty = (propertyId: string) => {
      if (propertyId) {
        window.location.href = `/properties/${propertyId}`;
      } else {
        (window as any).selectProperty?.(propertyId);
      }
    };

    // --- MODIFIED: "Get Directions" now uses the campus filter ---
    (window as any).getDirections = (lat: number, lng: number) => {
      const selectedCampusKey = (filters as any)?.campus ?? selectedCampus ?? 'arlington';
      const destination = CAMPUS_CENTERS[selectedCampusKey] || CAMPUS_CENTERS.arlington;
      const destinationCoords = `${destination.lat},${destination.lng}`;

      const url = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${destinationCoords}&travelmode=transit`;
      window.open(url, '_blank');
    };
    // --- End of modification ---

  }, [mapProperties, properties, selectedProperty, isLoaded, onPropertySelect, filters, selectedCampus, showTransit, resolvedTheme]);

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
      activeBaseLayerRef.current = null;
    }

    if (currentLayer === 'transit') {
      const transitLayer = createTransitLayer();
      transitLayer.addTo(map);
      activeBaseLayerRef.current = transitLayer;
    } else {
      baseLayers.streets.addTo(map);
      activeBaseLayerRef.current = baseLayers.streets;
    }
    map.invalidateSize();
  }, [baseLayers, createTransitLayer, currentLayer, isLoaded]);

  // --- MODIFIED: Toggle Transit data layer ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;

    setCurrentLayer(showTransit ? 'transit' : 'streets');

    if (transitLayerRef.current) {
      map.removeLayer(transitLayerRef.current);
      transitLayerRef.current = null;
    }
    if (metroLinesLayerRef.current) {
      map.removeLayer(metroLinesLayerRef.current);
      metroLinesLayerRef.current = null;
    }

    if (showTransit) {
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

      try {
        const linesLayer = L.geoJSON(undefined, {
          pane: 'linePane',
          style: (feature) => {
            return {
              color: feature?.properties.color || 'hsl(var(--muted))',
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
          if (line.route_path && (line.route_path.type === 'MultiLineString' || line.route_path.type === 'LineString')) {
            const lineFeature = {
              type: 'Feature',
              properties: {
                name: line.route_name,
                color: line.line_color || 'hsl(var(--muted))'
              },
              geometry: line.route_path
            };
            linesLayer.addData(lineFeature as any);
            linesDrawn++;
          }
        });

        console.log(`[PropertyMap] Added ${linesDrawn} metro lines to map.`);
        linesLayer.addTo(map);
        metroLinesLayerRef.current = linesLayer;

      } catch (e) {
        console.error('Failed to draw Metro lines:', e);
      }
    }
  }, [showTransit, isLoaded, transitStations, busStops, metroLines]);

  // --- MODIFIED: Toggle Attractions data layer ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded) return;

    if (attractionsLayerRef.current) {
      map.removeLayer(attractionsLayerRef.current);
      attractionsLayerRef.current = null;
    }
    setAttractions([]);

    if (showAttractions && selectedProperty) {
      console.log(`[PropertyMap] Fetching attractions near ${selectedProperty.id}`);
      fetchNearbyAttractions(selectedProperty.id)
        .then(res => {
          if (res.success && res.data.length > 0) {
            setAttractions(res.data);

            const attractionMarkers = res.data.map(attraction => {
              return L.marker([attraction.latitude, attraction.longitude], {
                icon: attractionIcon,
                pane: 'dataPane'
              }).bindPopup(`<b>${attraction.name}</b><br>${attraction.category}`);
            });

            const layerGroup = L.layerGroup(attractionMarkers);
            layerGroup.addTo(map);
            attractionsLayerRef.current = layerGroup;
          } else {
            console.log('[PropertyMap] No nearby attractions found for this property.');
          }
        })
        .catch(err => {
          console.error('Failed to fetch nearby attractions:', err);
        });
    }
  }, [showAttractions, selectedProperty, isLoaded]);
  // ------------------------------------------

  // --- ADDED: Fetch Commute Route ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (commuteLayerRef.current) {
      map.removeLayer(commuteLayerRef.current);
      commuteLayerRef.current = null;
    }

    const campusKey = (filters as any)?.campus ?? selectedCampus ?? null;

    if (!selectedProperty || !campusKey) {
      setCommute(null);
      return;
    }

    const campusCenter = CAMPUS_CENTERS[campusKey as keyof typeof CAMPUS_CENTERS];
    if (!campusCenter) {
      console.warn(`[PropertyMap] Could not find campus center for key: ${campusKey}`);
      setCommute(null);
      return;
    }

    console.log(`[PropertyMap] Fetching commute from ${selectedProperty.name} to ${campusKey}`);

    fetchCommuteRoute(
      selectedProperty.latitude!,
      selectedProperty.longitude!,
      campusCenter.lat,
      campusCenter.lng
    )
      .then(res => {
        if (res.success && res.data) {
          setCommute(res.data);
        } else {
          console.warn('Commute route fetch returned unsuccessful response, using fallback');
          setCommute(null);
        }
      })
      .catch(err => {
        // Silently fail and use fallback - don't spam console
        console.warn('Commute calculation failed, using property_distances fallback:', err?.response?.data?.error || err?.message);
        setCommute(null);
      });

  }, [selectedProperty, selectedCampus, filters]);

  // --- ADDED: Render Commute Route ---
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !commute || !selectedProperty) return;

    if (commuteLayerRef.current) {
      map.removeLayer(commuteLayerRef.current);
    }

    const commuteLayer = L.layerGroup();

    const propertyPos: [number, number] = [selectedProperty.latitude!, selectedProperty.longitude!];
    const fromStationPos: [number, number] = [commute.fromStation.station_lat, commute.fromStation.station_lng];
    const toStationPos: [number, number] = [commute.toStation.station_lat, commute.toStation.station_lng];

    const campusKey = (filters as any)?.campus ?? selectedCampus ?? 'arlington';
    const campusCenter = CAMPUS_CENTERS[campusKey as keyof typeof CAMPUS_CENTERS] || CAMPUS_CENTERS.arlington;
    const campusPos: [number, number] = [campusCenter.lat, campusCenter.lng];

    L.polyline([propertyPos, fromStationPos], { color: '#D61A5F', dashArray: '5, 10', weight: 2, pane: 'dataPane' }).addTo(commuteLayer);

    L.polyline([fromStationPos, toStationPos], { color: '#007ACC', weight: 4, opacity: 0.8, pane: 'linePane' })
      .bindTooltip(
        `<b>Metro: ${commute.commute.travelTime} mins</b><br>${commute.fromStation.station_name} to ${commute.toStation.station_name}`,
        { sticky: true }
      )
      .addTo(commuteLayer);

    L.polyline([toStationPos, campusPos], { color: 'hsl(var(--primary))', dashArray: '5, 10', weight: 2, pane: 'dataPane' }).addTo(commuteLayer);

    L.marker(fromStationPos, { icon: createDataIcon('#007ACC', 12), pane: 'dataPane', zIndexOffset: 200 })
      .bindPopup(`<b>Start:</b> ${commute.fromStation.station_name}`)
      .addTo(commuteLayer);
    L.marker(toStationPos, { icon: createDataIcon('hsl(var(--primary))', 12), pane: 'dataPane', zIndexOffset: 200 })
      .bindPopup(`<b>End:</b> ${commute.toStation.station_name}`)
      .addTo(commuteLayer);

    commuteLayer.addTo(map);
    commuteLayerRef.current = commuteLayer;

  }, [commute, selectedProperty, filters, selectedCampus]);

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

    if (!map.getPane('vtPane')) {
      map.createPane('vtPane');
      const pane = map.getPane('vtPane');
      if (pane) (pane.style as any).zIndex = '700';
    }

    vtMarkersRef.current.forEach((m) => map.removeLayer(m));
    vtMarkersRef.current = [];

    const vtIcon = L.divIcon({
      className: 'custom-vt-marker',
      html: `
        <div style="
          background:hsl(var(--primary));border:2px solid hsl(var(--background));border-radius:50%;
          width:28px;height:28px;display:flex;align-items:center;justify-content:center;
          color:hsl(var(--primary-foreground));font-size:10px;font-weight:700;box-shadow:0 2px 4px rgba(0,0,0,0.3);
        ">VT</div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

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
                  <h3 class="font-bold" style="color:hsl(var(--primary));">${p.name}</h3>
                  ${p.address ? `<p class="text-xs" style="color:hsl(var(--map-popup-subtext));">${p.address}</p>` : ''}
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

    const clearLayers = () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      if (pointsLayerRef.current) {
        map.removeLayer(pointsLayerRef.current);
        pointsLayerRef.current = null;
      }
    };

    clearLayers();

    let cancelled = false;

    if (!safetyOn) {
      setIncidentCount(null);
      return () => {
        cancelled = true;
        clearLayers();
      };
    }

    const run = async () => {
      const { from, to } = presetWindow(preset);
      const [west, south, east, north] = bbox!;
      let data: any = null;
      let error: any = null;

      for (const limit of [1000, 500, 250]) {
        const result = await supabase.rpc('incidents_geojson', {
          start_ts: from.toISOString(),
          end_ts: to.toISOString(),
          min_lat: south,
          min_lng: west,
          max_lat: north,
          max_lng: east,
          limit_rows: limit,
        });

        data = result.data;
        error = result.error;

        if (!error) break;
        if (error.code !== '57014') break;
        console.warn(`incidents_geojson timeout at limit ${limit}, retrying with smaller window...`);
      }

      if (cancelled || !safetyOnRef.current) return;

      if (error || !data) {
        console.warn('incidents_geojson error', error);
        setIncidentCount(null);
        return;
      }

      const features: any[] = Array.isArray(data.features) ? data.features : [];
      const count = features.length;
      setIncidentCount(count);
      if (count === 0 || cancelled || !safetyOnRef.current) return;

      if (safetyMode === 'heat') {
        const pts = features.map((f: any) => {
          const [lng, lat] = f.geometry.coordinates;
          const w = Math.max(0.2, Math.min(1, (f.properties?.severity ?? 1) / 3));
          return [lat, lng, w] as [number, number, number];
        });

        const layer = (L as any).heatLayer(pts, {
          radius: 32,
          blur: 12,
          maxZoom: 18,
          minOpacity: 0.35,
          gradient: RISK_GRADIENT,
        });

        if (!cancelled && safetyOnRef.current) {
          layer.addTo(map);
          heatLayerRef.current = layer;
        }
      } else {
        const g = L.layerGroup();
        features.forEach((f: any) => {
          const [lng, lat] = f.geometry.coordinates;
          const sev = f.properties?.severity ?? 0;
          const color =
            sev >= 3 ? '#dc2626' :
            sev === 2 ? '#f59e0b' :
            sev === 1 ? '#22c55e' :
            '#6b7280';
          L.circleMarker([lat, lng], { radius: 6, color, weight: 1, fillOpacity: 0.85 })
            .bindPopup(`
              <div style="min-width:180px">
                <div style="font-weight:600">${f.properties?.type ?? 'Incident'}</div>
                <div style="font-size:12px;color:hsl(var(--map-popup-subtext))">${new Date(f.properties?.occurred_at).toLocaleString()}</div>
                ${f.properties?.details?.BLOCK
                ? `<div style="font-size:12px;margin-top:4px">${f.properties.details.BLOCK}</div>`
                : ''
              }
                ${f.properties?.source ? `<div style="font-size:11px;color:hsl(var(--map-popup-subtext));margin-top:4px">Source: ${f.properties.source}</div>` : ''}
              </div>
            `)
            .addTo(g);
        });
        if (!cancelled && safetyOnRef.current) {
          g.addTo(map);
          pointsLayerRef.current = g;
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      clearLayers();
    };
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
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg overflow-hidden relative"
        style={{ minHeight: '600px', backgroundColor: 'hsl(var(--surface-2))' }}
      />

      {/* Loading Overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-surface/90 backdrop-blur flex items-center justify-center rounded-lg z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Map Controls Panel */}
      <div className="absolute top-2 left-2 z-[15000] pointer-events-auto">
        <div className="bg-surface/95 backdrop-blur rounded-lg shadow-lg border border-border overflow-hidden">
          {/* Layer Controls */}
          <div className="p-2 border-b border-border/70">
            <div className="flex items-center gap-1">
              <Navigation className="h-3 w-3 text-accent" />
              <span className="text-xs font-medium text-foreground">Layers:</span>
              <button
                onClick={() => setCurrentLayer('streets')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  currentLayer === 'streets'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
                }`}
              >
                Streets
              </button>
              <button
                onClick={() => setCurrentLayer('transit')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  currentLayer === 'transit'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
                }`}
              >
                Transit
              </button>
            </div>
          </div>

          {/* Map Controls */}
          <div className="p-2 border-b border-border/70">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-foreground">Controls:</span>
              <button
                onClick={centerMap}
                className="px-2 py-1 text-xs bg-surface-2 text-foreground rounded hover:bg-surface-3 transition-colors"
              >
                Center
              </button>
              <button
                onClick={fitToMarkers}
                className="px-2 py-1 text-xs bg-surface-2 text-foreground rounded hover:bg-surface-3 transition-colors"
              >
                Fit
              </button>
            </div>
          </div>

          {/* Selected Property */}
          {selectedProperty && (
            <div className="p-2 border-b border-border/70">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground truncate">
                  {selectedProperty.title || selectedProperty.name || 'Selected property'}
                </span>
                <button
                  onClick={handleClearSelection}
                  className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* VT & Reference Toggles */}
          <div className="p-2 border-b border-border/70">
            <div className="flex items-center gap-1">
              <Building className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-foreground">VT:</span>
              <button
                onClick={() => setShowVTMarkers((v) => !v)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  showVTMarkers
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
                }`}
              >
                {showVTMarkers ? 'Hide' : 'Show'}
              </button>

              <MapPin className="h-3 w-3 text-accent ml-1" />
              <span className="text-xs font-medium text-foreground">Ref:</span>
              <button
                onClick={() => setShowReferenceMarkers((v) => !v)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  showReferenceMarkers
                    ? 'bg-accent text-primary-foreground'
                    : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
                }`}
              >
                {showReferenceMarkers ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Legend (compact) */}
          <div className="p-2">
            <div className="flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Legend:</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-primary rounded-full" />
                <span>VT</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-accent rounded-full" />
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

      {/* Safety Controls + Safety Legend */}
      <div className="absolute bottom-4 left-4 z-[12000] pointer-events-auto">
        <div className="space-y-2">
          <SafetyControls
            enabled={safetyOn}
            onToggle={setSafetyOn}
            preset={preset}
            onPresetChange={setPreset}
            mode={safetyMode === 'heat' ? 'heat' : 'clusters'}
            onModeChange={(m) => setSafetyMode(m === 'heat' ? 'heat' : 'points')}
          />

          {safetyOn && (
            safetyMode === 'heat' ? (
              <div className="bg-surface/95 backdrop-blur border border-border rounded-2xl shadow-lg px-3 py-2 text-[11px]">
                <div className="font-medium text-foreground mb-1">
                  Safety heat (incidents)
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Lower</span>
                  <div
                    className="h-2 w-24 rounded-full"
                    style={{
                      background:
                        'linear-gradient(to right, #d9f99d, #84cc16, #facc15, #fb923c, #dc2626)',
                    }}
                  />
                  <span className="text-muted-foreground">Higher</span>
                </div>
              </div>
            ) : (
              <div className="bg-surface/95 backdrop-blur border border-border rounded-2xl shadow-lg px-3 py-2 text-[11px]">
                <div className="font-medium text-foreground mb-1">
                  Safety incidents (points)
                </div>
                <div className="flex flex-wrap gap-2 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: '#22c55e' }}
                    />
                    <span>Low</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: '#f59e0b' }}
                    />
                    <span>Medium</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: '#dc2626' }}
                    />
                    <span>High</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: '#6b7280' }}
                    />
                    <span>Unknown</span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Badges (counts) */}
      <div className="absolute top-2 right-2 z-[15000] space-y-1 pointer-events-auto">
        <div className="bg-surface/95 backdrop-blur rounded-lg shadow-lg border border-border px-2 py-1">
          <div className="flex items-center gap-1 text-xs text-foreground font-medium">
            <div className="w-2 h-2 bg-accent rounded-full" />
            <span>
              {(mapProperties.length > 0 ? mapProperties : properties || []).filter(
                (p) => p.latitude && p.longitude
              ).length}{' '}
              Properties
            </span>
          </div>
        </div>
        {incidentCount !== null && safetyOn && (
          <div className="bg-surface/95 backdrop-blur rounded-lg shadow-lg border border-border px-2 py-1 text-xs text-foreground">
            {incidentCount} incidents in view
          </div>
        )}
      </div>
    </div>
  );
};
