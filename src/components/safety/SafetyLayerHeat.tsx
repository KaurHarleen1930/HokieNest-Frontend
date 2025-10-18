// src/components/safety/SafetyLayerHeat.tsx
import "leaflet.heat";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

const VIRIDIS = {
  0.0:  "#440154", 
  0.25: "#414487",
  0.50: "#2A788E",
  0.75: "#22A884",
  1.0:  "#FDE725"  
};

export function SafetyLayerHeat({ data }: { data: any }) {
  const map = useMap();

  useEffect(() => {
    if (!data) return;

    const pts =
      data.features?.map((f: any) => {
        const [lng, lat] = f.geometry.coordinates;
        const sev = f.properties?.severity ?? 1;
        const w = Math.max(0.2, Math.min(1, sev / 3));
        return [lat, lng, w];
      }) ?? [];

    // @ts-ignore
    const layer = (L as any).heatLayer(pts, {
      radius: 22,     
      blur: 20,       
      maxZoom: 18,
      minOpacity: 0.15,
      gradient: VIRIDIS
    });

    layer.addTo(map);
    return () => layer.remove();
  }, [data, map]);

  return null;
}
