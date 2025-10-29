import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Bed, Bath, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { VTCommunityBadge } from "@/components/VTCommunityBadge";

type AnyListing = Record<string, any>;

interface PropertyCardProps {
  listing: AnyListing;
  className?: string;
  onClick?: () => void;
}

// Known-good default image (works in a browser)
const DEFAULT_IMG =
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=600&fit=crop";

function normalizeListing(l: AnyListing) {
  const title: string = l.title ?? l.name ?? "Untitled";

  const rawImg =
    l.imageUrl ??
    l.image_url ??
    l.thumbnail_url ??
    l.thumbnailUrl ??
    (Array.isArray(l.photos) ? l.photos[0] : undefined);

  const hasRealImage = typeof rawImg === "string" && rawImg.trim().length > 0;
  const imageUrl: string | null = hasRealImage ? rawImg : null;

  const address: string = l.address ?? "";

  const backendPrice = l._priceRange?.min;
  const unitMinRent =
    l.min_rent ??
    l.minRent ??
    l.rent_min ??
    l.rentMin ??
    l.unit_price ??
    l.unitPrice ??
    l.units?.[0]?.rent_min ??
    l.units?.[0]?.rentMin ??
    l.min_rent_value ??
    l.minPrice;

  const rawMetaPrice = l?.amenities?._meta?.price;
  const metaPrice =
    typeof rawMetaPrice === "string" ? parseFloat(rawMetaPrice) : rawMetaPrice;

  const price: number = Number(backendPrice ?? l.price ?? unitMinRent ?? metaPrice ?? 0);

  const beds: number = Number(
    l.beds ??
      l.unit_beds ??
      l.unitBeds ??
      l.units?.[0]?.beds ??
      l?.amenities?._meta?.beds ??
      0
  );

  const bathsRaw =
    l.baths ??
    l.unit_baths ??
    l.unitBaths ??
    l.units?.[0]?.baths ??
    l?.amenities?._meta?.baths ??
    0;
  const baths: number =
    typeof bathsRaw === "string" ? parseFloat(bathsRaw) : Number(bathsRaw);

  const intlFriendly: boolean =
    typeof l.intlFriendly === "boolean"
      ? l.intlFriendly
      : Boolean(l?.amenities?._meta?.intlFriendly);

  return { id: l.id, title, imageUrl, hasRealImage, address, price, beds, baths, intlFriendly };
}

export function PropertyCard({ listing, className = "", onClick }: PropertyCardProps) {
  const navigate = useNavigate();
  const L = normalizeListing(listing);

  // 👇 Demo: randomize VT resident count (only ~30% get a badge)
  if (listing.vtResidentCount === undefined) {
    const showBadge = Math.random() < 0.3; // 30% chance
    listing.vtResidentCount = showBadge ? Math.floor(Math.random() * 5) + 1 : 0;
  }

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (L.id) navigate(`/properties/${L.id}`);
  };

  const handleCardClick = () => onClick?.();

  return (
    <div
      className={`group overflow-hidden rounded-lg border border-surface-3 bg-surface hover:shadow-lg transition-all duration-normal cursor-pointer ${className}`}
      data-testid="listing-card"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative overflow-hidden">
        {L.hasRealImage ? (
          <img
            src={L.imageUrl!}
            alt={L.title}
            className="h-48 w-full object-cover block transition-transform duration-normal group-hover:scale-105"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="h-48 w-full bg-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">📷</div>
              <div className="text-sm font-medium">No Image Found</div>
            </div>
          </div>
        )}

        {/* ✅ Show VT badge only if there are residents */}
        {listing.vtResidentCount > 0 && (
          <div className="absolute top-3 left-3 z-50">
            <VTCommunityBadge vtResidentCount={listing.vtResidentCount} />
          </div>
        )}

        {L.intlFriendly && (
          <Badge variant="accent" className="absolute top-3 right-3 shadow-sm">
            <Globe className="h-3 w-3 mr-1" />
            Intl Friendly
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-lg text-foreground line-clamp-2 group-hover:text-accent transition-colors">
          {L.title}
        </h3>

        <p className="text-2xl font-bold text-accent" data-testid="price">
          {L.price && L.price > 0 ? `$${Number(L.price).toLocaleString()}/mo` : "Call for pricing"}
        </p>

        <p className="text-muted text-sm line-clamp-1">{L.address}</p>

        <div className="flex gap-2 flex-wrap">
          <Chip variant="muted" size="sm">
            <Bed className="h-3 w-3" />
            {L.beds} bed{L.beds !== 1 ? "s" : ""}
          </Chip>
          <Chip variant="muted" size="sm">
            <Bath className="h-3 w-3" />
            {L.baths} bath{L.baths !== 1 ? "s" : ""}
          </Chip>
          {(listing as any).distanceFromCampus && (
            <Chip variant="muted" size="sm">
              <Globe className="h-3 w-3" />
              {(listing as any).distanceFromCampus} mi
            </Chip>
          )}
        </div>

        <Button
          onClick={handleViewDetails}
          variant="outline"
          className="w-full group-hover:border-accent group-hover:text-accent"
          data-testid="view-details"
        >
          View Details
        </Button>
      </div>
    </div>
  );
}