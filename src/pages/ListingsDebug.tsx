import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Listing = {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
};

export default function ListingsDebug() {
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("apartment_properties_listings") // ← table name
        .select("id,name,address,city")
        .limit(10);

      if (error) setError(error.message);
      else setRows(data);
    })();
  }, []);

  if (error) return <pre style={{ color: "crimson" }}>Error: {error}</pre>;
  if (!rows) return <pre>Loading listings…</pre>;
  return <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(rows, null, 2)}</pre>;
}

