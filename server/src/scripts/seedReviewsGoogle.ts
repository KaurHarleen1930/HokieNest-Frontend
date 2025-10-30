import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

/**
 * Google Places API (New, v1) review ingester for HokieNest.
 * - Uses Places v1: searchText + places/{id} (Details)
 * - Strong DC/Arlington bias
 * - Logs per-property diagnostics
 * - Upserts into public.property_reviews (schema you created)
 *
 * ENV required in /server/.env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_PLACES_API_KEY
 * Optional:
 *   DRY_RUN_LIMIT       (number; default 50)
 *   GOOGLE_BIAS_LAT     (default 38.8895)
 *   GOOGLE_BIAS_LNG     (default -77.0353)
 *   GOOGLE_BIAS_RADIUS_M (default 50000)
 */

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY!;
if (!GOOGLE_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY in /server/.env");
  process.exit(1);
}

const DRY_RUN_LIMIT = Number(process.env.DRY_RUN_LIMIT || "50");
const SLEEP_MS = 250;

// Center near National Mall; 50km covers DC/Arlington/NoVA
const BIAS_LAT = Number(process.env.GOOGLE_BIAS_LAT || "38.8895");
const BIAS_LNG = Number(process.env.GOOGLE_BIAS_LNG || "-77.0353");
const BIAS_RADIUS_M = Number(process.env.GOOGLE_BIAS_RADIUS_M || "50000");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isLikelyName = (s?: string | null) => !!s && !/^\d+[\s-]/.test(s.trim());

type PropRow = { id: string; name?: string | null; address?: string | null };

function isVAContext(s: string) {
  return /arlington|va|clarendon|nash|army navy|shirlington|westmoreland|randolph|langston|falls church|rosslyn|pentagon/i.test(
    s
  );
}

/** Build best-effort human query. Prefer real building name + address, else address + "Apartments". */
function buildQuery(p: PropRow) {
  const name = p.name?.trim() || "";
  const addr = p.address?.trim() || "";
  const hasRealName = isLikelyName(name);

  if (hasRealName && addr) return `${name}, ${addr}`;
  if (hasRealName) return `${name}, ${isVAContext(name) ? "Arlington, VA" : "Washington, DC"}`;
  if (addr) {
    const hint = isVAContext(`${name} ${addr}`) ? "Arlington, VA" : "Washington, DC";
    return `${addr}, ${hint}, Apartments`;
  }
  return "";
}

/** Pull properties using only the columns you actually have. */
async function listProperties(limit = 500, offset = 0): Promise<PropRow[]> {
  const { data, error } = await supabase
    .from("apartment_properties_listings")
    .select("id, name, address")
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as PropRow[];
}

/** Places v1: Text Search with bias (returns places.id). */
async function searchTextNew(query: string) {
  const body = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: BIAS_LAT, longitude: BIAS_LNG },
        radius: BIAS_RADIUS_M,
      },
    },
  };

  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify(body),
  });

  const j: any = await r.json();

  if (!r.ok) {
    console.log(`  > Google NEW search error: HTTP ${r.status} — ${JSON.stringify(j)}`);
    return { ok: false, placeId: null as string | null, meta: null as any };
  }

  const place = j?.places?.[0];
  if (!place) return { ok: true, placeId: null, meta: null };
  return {
    ok: true,
    placeId: place.id as string,
    meta: { displayName: place.displayName?.text, formattedAddress: place.formattedAddress },
  };
}

/** Places v1: Details (returns reviews). NOTE: Reviews require Details (Advanced) SKU. */
async function getDetailsNew(placeId: string) {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const r = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": GOOGLE_KEY,
      // Request only what we need to minimize billable fields.
      "X-Goog-FieldMask":
        "id,googleMapsUri,displayName,formattedAddress,rating,userRatingCount,reviews",
    },
  });

  const j: any = await r.json();

  if (!r.ok) {
    console.log(`  > Google NEW details error: HTTP ${r.status} — ${JSON.stringify(j)}`);
    return { ok: false, reviews: [] as any[], meta: null as any };
  }

  const reviews = (j.reviews || []).map((rv: any) => ({
    reviewer_name: rv.authorAttribution?.displayName || "Google user",
    reviewer_email: null,
    rating: rv.rating ?? 0,
    title: (rv.text?.text || "").split("\n")[0]?.slice(0, 60) || "Review",
    review_text: rv.text?.text || "",
    pros: null,
    cons: null,
    move_in_date: null,
    move_out_date: null,
    unit_type: null,
    is_verified: false,
    is_published: true,
    created_at: rv.publishTime ? new Date(rv.publishTime).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    helpful_count: 0,
    not_helpful_count: 0,
    admin_response: null,
    admin_response_date: null,
    source: "google" as const,
    source_review_id: rv.name || null, // e.g., places/XXX/reviews/YYY
    source_permalink_url: j.googleMapsUri || null,
  }));

  const meta = {
    name: j.displayName?.text,
    address: j.formattedAddress,
    rating: j.rating,
    total: j.userRatingCount,
  };

  return { ok: true, reviews, meta };
}

async function upsertReviews(propertyId: string, rows: any[]) {
  if (!rows.length) return;
  const payload = rows.map((r) => ({ property_id: propertyId, ...r }));
  const { error } = await supabase
    .from("property_reviews")
    .upsert(payload, { ignoreDuplicates: true });
  if (error) console.error("Upsert error:", error.message);
}

async function main() {
  console.log("Google Places v1 reviews ingestion (DC/Arlington bias)…");

  const props = await listProperties(DRY_RUN_LIMIT > 0 ? DRY_RUN_LIMIT : 5000, 0);
  if (!props.length) {
    console.log("No properties found in apartment_properties_listings.");
    return;
  }

  let processed = 0;
  for (const p of props) {
    const query = buildQuery(p);
    if (!query) {
      console.log(`• ${p.id} Skipped (no usable query from name/address)`);
      continue;
    }

    // v1 text search
    const st = await searchTextNew(query);

    if (!st.ok) {
      console.log(`• ${p.id} ERROR | query="${query}" (searchTextNew failed)`);
      await sleep(SLEEP_MS);
      continue;
    }

    if (!st.placeId) {
      console.log(`• ${p.id} NO_MATCH | query="${query}"`);
      await sleep(SLEEP_MS);
      continue;
    }

    // v1 details (reviews)
    const det = await getDetailsNew(st.placeId);
    if (!det.ok) {
      console.log(`• ${p.id} DETAILS_ERROR | query="${query}" | place="${st.meta?.displayName || "?"}"`);
      await sleep(SLEEP_MS);
      continue;
    }

    console.log(
      `• ${p.id} MATCH | query="${query}" | place="${st.meta?.displayName || "?"}" — ${st.meta?.formattedAddress || "n/a"} | reviews=${det.reviews.length}`
    );

    if (det.reviews.length) {
      await upsertReviews(p.id, det.reviews);
    }
    await sleep(SLEEP_MS);
    processed++;
  }

  console.log(`Done. Processed ${processed} properties.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
