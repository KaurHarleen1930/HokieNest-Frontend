// server/src/ingest_safety_once.js
// Node >= 18 (native fetch). No external deps.

import dns from "node:dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Prefer IPv4 on Windows networks
dns.setDefaultResultOrder("ipv4first");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------------------
   0) ENV LOADER
---------------------------- */
function loadEnvFile(p) {
  try {
    if (!fs.existsSync(p)) return;
    const txt = fs.readFileSync(p, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
      if (m) {
        const k = m[1];
        let v = m[2].trim();
        v = v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
        if (!(k in process.env)) process.env[k] = v;
      }
    }
  } catch {}
}
loadEnvFile(path.resolve(__dirname, "../.env"));
loadEnvFile(path.resolve(__dirname, "../../.env"));

/* ---------------------------
   1) CONFIG
---------------------------- */
function stripTrailingSlashes(s = "") { return s.replace(/\/+$/, ""); }
let SUPABASE_URL = stripTrailingSlashes(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
let SUPA_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
if (!SUPABASE_URL || !SUPA_KEY) {
  console.error("❌ Missing Supabase URL or Key"); process.exit(1);
}
console.log("Supabase URL =", SUPABASE_URL);
console.log("Using key = service_role …", SUPA_KEY.slice(-6));

function jwtRef(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString("utf8"));
    return { ref: payload.ref, role: payload.role, exp: payload.exp };
  } catch { return { ref: null, role: null, exp: null }; }
}
async function preflightAuth() {
  const { ref, role } = jwtRef(SUPA_KEY);
  const host = new URL(SUPABASE_URL).host;
  const urlRef = host.split(".")[0];
  if (!ref || ref !== urlRef || role !== "service_role") {
    throw new Error("Service key mismatch / not service_role");
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  console.log("REST preflight status:", r.status, r.statusText);
  if (r.status === 401) throw new Error("REST rejected key");
}
await preflightAuth();

const SERVICE_ROLE = SUPA_KEY;
const DAYS_BACK = Number(process.env.DAYS_BACK ?? "365");
const START = process.env.START_DATE ? new Date(process.env.START_DATE) : new Date(Date.now() - DAYS_BACK*24*3600*1000);
const END   = process.env.END_DATE   ? new Date(process.env.END_DATE)   : new Date();
const BBOX = (process.env.BBOX ?? "-77.55,38.60,-76.70,39.30").split(",").map(Number);
const [xmin, ymin, xmax, ymax] = BBOX;

function sqlTime(ts){ return ts.toISOString().slice(0,19).replace("T"," "); }
function toISO(d){ try{ if(typeof d==="number")return new Date(d).toISOString(); if(typeof d==="string")return new Date(d).toISOString(); if(d instanceof Date)return d.toISOString(); return null; }catch{ return null; } }
function inBbox(lat,lng){ return lng>=xmin && lng<=xmax && lat>=ymin && lat<=ymax; }

/* ---------------------------
   2) CONSTANTS
---------------------------- */
const UA_HEADERS = {
  "User-Agent": "HokieNest/1.0 (+https://hokienest.local)",
  "Accept": "application/json",
};
const ARLINGTON_FORCE_ALL = (process.env.ARLINGTON_FORCE_ALL === "1");

/* ---------------------------
   3) HELPERS
---------------------------- */
function offenseToSeverity(o=""){ o=String(o).toLowerCase();
  if (/(homicide|assault.*weapon|assault with (a )?dangerous weapon|robbery|weapon)/.test(o)) return 3;
  if (/(burglary|motor.?vehicle|theft|larceny)/.test(o)) return 2;
  return 1;
}

// retry + timeout
async function fetchWithRetry(url, opts = {}, { retries = 3, timeoutMs = 15000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      clearTimeout(t);
      if (attempt === retries) throw e;
      await new Promise(r => setTimeout(r, 500*(attempt+1)));
    }
  }
}

