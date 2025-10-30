import { supabase } from "@/lib/supabase";

export type ReviewItem = {
  id: string;
  property_id: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  rating: number;
  title: string | null;
  review_text: string | null;
  created_at: string;
  source: string | null;                // 'google' | 'vt'
  source_permalink_url: string | null;
  is_published: boolean | null;
};

export type ReviewStats = { avg_rating: number; count: number };

export async function fetchReviews(propertyId: string): Promise<ReviewItem[]> {
  const { data, error } = await supabase
    .from("property_reviews")
    .select(
      "id, property_id, reviewer_name, reviewer_email, rating, title, review_text, created_at, source, source_permalink_url, is_published"
    )
    .eq("property_id", propertyId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as ReviewItem[];
}

export async function fetchReviewStats(propertyId: string): Promise<ReviewStats> {
  const { data, error, count } = await supabase
    .from("property_reviews")
    .select("rating", { count: "exact" })
    .eq("property_id", propertyId)
    .eq("is_published", true);

  if (error) throw error;

  const ratings = (data ?? [])
    .map((d: any) => Number(d.rating))
    .filter((n) => !Number.isNaN(n));
  const c = typeof count === "number" ? count : ratings.length;
  const avg = c ? ratings.reduce((a, b) => a + b, 0) / c : 0;

  return { avg_rating: avg, count: c };
}

/** Insert directly into Supabase (no server endpoint). */
export async function createReview(
  propertyId: string,
  {
    rating,
    title,
    text,
    anonymous,
    name,
    email,
  }: { rating: number; title?: string; text: string; anonymous: boolean; name?: string; email?: string }
) {
  const safeRating = Math.max(1, Math.min(5, Number(rating)));
  const displayName = anonymous ? "Anonymous" : (name?.trim() || "Anonymous");
  const emailToStore = anonymous ? null : (email?.trim() || null);

  const { error } = await supabase.from("property_reviews").insert({
    property_id: propertyId,
    reviewer_name: displayName,     // NOT NULL
    reviewer_email: emailToStore,   // null when anonymous
    rating: safeRating,
    title: title?.trim() || null,
    review_text: text.trim(),
    source: "vt",
    is_published: true,
  });

  if (error) throw new Error(error.message || "Failed to submit review");
}
