import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Bbox = [number, number, number, number];

export function useIncidents(
  bbox: Bbox | null,
  from: Date,
  to: Date,
  enabled: boolean
) {
  const [geojson, setGeojson] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const ctrlRef = useRef<AbortController>();

  useEffect(() => {
    if (!enabled || !bbox) { setGeojson(null); return; }
    setLoading(true);
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    (async () => {
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
      if (!ctrl.signal.aborted) {
        if (error) console.error(error);
        setGeojson(data ?? null);
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [enabled, from.getTime(), to.getTime(), bbox ? bbox.join(",") : ""]);

  return { geojson, loading };
}