async function upsertSupabase(rows){
  if(!rows.length) return 0;
  const endpoint = `${SUPABASE_URL}/rest/v1/incidents?on_conflict=source,source_id`;
  const CHUNK = Number(process.env.UPLOAD_CHUNK || 200);
  const MAX_RETRIES = 5; const BACKOFF = [500,1000,2000,4000,8000];
  let count = 0;
  for (let i=0;i<rows.length;i+=CHUNK){
    const chunk = rows.slice(i,i+CHUNK);
    let attempt=0;
    while(true){
      try{
        const res = await fetch(endpoint,{
          method:"POST",
          headers:{ "Content-Type":"application/json", apikey:SERVICE_ROLE, Authorization:`Bearer ${SERVICE_ROLE}`, Prefer:"resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(chunk)
        });
        if(!res.ok){ const t = await res.text().catch(()=> ""); throw new Error(`Supabase upsert failed: ${res.status} ${t}`); }
        count += chunk.length;
        if(((i/CHUNK)%10)===0 || i+CHUNK>=rows.length) console.log(`  Upserted ${Math.min(i+CHUNK,rows.length)}/${rows.length}`);
        break;
      }catch(err){
        attempt++;
        const msg = String(err?.message||err);
        const isTransient = msg.includes("ECONNRESET")||msg.includes("socket hang up")||msg.includes("fetch failed")||msg.includes("ETIMEDOUT")||msg.includes("ENOTFOUND")||msg.includes("EAI_AGAIN")||/5\d\d/.test(msg);
        if(attempt<=MAX_RETRIES && isTransient){ const wait = BACKOFF[Math.min(attempt-1, BACKOFF.length-1)]; console.warn(`  Retry ${attempt}/${MAX_RETRIES} after ${wait}ms (${msg})`); await new Promise(r=>setTimeout(r,wait)); continue; }
        throw err;
      }
    }
  }
  return count;
}

/* ---------------------------
   4) DC (2024/2025 GeoJSON)
---------------------------- */
const DC_YEAR_LAYERS = [
  process.env.DC_2024_URL || "https://opendata.dc.gov/datasets/DCGIS::crime-incidents-in-2024.geojson",
  process.env.DC_2025_URL || "https://opendata.dc.gov/datasets/DCGIS::crime-incidents-in-2025.geojson",
];
async function fetchDCYearLayers(){
  const rows=[];
  for(const url of DC_YEAR_LAYERS){
    let r; try{ r = await fetchWithRetry(url, { headers: UA_HEADERS }, { retries: 2, timeoutMs: 20000 }); }catch(e){ console.warn("[DC] fetch error:", e?.message||e); continue; }
    const gj = await r.json().catch(()=> null);
    if(!gj || !Array.isArray(gj.features)) continue;
    for(const f of gj.features){
      const p = f.properties ?? {};
      const g = f.geometry?.type==="Point" ? f.geometry : null;
      const occurred = toISO(p.REPORT_DAT); if(!occurred) continue;
      const lng = g?.coordinates?.[0] ?? p.LONGITUDE;
      const lat = g?.coordinates?.[1] ?? p.LATITUDE;
      if (typeof lat!=="number" || typeof lng!=="number") continue;
      const t = new Date(occurred).getTime();
      if (t < START.getTime() || t > END.getTime()) continue;
      if (!inBbox(lat,lng)) continue;
      const offense = p.OFFENSE ?? "";
      rows.push({
        source:"dc-opendata",
        source_id: String(p.OBJECTID ?? `${lat},${lng},${occurred}`),
        type: String(offense),
        method:"",
        occurred_at: occurred,
        lat, lng,
        block: String(p.BLOCK ?? ""),
        details: p,
        severity: offenseToSeverity(offense),
      });
    }
  }
  return rows;
}

/* ---------------------------
   5) Arlington (ArcGIS, GET+POST fallback)
---------------------------- */
function pickField(attrs,cands){ const map={}; for(const k of Object.keys(attrs||{})) map[k.toLowerCase()]=k; for(const c of cands){ const real = map[c.toLowerCase()]; if(real) return attrs[real]; } return undefined; }
const baseGeo = JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference:{ wkid:4326 } });

