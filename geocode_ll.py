import os, time, requests, psycopg2, psycopg2.extras

PG_DSN = os.getenv("PG_DSN")                  # e.g. postgresql://user:pass@host:5432/db
GOOGLE_KEY = os.getenv("GOOGLE_MAPS_API_KEY") # your Google Geocoding API key

TABLE = "public.apartment_properties_listings"   # target table
ID_COL = "id"
NAME_COL = "name"
ADDR_COLS = ("address", "city", "state", "zip_code")
LAT_COL = "latitude"
LNG_COL = "longitude"

def make_query(row):
    parts = []
    for k in (NAME_COL,) + ADDR_COLS:
        v = row.get(k)
        if v:
            parts.append(str(v))
    return ", ".join(parts)

def geocode(q):
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    r = requests.get(url, params={"address": q, "key": GOOGLE_KEY}, timeout=15)
    r.raise_for_status()
    data = r.json()
    if data.get("status") == "OK" and data.get("results"):
        loc = data["results"][0]["geometry"]["location"]
        return float(loc["lat"]), float(loc["lng"])
    if data.get("status") in ("OVER_QUERY_LIMIT", "RESOURCE_EXHAUSTED"):
        raise RuntimeError(data.get("status"))
    return None, None

def main():
    if not PG_DSN or not GOOGLE_KEY:
        raise SystemExit("Set PG_DSN and GOOGLE_MAPS_API_KEY env vars.")

    print("[geocode] starting… table:", TABLE)
    print(f"[geocode] DSN host: {PG_DSN.split('@')[-1].split('/')[0]} | SSL required")

    conn = psycopg2.connect(PG_DSN)
    conn.autocommit = False
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # fetch targets
            print("[geocode] loading listings missing coords…")
            cur.execute(f"""
                SELECT {ID_COL} AS id,
                       {NAME_COL} AS name,
                       {ADDR_COLS[0]} AS address,
                       {ADDR_COLS[1]} AS city,
                       {ADDR_COLS[2]} AS state,
                       {ADDR_COLS[3]} AS zip_code,
                       {LAT_COL} AS latitude,
                       {LNG_COL} AS longitude
                FROM {TABLE}
                WHERE {LAT_COL} IS NULL OR {LNG_COL} IS NULL
                ORDER BY {ID_COL}
            """)
            rows = cur.fetchall()
            total = len(rows)
            print(f"[geocode] rows to process: {total}")

            updated = 0
            for i, row in enumerate(rows, 1):
                q = make_query(row)
                if not q:
                    if i % 25 == 0 or i == total:
                        print(f"[geocode] {i}/{total} processed | updated={updated}")
                    continue

                try:
                    lat, lng = geocode(q)
                except RuntimeError as e:
                    print(f"[geocode] quota/backoff at {i}/{total}: {e}; sleeping 10s…")
                    time.sleep(10)
                    lat, lng = geocode(q)
                except Exception as e:
                    print(f"[geocode] ERROR geocoding '{q}': {e}")
                    lat, lng = None, None

                if lat is not None and lng is not None:
                    cur.execute(
                        f"""
                        UPDATE {TABLE}
                        SET {LAT_COL} = %s, {LNG_COL} = %s, updated_at = NOW()
                        WHERE {ID_COL} = %s
                        """,
                        (lat, lng, row["id"]),
                    )
                    updated += 1
                else:
                    print(f"[geocode] no match for: {q}")

                if i % 25 == 0 or i == total:
                    print(f"[geocode] {i}/{total} processed | updated={updated}")

                time.sleep(0.15)

            conn.commit()
            print(f"[geocode] DONE. Updated {updated}/{total} rows.")
    except Exception as e:
        conn.rollback()
        print("[geocode] FATAL:", e)
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()