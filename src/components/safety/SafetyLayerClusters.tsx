import { useMemo } from "react";
import Supercluster from "supercluster";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";


type FC = { type:"FeatureCollection"; features:any[] };

export function SafetyLayerClusters({ data }:{ data: FC | null }) {
  const map = useMap();

  const index = useMemo(() => {
    const points = (data?.features ?? []).map((f:any) => ({
      type: "Feature",
      properties: { severity: f.properties?.severity ?? null },
      geometry: { type: "Point", coordinates: f.geometry.coordinates }
    }));
    const sc = new Supercluster({ radius: 60, maxZoom: 18 });
    // @ts-ignore
    sc.load(points);
    return sc;
  }, [data]);

  const bounds = map.getBounds();
  const zoom = Math.floor(map.getZoom());

  const clusters = useMemo(() => {
    const bbox:[number,number,number,number] = [
      bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()
    ];
    return index.getClusters(bbox, zoom);
  }, [index, zoom, bounds]);

  return (
    <GeoJSON
      key={clusters.length}
      data={{
        type:"FeatureCollection",
        features: clusters.map((c:any)=>(
          c.properties.cluster
            ? { type:"Feature", properties:{ cluster:true, point_count:c.properties.point_count }, geometry:c.geometry }
            : c
        ))
      } as any}
      pointToLayer={(feature, latlng) => {
        const isCluster = (feature as any).properties.cluster;
        const count = (feature as any).properties.point_count;
        const sev = (feature as any).properties?.severity ?? 0;

  const size = isCluster ? Math.min(28, 10 + Math.log2((count || 1) + 1) * 4) : 6;
  const color = isCluster ? "#475569"  // uniform gray clusters
    : sev >= 3 ? "#e53935"   // red – severe
    : sev === 2 ? "#ffb300"  // amber – medium
    : sev === 1 ? "#43a047"  // green – low
    : "#90a4ae";             // gray – unknown

  return L.circleMarker(latlng, {
    radius: size,
    color,
    weight: 0.8,
    fillOpacity: 0.8
  });
}}
    />
  );
}