async function fetchArcGIS(source){
  const pageSize=1000; let offset=0; const all=[];
  const altUrls = (()=>{ const u=source.url; const s=new Set([u]); if(u.includes("/MapServer/0/query")) s.add(u.replace("/MapServer/0/query","/FeatureServer/0/query")); if(u.includes("/FeatureServer/0/query")) s.add(u.replace("/FeatureServer/0/query","/MapServer/0/query")); return Array.from(s); })();
  const where = (()=>{ if(ARLINGTON_FORCE_ALL) return "1=1"; const a=sqlTime(START), b=sqlTime(END); const ds=(f)=>`${f} >= TIMESTAMP '${a}' AND ${f} <= TIMESTAMP '${b}'`; const parts=(source.dateFields||["INCIDENT_DATE","DATE","EVENT_DATE","OCCURRED_ON_DATE"]).map(ds); parts.push("1=1"); return parts.join(" OR "); })();
  try{
    while(true){
      let pageHandled=false;
      for(const baseUrl of altUrls){
        let body=null;

        // GET try
        try{
          const getParams = new URLSearchParams({
            f:"json", where, geometry:baseGeo, inSR:"4326", spatialRel:"esriSpatialRelIntersects",
            outFields: source.outFields || "*", returnGeometry:"true",
            resultRecordCount:String(pageSize), resultOffset:String(offset),
            orderByFields:"OBJECTID", outSR:"4326", returnExceededLimitFeatures:"true", cacheHint:"true",
          });
          const getRes = await fetchWithRetry(`${baseUrl}?${getParams.toString()}`, { headers: UA_HEADERS }, { retries: 2, timeoutMs: 20000 });
          const getBody = await getRes.json().catch(()=> null);
          if (Array.isArray(getBody?.features)) body = getBody;
        }catch{}

        // POST try
        if(!body){
          try{
            const params = new URLSearchParams({
              f:"json", where, geometry:baseGeo, inSR:"4326", spatialRel:"esriSpatialRelIntersects",
              outFields: source.outFields || "*", returnGeometry:"true",
              resultRecordCount:String(pageSize), resultOffset:String(offset),
              orderByFields:"OBJECTID", outSR:"4326", returnExceededLimitFeatures:"true", cacheHint:"true",
            });
            const res = await fetchWithRetry(baseUrl, { method:"POST", headers:{ ...UA_HEADERS, "Content-Type":"application/x-www-form-urlencoded" }, body: params.toString() }, { retries: 2, timeoutMs: 20000 });
            body = await res.json().catch(()=> null);
          }catch(e){
            console.warn(`[ArcGIS] ${source.id} error:`, e?.message||e);
          }
        }

        const feats = Array.isArray(body?.features) ? body.features : [];
        if(!feats.length){
          if(!body?.exceededTransferLimit) return all;
          offset += pageSize; pageHandled=true; break;
        }

        const normalized = feats.map((f)=>{
          const p=f.attributes??{}; const g=f.geometry??{};
          const lng = typeof g.x==="number" ? g.x : (p.LONGITUDE ?? p.X ?? p.Longitude);
          const lat = typeof g.y==="number" ? g.y : (p.LATITUDE ?? p.Y ?? p.Latitude);
          const occurredRaw = pickField(p, source.dateFields || ["INCIDENT_DATE","DATE","EVENT_DATE","OCCURRED_ON_DATE"]);
          const offense = pickField(p, source.offenseFields || ["OFFENSE_DESC","OFFENSE","CRIME_TYPE","NATURECODE","OFFENSE_TYPE"]);
          const blockTxt= pickField(p, source.locTextFields || ["LOCATION","BLOCK","ADDRESS"]);
          const occurred = toISO(occurredRaw);
          if(typeof lat!=="number"||typeof lng!=="number"||!occurred) return null;
          if(!inBbox(lat,lng)) return null;
          return {
            source: source.id,
            source_id: String(p.OBJECTID ?? `${lat},${lng},${occurred}`),
            type: String(offense||""), method:"", occurred_at: occurred,
            lat, lng, block: String(blockTxt||""), details: p, severity: offenseToSeverity(offense||""),
          };
        }).filter(Boolean);

        all.push(...normalized); pageHandled=true;
        if(!body?.exceededTransferLimit && normalized.length<pageSize) return all;
        offset += pageSize; break;
      }
      if(!pageHandled) return all;
    }
  }catch(e){
    console.error(`fetchArcGIS(${source.id}) fatal:`, e?.message||e);
    return [];
  }
}

const SOURCES = [
  {
    id:"arlington-opendata",
    url: process.env.ARLINGTON_QUERY_URL || "https://maps.arlingtonva.us/arcgis/rest/services/APD/MapServer/0/query",
    dateFields:["INCIDENT_DATE","OCCURRED_ON_DATE","EVENT_DATE","DATE"],
    offenseFields:["OFFENSE_DESC","OFFENSE","CRIME_TYPE","NATURECODE","OFFENSE_TYPE"],
    locTextFields:["LOCATION","BLOCK","ADDRESS"],
    outFields:"*",
  },
];

