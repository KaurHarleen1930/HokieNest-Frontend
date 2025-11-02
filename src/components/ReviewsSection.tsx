import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchReviews,
  fetchReviewStats,
  createReview,
  type ReviewItem,
  type ReviewStats,
} from "@/lib/reviews";

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="inline-block font-medium">
      {"★".repeat(v)}
      <span className="text-gray-400">{"★".repeat(5 - v)}</span>
    </span>
  );
}

function ReviewForm({ propertyId, onCreated }: { propertyId: string; onCreated: () => void }) {
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onToggleAnon = (checked: boolean) => {
    setAnonymous(checked);
    if (checked) {
      setName("");
      setEmail("");
    }
  };

  const submit = useCallback(async () => {
    try {
      setErr(null);
      setSubmitting(true);
      await createReview(propertyId, { rating, title, text, anonymous, name, email });
      setRating(5);
      setTitle("");
      setText("");
      setAnonymous(false);
      setName("");
      setEmail("");
      onCreated();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit review");
      console.error("[ReviewForm]", e);
    } finally {
      setSubmitting(false);
    }
  }, [propertyId, rating, title, text, anonymous, name, email, onCreated]);

  return (
    <div className="mb-4 rounded-xl border border-surface-3 bg-surface-2 p-4">
      <h3 className="mb-2 font-semibold">Add your review</h3>
      {err && <p className="mb-2 text-sm text-destructive">{err}</p>}

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm">
          Rating:
          <select
            className="ml-2 rounded border bg-background px-2 py-1"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <input
          className="min-w-[240px] flex-1 rounded border bg-background px-3 py-2 text-sm"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
        />
      </div>

      <textarea
        className="mt-3 w-full rounded border bg-background px-3 py-2 text-sm"
        rows={4}
        placeholder="Share your experience…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="rounded border bg-background px-3 py-2 text-sm"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={anonymous}
        />
        <input
          className="rounded border bg-background px-3 py-2 text-sm"
          placeholder="Your VT email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          disabled={anonymous}
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          id="anon"
          type="checkbox"
          checked={anonymous}
          onChange={(e) => onToggleAnon(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="anon" className="text-sm text-muted">
          Post anonymously (your name won’t be shown)
        </label>
      </div>

      <div className="mt-3">
        <Button
          size="sm"
          disabled={
            submitting || !text.trim() || (!anonymous && (!name.trim() || !email.trim()))
          }
          onClick={submit}
        >
          {submitting ? "Submitting…" : "Post review"}
        </Button>
      </div>
    </div>
  );
}

function ReviewRow({ r }: { r: ReviewItem }) {
  const dt = useMemo(() => new Date(r.created_at).toLocaleDateString(), [r.created_at]);
  const isVT = r.source === "vt";
  const isAnon =
    isVT &&
    (!r.reviewer_name ||
      (r.reviewer_name ?? "").toLowerCase().startsWith("anonymous"));
  const displayName = isAnon ? "Anonymous VT student" : r.reviewer_name ?? "Resident";

  return (
    <div className="py-3 border-b border-surface-3 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Stars value={Number(r.rating) || 0} />
          <span className="text-muted">{dt}</span>
          {isVT ? (
            <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
              VT student
            </span>
          ) : (
            r.source && <span className="text-muted">· {r.source}</span>
          )}
        </div>
        {!isVT && r.source_permalink_url && (
          <a
            href={r.source_permalink_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            View on {r.source}
          </a>
        )}
      </div>

      <div className="mt-1">
        <span className="text-sm text-muted">by {displayName}</span>
      </div>

      {r.title && <div className="mt-1 font-semibold">{r.title}</div>}
      <p className="mt-1 text-foreground leading-relaxed whitespace-pre-line">
        {r.review_text}
      </p>
    </div>
  );
}

export function ReviewsSection({ propertyId }: { propertyId: string }) {
  const [rows, setRows] = useState<ReviewItem[] | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "vt">("all");

  const refetch = useCallback(async () => {
    try {
      setErr(null);
      const [items, s] = await Promise.all([
        fetchReviews(propertyId),
        fetchReviewStats(propertyId),
      ]);
      setRows(items);
      setStats(s);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load reviews");
      console.error("[ReviewsSection] fetch error:", e);
    }
  }, [propertyId]);

  useEffect(() => {
    refetch();
  }, [propertyId, refetch]);

  const filteredRows =
    filter === "vt"
      ? rows?.filter((r) => r.source === "vt") ?? []
      : rows ?? [];

  return (
    <Card className="bg-surface border-surface-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Reviews</CardTitle>
          {stats && stats.count > 0 && (
            <div className="text-sm text-muted">
              <Stars value={stats.avg_rating} /> <span className="ml-1">({stats.count})</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ReviewForm propertyId={propertyId} onCreated={refetch} />

        {/* filter dropdown */}
        <div className="flex justify-end mb-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "vt")}
            className="text-sm border rounded px-2 py-1 bg-background"
          >
            <option value="all">All reviews</option>
            <option value="vt">VT student reviews only</option>
          </select>
        </div>

        {err && <p className="text-destructive text-sm">{err}</p>}

        {filteredRows && filteredRows.length > 0 ? (
          <div className="divide-y divide-surface-3">
            {filteredRows.map((r) => (
              <ReviewRow key={r.id} r={r} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted py-8">
            No reviews yet for this property.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
