// src/components/PropertyMap.tsx
import React, { useEffect, useRef, useState } from "react";
import { Listing } from "@/lib/api";
import { MapPin, Navigation, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SafetyControls } from "@/components/safety/SafetyControls";
import { supabase } from "@/lib/supabase";
import L from "leaflet";
import "leaflet.heat"; // heatmap plugin
import "leaflet/dist/leaflet.css";

interface PropertyMapProps {
  properties: Listing[];
  onPropertySelect?: (property: Listing) => void;
  selectedProperty?: Listing;
  className?: string;
}

type SafetyMode = "heat" | "points";
type Preset = "7d" | "30d" | "90d" | "1y";

type ReferenceLocation = {
  id: string;
  name: string;
  type: "university" | "transit" | "employer";
  latitude: number;
  longitude: number;
  address?: string;
};

export function PropertyMap({
  properties,
  onPropertySelect,
  selectedProperty,
  className = "",
}: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  // markers (Leaflet)
  const [propertyMarkers, setPropertyMarkers] = useState<L.Marker[]>([]);
  const [selectedPopup, setSelectedPopup] = useState<L.Popup | null>(null);

  // errors / status
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [incidentCount, setIncidentCount] = useState<number | null>(null);

  // safety controls
  const [safetyOn, setSafetyOn] = useState(true);
  const [safetyMode, setSafetyMode] = useState<SafetyMode>("heat");
  const [preset, setPreset] = useState<Preset>("30d");

  // safety layers
  const heatLayerRef = useRef<any>(null);
  const pointsLayerRef = useRef<L.LayerGroup | null>(null);

  // bbox tracker
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(
    null
  );

  // reference locations
  const [referenceLocations, setReferenceLocations] = useState<
    ReferenceLocation[]
  >([]);
  const [showReferenceLocations, setShowReferenceLocations] = useState(true);

  // DC Metro area center (between Alexandria and Arlington VT campuses)
  const DC_METRO_CENTER = { lat: 38.8339, lng: -77.0648 };

  // VT Campus locations
  const VT_CAMPUSES = [
    { name: "VT Alexandria Campus", lat: 38.8051, lng: -77.047 },
    { name: "VT Arlington Campus", lat: 38.8816, lng: -77.1025 },
  ];

  function presetWindow(p: Preset) {
    const to = new Date();
    const from = new Date(to);
    const days = p === "7d" ? 7 : p === "30d" ? 30 : p === "90d" ? 90 : 365;
    from.setDate(to.getDate() - days);
    return { from, to };
  }

  // init Leaflet map
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || map) return;

    try {
      // Fix default marker icon URLs for bundlers
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const leafletMap = L.map(mapRef.current!, {
        center: [DC_METRO_CENTER.lat, DC_METRO_CENTER.lng],
        zoom: 11,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(leafletMap);

      // initial bbox
      const b0 = leafletMap.getBounds();
      setBbox([b0.getWest(), b0.getSouth(), b0.getEast(), b0.getNorth()]);
      leafletMap.on("moveend", () => {
        const b = leafletMap.getBounds();
        setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      });

      setMap(leafletMap);
      setIsLoaded(true);

      // add VT campus pins
      VT_CAMPUSES.forEach((c) => {
        L.marker([c.lat, c.lng], {
          title: c.name,
        })
          .addTo(leafletMap)
          .bindTooltip(c.name, { direction: "top", offset: L.point(0, -8) });
      });

      // fetch reference locations (fallback if API fails)
      fetchReferenceLocations().catch(() => {});

      return () => {
        leafletMap.remove();
        setMap(null);
      };
    } catch (err) {
      console.error("Error initializing map:", err);
      setMapError("Failed to load map. Please refresh the page.");
    }
  }, []);

  // draw safety layer whenever dependencies change
  useEffect(() => {
    if (map && isLoaded) renderSafetyLayer(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, safetyOn, safetyMode, preset, bbox]);

  // add/update property markers
  useEffect(() => {
    if (!map || !isLoaded) return;

    // clear previous property markers
    propertyMarkers.forEach((m) => m.remove());
    setPropertyMarkers([]);

    if (selectedPopup) {
      selectedPopup.remove();
      setSelectedPopup(null);
    }

    // helper: price bubble as divIcon
    const divIconForProperty = (price: number, isSelected: boolean) =>
      L.divIcon({
        className: "hn-price-pin",
        html: `
          <div style="
            display:inline-flex;align-items:center;justify-content:center;
            width:40px;height:40px;border-radius:50%;
            background:${isSelected ? "#E87722" : "#630031"};
            color:#fff;border:3px solid #fff;font-weight:700;font-size:12px;
            box-shadow:0 2px 6px rgba(0,0,0,0.25);
          ">
            $${Math.floor(price)}
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

    const newMarkers: L.Marker[] = [];

    properties.forEach((p) => {
      // use property coords if present, else jitter around center (demo)
      const lat =
        (p as any).latitude ??
        DC_METRO_CENTER.lat + (Math.random() - 0.5) * 0.2;
      const lng =
        (p as any).longitude ??
        DC_METRO_CENTER.lng + (Math.random() - 0.5) * 0.2;

      const isSel = selectedProperty?.id === p.id;
      const marker = L.marker([lat, lng], {
        icon: divIconForProperty(p.price, isSel),
        title: p.title,
      });

      const popupHtml = `
        <div style="padding: 12px; max-width: 260px;">
          <h3 style="margin: 0 0 8px 0; color: #630031; font-weight: bold;">${p.title}</h3>
          <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${p.address ?? ""}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: bold; color: #E87722; font-size: 18px;">$${p.price}/month</span>
            <div style="display: flex; gap: 8px; font-size: 12px; color: #666;">
              <span>${p.beds ?? "-"} beds</span>
              <span>${p.baths ?? "-"} baths</span>
            </div>
          </div>
          ${p.intlFriendly ? '<span style="background: #E87722; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Intl Friendly</span>' : ""}
        </div>
      `;

      marker.on("click", () => {
        if (selectedPopup) selectedPopup.remove();
        const popup = L.popup({ autoPan: true })
          .setLatLng([lat, lng])
          .setContent(popupHtml)
          .openOn(map);
        setSelectedPopup(popup);
        onPropertySelect?.(p);
      });

      marker.addTo(map);
      newMarkers.push(marker);
    });

    setPropertyMarkers(newMarkers);
  }, [map, isLoaded, properties, selectedProperty]);

  // draw / update safety overlay
  const renderSafetyLayer = async (currentMap: L.Map) => {
    // clear old
    if (heatLayerRef.current) {
      heatLayerRef.current.remove();
      heatLayerRef.current = null;
    }
    if (pointsLayerRef.current) {
      pointsLayerRef.current.remove();
      pointsLayerRef.current = null;
    }

    if (!safetyOn || !bbox) {
      setIncidentCount(null);
      return;
    }

    const { from, to } = presetWindow(preset);
    const [west, south, east, north] = bbox;

    const { data, error } = await supabase.rpc("incidents_geojson", {
      start_ts: from.toISOString(),
      end_ts: to.toISOString(),
      min_lat: south,
      min_lng: west,
      max_lat: north,
      max_lng: east,
      limit_rows: 5000,
    });

    if (error || !data) {
      console.warn("incidents_geojson error", error);
      setIncidentCount(null);
      return;
    }

    const features: any[] = Array.isArray(data.features) ? data.features : [];
    const count = features.length;
    setIncidentCount(count);
    if (count === 0) return;

    if (safetyMode === "heat") {
      const pts =
        features.map((f: any) => {
          const [lng, lat] = f.geometry.coordinates;
          const w = Math.max(
            0.2,
            Math.min(1, (f.properties?.severity ?? 1) / 3)
          );
          return [lat, lng, w] as [number, number, number];
        }) ?? [];
      const layer = (L as any).heatLayer(pts, { radius: 18 });
      layer.addTo(currentMap);
      heatLayerRef.current = layer;
    } else {
      const g = L.layerGroup();
      features.forEach((f: any) => {
        const [lng, lat] = f.geometry.coordinates;
        const sev = f.properties?.severity ?? 0;
        const color =
          sev >= 3
            ? "#dc2626"
            : sev === 2
            ? "#f59e0b"
            : sev === 1
            ? "#22c55e"
            : "#6b7280";
        const m = L.circleMarker([lat, lng], {
          radius: 6,
          color,
          weight: 1,
          fillOpacity: 0.85,
        });
        const html = `
          <div style="min-width:180px">
            <div style="font-weight:600">${f.properties?.type ?? "Incident"}</div>
            <div style="font-size:12px;color:#555">${new Date(
              f.properties?.occurred_at
            ).toLocaleString()}</div>
            ${
              f.properties?.details?.BLOCK
                ? `<div style="font-size:12px;margin-top:4px">${f.properties.details.BLOCK}</div>`
                : ""
            }
            ${
              f.properties?.source
                ? `<div style="font-size:11px;color:#777;margin-top:4px">Source: ${f.properties.source}</div>`
                : ""
            }
          </div>
        `;
        m.bindPopup(html);
        m.addTo(g);
      });
      g.addTo(currentMap);
      pointsLayerRef.current = g;
    }
  };

  // fetch reference locations
  const fetchReferenceLocations = async () => {
    try {
      const response = await fetch(
        "http://localhost:4000/api/v1/map/reference-locations"
      );
      if (!response.ok) throw new Error("bad status");
      const data = (await response.json()) as ReferenceLocation[];
      setReferenceLocations(data);
    } catch (e) {
      // fallback
      setReferenceLocations([
        {
          id: "ref1",
          name: "George Mason University",
          type: "university",
          latitude: 38.8297,
          longitude: -77.308,
          address: "4400 University Dr, Fairfax, VA",
        },
        {
          id: "ref2",
          name: "Rosslyn Metro",
          type: "transit",
          latitude: 38.8964,
          longitude: -77.0716,
          address: "1850 N Moore St, Arlington, VA",
        },
        {
          id: "ref3",
          name: "Pentagon",
          type: "employer",
          latitude: 38.8719,
          longitude: -77.0563,
          address: "Pentagon, Arlington, VA",
        },
      ]);
    }
  };

  // draw reference locations when they change
  useEffect(() => {
    if (!map || !isLoaded) return;

    // remove existing ref markers by storing them if you want to toggle precisely.
    // Quick approach: rebuild a layer group each time.
    const layer = L.layerGroup();

    if (showReferenceLocations) {
      referenceLocations.forEach((r) => {
        const color =
          r.type === "university"
            ? "#3b82f6"
            : r.type === "transit"
            ? "#10b981"
            : "#a855f7";

        const icon = L.divIcon({
          className: "hn-ref-pin",
          html: `
            <div style="
              width:18px;height:18px;border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              background:${color};border:2px solid white;
              font-size:10px;color:#fff;">${
                r.type === "university" ? "🎓" : r.type === "transit" ? "🚇" : "🏢"
              }</div>
          `,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        L.marker([r.latitude, r.longitude], { icon })
          .addTo(layer)
          .bindTooltip(`${r.name}${r.address ? " — " + r.address : ""}`, {
            direction: "top",
            offset: L.point(0, -8),
          });
      });
    }

    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, isLoaded, referenceLocations, showReferenceLocations]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />

      {/* Map status / errors */}
      {mapError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-3 py-2 rounded shadow">
          {mapError}
        </div>
      )}

      {/* Top-left badges & controls */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <Badge variant="secondary" className="bg-background/95 backdrop-blur-sm shadow-lg">
          <MapPin className="h-3 w-3 mr-1" />
          {properties.filter((p: any) => p.latitude && p.longitude).length ||
            properties.length}{" "}
          properties
        </Badge>

        {incidentCount !== null && safetyOn && (
          <Badge variant="secondary" className="bg-background/95 backdrop-blur-sm shadow-lg">
            {incidentCount} incidents in view
          </Badge>
        )}
      </div>

      {/* Safety Controls */}
      <div className="absolute top-20 left-4 z-[1100]">
        <SafetyControls
          enabled={safetyOn}
          onToggle={setSafetyOn}
          preset={preset}
          onPresetChange={(p) => setPreset(p)}
          mode={safetyMode === "heat" ? "heat" : "clusters"}
          onModeChange={(m) => setSafetyMode(m === "heat" ? "heat" : "points")}
        />
      </div>

      {/* Right-side quick toggles */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm"
          onClick={() => setShowReferenceLocations((v) => !v)}
        >
          <Navigation className="h-4 w-4 mr-2" />
          {showReferenceLocations ? "Hide" : "Show"} refs
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg border p-3 shadow-lg z-[1000]">
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-primary border-2 border-white"></div>
            <span className="text-foreground">Properties</span>
          </div>

          {showReferenceLocations && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-[8px]">
                  🎓
                </div>
                <span className="text-foreground">Universities</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-[8px]">
                  🚇
                </div>
                <span className="text-foreground">Transit</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center text-[8px]">
                  🏢
                </div>
                <span className="text-foreground">Employers</span>
              </div>
            </>
          )}

          {safetyOn && (
            <>
              <div className="h-px bg-muted my-2" />
              <div className="font-medium text-xs mb-1">Safety incidents</div>
              {safetyMode === "heat" ? (
                <>
                  <div
                    className="h-2 w-44 rounded"
                    style={{
                      background:
                        "linear-gradient(90deg,#440154 0%,#414487 25%,#2A788E 50%,#22A884 75%,#FDE725 100%)",
                    }}
                  />
                  <div className="flex justify-between text-[10px] mt-1 text-muted-foreground">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </>
              ) : (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: "#22c55e" }}
                    />
                    <span>Severity 1 – Low</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: "#f59e0b" }}
                    />
                    <span>Severity 2 – Moderate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: "#dc2626" }}
                    />
                    <span>Severity 3 – High</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: "#90a4ae" }}
                    />
                    <span>Unknown</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