/* ---------------------------
   6) Alexandria JSON (+ optional geocode)
---------------------------- */
async function fetchAlexandriaJSON(){
  const fmt=(d)=> d.toISOString().slice(0,10).replace(/-/g,"");
  const url=`https://apps.alexandriava.gov/CrimeReport/Result.aspx?sd=${fmt(START)}&ed=${fmt(END)}&format=JSON`;
  const r = await fetchWithRetry(url, { headers: UA_HEADERS }, { retries: 2, timeoutMs: 20000 });
  return (await r.json().catch(()=> [])) ?? [];
}
function mapAlexRow(row){
  const occurred = toISO(`${row["Report Date"]} ${row["Report Time"]}`); if(!occurred) return null;
  const offense = String(row["Crime Classification"] ?? "");
  return {
    source:"alexandria-apd",
    source_id: String(row["Case No."] ?? `${occurred}-${row["Location"] ?? ""}`),
    type: offense, method:"", occurred_at: occurred,
    lat:null, lng:null,
    block: `${row["Block No."] ?? ""} ${row["Location"] ?? ""}`.trim(),
    details: row, severity: offenseToSeverity(offense),
  };
}
// Minimal Mapbox geocoder
async function geocodeAddress(addr){
  const token = process.env.MAPBOX_TOKEN; if(!token) return null;
  const q = encodeURIComponent(`${addr}, Virginia`);
  const u = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&limit=1`;
  try{
    const r = await fetchWithRetry(u, { headers: UA_HEADERS }, { retries:2, timeoutMs:20000 });
    const j = await r.json(); const c = j?.features?.[0]?.center;
    if(Array.isArray(c)&&c.length===2) return { lng:Number(c[0]), lat:Number(c[1]) };
  }catch{}
  return null;
}

/* ---------------------------
   7) Fairfax — Weekly CSV (official)
   https://www.fairfaxcounty.gov/apps/pfsu/api/file/crimereportsfromsp
---------------------------- */
function parseCSV(text){
  const rows=[]; let i=0, field='', row=[], inQuotes=false;
  while(i<text.length){
    const c=text[i];
    if(inQuotes){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i+=2; continue; } inQuotes=false; i++; continue; }
      field+=c; i++; continue;
    }
    if(c==='"'){ inQuotes=true; i++; continue; }
    if(c===','){ row.push(field); field=''; i++; continue; }
    if(c==='\n' || c==='\r'){ if(c==='\r' && text[i+1]==='\n') i++; row.push(field); rows.push(row); field=''; row=[]; i++; continue; }
    field+=c; i++;
  }
  row.push(field); rows.push(row);
  return rows;
}
function normalizeHeader(name=''){ return String(name).trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''); }

async function fetchFairfaxWeeklyCSV(){
  const url = "https://www.fairfaxcounty.gov/apps/pfsu/api/file/crimereportsfromsp";
  let text;
  try{
    const res = await fetchWithRetry(url, { headers: { ...UA_HEADERS, "Accept":"text/csv" } }, { retries:3, timeoutMs:20000 });
    text = await res.text();
  }catch(e){
    console.warn("[fairfax-csv] fetch error:", e?.message||e); return [];
  }
  const rows = parseCSV(text); if(!rows.length) return [];
  const header = rows[0].map(normalizeHeader); const data = rows.slice(1);

  // common columns in this feed:
  const col = (cands)=> {
    for(const name of cands){ const idx = header.indexOf(normalizeHeader(name)); if(idx!==-1) return idx; }
    return -1;
  };
  const iDate = col(["DATE","INCIDENT_DATE","REPORT_DATE","OCCURRED_ON","DATE_REPORTED"]);
  const iTime = col(["TIME","INCIDENT_TIME","REPORT_TIME","OCCURRED_TIME"]);
  const iAddr = col(["ADDRESS","BLOCK_ADDRESS","LOCATION","LOCATION_BLOCK","BLOCK","ADDRESS_100_BLOCK"]);
  const iCity = col(["CITY","JURISDICTION","MUNICIPALITY"]);
  const iOff  = col(["OFFENSE","OFFENSE_DESC","CRIME","INCIDENT","OFFENSE_DESCRIPTION","NATURE"]);
  const iCase = col(["CASE_NUMBER","INCIDENT_ID","CCN","REPORT_NUMBER","RECORD_ID"]);

  const out=[];
  for(const r of data){
    const dateStr = r[iDate] || "";
    const timeStr = r[iTime] || "";
    const occurred = toISO(`${dateStr} ${timeStr}`.trim()) || toISO(dateStr);
    if(!occurred) continue;

    const addrBits = [r[iAddr], r[iCity], "VA"].filter(Boolean).join(", ");
    const offense  = (r[iOff]  || "").trim();
    const caseId   = (r[iCase] || "").trim();

    const g = await geocodeAddress(addrBits);
    if(!g) continue;
    if(!inBbox(g.lat, g.lng)) continue;

    const t = new Date(occurred).getTime();
    if (t < START.getTime() || t > END.getTime()) continue;

    out.push({
      source:"fairfax-weeklycsv",
      source_id: caseId || `${g.lat},${g.lng},${occurred}`,
      type: offense, method:"",
      occurred_at: occurred,
      lat: g.lat, lng: g.lng,
      block: r[iAddr] || "",
      details: Object.fromEntries(header.map((h,k)=> [h, r[k]])),
      severity: offenseToSeverity(offense),
    });
  }
  return out;
}

async function backfillFairfaxYearly() {
  const years = [2024, 2025]; // adjust as needed
  const allRows = [];

  for (const year of years) {
    try {
      const url = `https://www.fairfaxcounty.gov/police/sites/police/files/assets/images/reports/crime-statistics-${year}.csv`;
      console.log(`Fetching Fairfax ${year}...`);
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Fairfax ${year} not found (${res.status})`);
        continue;
      }
      const text = await res.text();
      const rows = parseCSV(text);
      if (rows.length < 2) continue;

      const header = rows[0].map(normalizeHeader);
      const data = rows.slice(1);
      const recs = [];

      const iDate = header.indexOf("date");
      const iAddr = header.indexOf("address");
      const iOff  = header.indexOf("offense");
      const iCase = header.indexOf("case_number");

      for (const r of data) {
        const occurred = toISO(r[iDate]);
        if (!occurred) continue;

        const g = await geocodeAddress(`${r[iAddr]}, Fairfax, VA`);
        if (!g) continue;
        if (!inBbox(g.lat, g.lng)) continue;

        recs.push({
          source: `fairfax-${year}`,
          source_id: r[iCase] || `${g.lat},${g.lng},${occurred}`,
          type: r[iOff] || "",
          occurred_at: occurred,
          lat: g.lat,
          lng: g.lng,
          block: r[iAddr],
          details: Object.fromEntries(header.map((h,k)=>[h, r[k]])),
          severity: offenseToSeverity(r[iOff] || ""),
        });
      }

      console.log(`Fairfax ${year}: ${recs.length} ready`);
      if (recs.length) await upsertSupabase(recs);
      allRows.push(...recs);
    } catch (err) {
      console.warn(`Fairfax ${year} failed:`, err.message || err);
    }
  }
  return allRows;
}
async function backfillArlingtonFinal() {
  const baseUrl = "https://services1.arcgis.com/URXACjti2bKEMP6a/arcgis/rest/services/Crime_Incidents_Public/FeatureServer/0/query";
  const allRows = [];
  const CHUNK_DAYS = 30;
  const now = new Date();
  const startDate = new Date(now);
  startDate.setFullYear(startDate.getFullYear() - 1);

  for (let d = new Date(startDate); d < now; d.setDate(d.getDate() + CHUNK_DAYS)) {
    const start = new Date(d);
    const end = new Date(d);
    end.setDate(end.getDate() + CHUNK_DAYS);

    // Use epoch milliseconds for ArcGIS time filter
    const where = `incident_date >= ${start.getTime()} AND incident_date <= ${end.getTime()}`;

    const params = new URLSearchParams({
      where,
      outFields: "OBJECTID,incident_date,offense,location_description,latitude,longitude",
      returnGeometry: "true",
      f: "geojson",
      resultRecordCount: "2000",
      orderByFields: "incident_date DESC"
    });

    const url = `${baseUrl}?${params.toString()}`;
    console.log(`Fetching Arlington ${start.toISOString().slice(0,7)} window...`);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Arlington fetch failed: ${res.status}`);
        continue;
      }

      const gj = await res.json();
      if (!gj.features?.length) {
        console.log(`Arlington ${start.toISOString().slice(0,7)} → 0`);
        continue;
      }

      const recs = gj.features
        .map(f => {
          const p = f.properties ?? {};
          const [lng, lat] = f.geometry?.coordinates ?? [];
          if (!lat || !lng || !inBbox(lat, lng)) return null;
          const occurred = toISO(p.incident_date);
          return occurred ? {
            source: "arlington-arcgis",
            source_id: String(p.OBJECTID),
            type: p.offense ?? "",
            occurred_at: occurred,
            lat, lng,
            block: p.location_description ?? "",
            details: p,
            severity: offenseToSeverity(p.offense ?? "")
          } : null;
        })
        .filter(Boolean);

      console.log(`Arlington ${start.toISOString().slice(0,7)} → ${recs.length}`);
      if (recs.length) await upsertSupabase(recs);
      allRows.push(...recs);
    } catch (err) {
      console.warn(`[Arlington] error:`, err.message);
    }
  }

  console.log(`Arlington total upserted: ${allRows.length}`);
  return allRows;
}


