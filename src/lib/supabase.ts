import { createClient } from "@supabase/supabase-js";

declare const __SUPABASE_URL__: string;

declare const __SUPABASE_ANON_KEY__: string;

const url = (import.meta.env?.VITE_SUPABASE_URL as string) || __SUPABASE_URL__;
const key = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || __SUPABASE_ANON_KEY__;

if (!url || !key) {
  console.error("[supabase] Missing envs", {
    fromImportMeta: {
      url: (import.meta as any).env?.VITE_SUPABASE_URL,
      key: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY,
    },
    fromDefine: { url: __SUPABASE_URL__, key: __SUPABASE_ANON_KEY__ ? "(present)" : "" },
  });
  throw new Error("Supabase URL and Anon Key must be provided");
}

export const supabase = createClient(url, key);
console.log("[supabase] initialized with URL:", url);
