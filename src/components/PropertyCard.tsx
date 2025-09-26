import { Listing } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Bed, Bath, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PropertyCardProps {
  listing: Listing;
  className?: string;
  onClick?: () => void;
}

export function PropertyCard({ listing, className, onClick }: PropertyCardProps) {
  const navigate = useNavigate();

  const handleViewDetails = () => {
    navigate(`/properties/${listing.id}`);
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div 
      className={`group overflow-hidden rounded-lg border border-surface-3 bg-surface hover:shadow-lg transition-all duration-normal cursor-pointer ${className}`}
      data-testid="listing-card"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative overflow-hidden">
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="h-48 w-full object-cover transition-transform duration-normal group-hover:scale-105"
        />
        {listing.intlFriendly && (
          <Badge 
            variant="accent" 
            className="absolute top-3 right-3 shadow-sm"
          >
            <Globe className="h-3 w-3 mr-1" />
            Intl Friendly
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-lg text-foreground line-clamp-2 group-hover:text-accent transition-colors">
          {listing.title}
        </h3>

        {/* Price */}
        <div className="flex items-center justify-between">
          <p 
            className="text-2xl font-bold text-accent"
            data-testid="price"
          >
            ${listing.price.toLocaleString()}/mo
          </p>
        </div>

        {/* Address */}
        <p className="text-muted text-sm line-clamp-1">
          {listing.address}
        </p>

        {/* Amenities */}
        <div className="flex gap-2 flex-wrap">
          <Chip variant="muted" size="sm">
            <Bed className="h-3 w-3" />
            {listing.beds} bed{listing.beds !== 1 ? 's' : ''}
          </Chip>
          <Chip variant="muted" size="sm">
            <Bath className="h-3 w-3" />
            {listing.baths} bath{listing.baths !== 1 ? 's' : ''}
          </Chip>
        </div>

        {/* CTA Button */}
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