/* ---------------------------
   8) MAIN
---------------------------- */
(async () => {
  try {
    console.log("=== HokieNest Incident Loader ===");
    console.log(`Time window: ${START.toISOString()} → ${END.toISOString()}`);
    console.log(`Bounding box: ${BBOX.join(", ")}`);

    // DC
    console.log("Fetching DC (year layers)...");
    const dcRows = await fetchDCYearLayers();
    console.log(`DC prepared: ${dcRows.length} rows`);
    if (dcRows.length) {
      const n = await upsertSupabase(dcRows);
      console.log(`DC upserted: ${n}`);
    }

    // Arlington
    console.log("Fetching arlington-opendata...");
    const arlRows = await fetchArcGIS({
      id:"arlington-opendata",
      url: process.env.ARLINGTON_QUERY_URL || "https://maps.arlingtonva.us/arcgis/rest/services/APD/MapServer/0/query",
      dateFields:["INCIDENT_DATE","OCCURRED_ON_DATE","EVENT_DATE","DATE"],
      offenseFields:["OFFENSE_DESC","OFFENSE","CRIME_TYPE","NATURECODE","OFFENSE_TYPE"],
      locTextFields:["LOCATION","BLOCK","ADDRESS"],
      outFields:"*",
    });
    console.log(`arlington-opendata prepared: ${arlRows.length} rows`);
    if (arlRows.length) {
      const n = await upsertSupabase(arlRows);
      console.log(`arlington-opendata upserted: ${n}`);
    }

    // Alexandria (non-fatal if site is down)
    try {
      console.log("Fetching alexandria-apd (JSON export)...");
      const alexRaw = await fetchAlexandriaJSON();
      const alexMapped = alexRaw.map(mapAlexRow).filter(Boolean);
      console.log(`alexandria-apd mapped: ${alexMapped.length} rows`);
      let alexReady = [];
      if (alexMapped.length) {
        // Geocode if needed
        alexReady = [];
        for (const rec of alexMapped) {
          if (rec.lat == null || rec.lng == null) {
            const g = await geocodeAddress(rec.block ? `${rec.block}, Alexandria, VA` : "Alexandria, VA");
            if (g) { rec.lat = g.lat; rec.lng = g.lng; }
          }
          if (typeof rec.lat === "number" && typeof rec.lng === "number" && inBbox(rec.lat, rec.lng)) {
            alexReady.push(rec);
          }
        }
      }
      console.log(`alexandria-apd geocoded & bbox-filtered: ${alexReady.length} rows`);
      if (alexReady.length) {
        const n = await upsertSupabase(alexReady);
        console.log(`alexandria-apd upserted: ${n}`);
      }
    } catch (e) {
      console.warn("[Alexandria] skipped due to network error:", e?.message || e);
    }

    // Fairfax — weekly CSV (last ~7–10 days)
    console.log("Fetching fairfax (weekly CSV)...");
    const ffxCSV = await fetchFairfaxWeeklyCSV();
    console.log(`fairfax (weekly CSV) prepared: ${ffxCSV.length} rows`);
    if (ffxCSV.length) {
      const n = await upsertSupabase(ffxCSV);
      console.log(`fairfax (weekly CSV) upserted: ${n}`);
    }

    console.log("✅ Done.");
  } catch (e) {
    console.error("❌ Error:", e);
    process.exit(1);
  }
await backfillArlingtonFinal();



})();
