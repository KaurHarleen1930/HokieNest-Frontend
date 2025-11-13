// src/pages/VTCommunity.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/PropertyCard";
import { listingsAPI } from "@/lib/api";
import { Home, MapPin, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function VTCommunity() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      setLoading(true);
      setError(null);
      // listingsAPI.getAll() returns Listing[] directly
      const data = await listingsAPI.getAll();
      // Show all listings - they are all from VT community
      setListings(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error loading listings:", err);
      setError(err.message || "Failed to load listings");
      toast.error("Failed to load VT Community listings");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (listingId: string) => {
    setDeletingId(listingId);
    try {
      await listingsAPI.delete(listingId);
      toast.success("Listing deleted successfully");
      // Reload listings to reflect the deletion
      await loadListings();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete listing");
    } finally {
      setDeletingId(null);
    }
  };

  const isOwner = (listing: any): boolean => {
    if (!user || !isAuthenticated) return false;
    // Check raw description for owner metadata: [OWNER_ID:userId]
    const rawDescription = listing._rawDescription || listing.description || '';
    if (rawDescription) {
      const ownerIdMatch = rawDescription.match(/\[OWNER_ID:([^\]]+)\]/);
      if (ownerIdMatch && ownerIdMatch[1] === user.id.toString()) {
        return true;
      }
    }
    // Check created_by if it exists
    if (listing.created_by && listing.created_by.toString() === user.id.toString()) {
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Home className="h-10 w-10 text-accent" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                VT Listings
              </h1>
            </div>
            <p className="text-lg text-muted-foreground mb-6">
              Browse properties posted by Virginia Tech students.
              <br />
              <span className="text-sm">All listings shown here are posted by VT students.</span>
            </p>
            {isAuthenticated && (
              <Button
                variant="accent"
                size="lg"
                className="gap-2"
                onClick={() => navigate("/post-listing")}
              >
                <Plus className="h-5 w-5" />
                Post New Listing
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Listings Section */}
      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading listings...</p>
          </div>
        ) : error ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={loadListings}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : listings.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>No Listings Yet</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-6">
                Be the first to post a listing!
              </p>
              {isAuthenticated && (
                <Button
                  variant="accent"
                  onClick={() => navigate("/post-listing")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Post New Listing
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                {listings.length} Listing{listings.length !== 1 ? "s" : ""}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => {
                const userOwnsListing = isOwner(listing);
                return (
                  <div key={listing.id} className="relative group">
                    <PropertyCard
                      listing={listing}
                      onClick={() => navigate(`/properties/${listing.id}`)}
                    />
                    {userOwnsListing && (
                      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={deletingId === listing.id}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Listing?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{listing.title || listing.name}"? 
                                This action cannot be undone. The listing and all associated units will be permanently removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(listing.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deletingId === listing.id ? "Deleting..." : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

