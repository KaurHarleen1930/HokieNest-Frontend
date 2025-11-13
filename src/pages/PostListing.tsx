import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { listingsAPI } from "@/lib/api";
import { Home, AlertCircle, Plus, Trash2, Loader2, Upload, X, Image as ImageIcon, MessageCircle, List, Eye, MoreVertical, ChevronDown, ChevronUp, MapPin, Bed, Bath, DollarSign, Calendar, Info, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { PropertyCard } from "@/components/PropertyCard";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Unit {
  beds: number;
  baths: number;
  rent_min?: number;
  rent_max?: number;
  availability_status: string;
  square_feet?: number;
  unit_number?: string;
}

export default function PostListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [duplicateListingId, setDuplicateListingId] = useState<string | null>(null);
  const [isDuplicateOwner, setIsDuplicateOwner] = useState(false);
  
  // Get initial tab from URL params, default to 'post'
  const tabFromUrl = searchParams.get('tab') as 'post' | 'my-listings' | null;
  const [activeTab, setActiveTab] = useState<'post' | 'my-listings'>(tabFromUrl === 'my-listings' ? 'my-listings' : 'post');
  
  // Sync tab with URL when URL changes (e.g., from navigation)
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab === 'my-listings' && activeTab !== 'my-listings') {
      setActiveTab('my-listings');
    } else if (urlTab !== 'my-listings' && activeTab === 'my-listings') {
      setActiveTab('post');
    }
  }, [searchParams]);
  
  // Update URL when tab changes locally
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (activeTab === 'my-listings' && currentTab !== 'my-listings') {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', 'my-listings');
      setSearchParams(newParams, { replace: true });
    } else if (activeTab === 'post' && currentTab === 'my-listings') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('tab');
      setSearchParams(newParams, { replace: true });
    }
  }, [activeTab]);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [loadingMyListings, setLoadingMyListings] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedListingId, setExpandedListingId] = useState<string | null>(null);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [loadingListingData, setLoadingListingData] = useState(false);

  // Property fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [intlFriendly, setIntlFriendly] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityInput, setAmenityInput] = useState("");
  const [yearBuilt, setYearBuilt] = useState<number | undefined>(undefined);
  const [totalUnits, setTotalUnits] = useState<number | undefined>(undefined);
  
  // New fields
  const [listingType, setListingType] = useState<'whole_apartment' | 'private_room' | 'shared_room' | ''>('');
  const [petFriendly, setPetFriendly] = useState(false);
  const [utilitiesIncluded, setUtilitiesIncluded] = useState(false);
  const [leaseTermMonths, setLeaseTermMonths] = useState<number | undefined>(undefined);
  const [moveInDate, setMoveInDate] = useState("");
  const [parkingAvailable, setParkingAvailable] = useState(false);
  const [furnished, setFurnished] = useState(false);
  const [securityDeposit, setSecurityDeposit] = useState<number | undefined>(undefined);
  const [applicationFee, setApplicationFee] = useState<number | undefined>(undefined);

  // Units
  const [units, setUnits] = useState<Unit[]>([
    {
      beds: 1,
      baths: 1,
      rent_min: undefined,
      rent_max: undefined,
      availability_status: "available",
      square_feet: undefined,
      unit_number: "",
    },
  ]);

  // Redirect if not authenticated
  if (!user) {
    navigate("/login");
    return null;
  }

  // Fetch user's listings when component mounts or when switching to my-listings tab
  useEffect(() => {
    if (activeTab === 'my-listings' && user) {
      loadMyListings();
    }
  }, [activeTab, user]);

  const loadMyListings = async () => {
    try {
      setLoadingMyListings(true);
      const allListings = await listingsAPI.getAll();
      
      // Filter to only show user's listings
      const userListings = allListings.filter((listing: any) => {
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
      });
      
      setMyListings(userListings);
    } catch (err: any) {
      console.error("Error loading my listings:", err);
      toast.error("Failed to load your listings");
    } finally {
      setLoadingMyListings(false);
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    setDeletingId(listingId);
    try {
      console.log('🗑️ Attempting to delete listing:', listingId);
      const result = await listingsAPI.delete(listingId);
      console.log('✅ Delete successful:', result);
      toast.success("Listing deleted successfully");
      // Reload listings
      await loadMyListings();
    } catch (error: any) {
      console.error('❌ Delete error:', error);
      const errorMessage = error?.message || error?.response?.data?.message || error?.response?.data?.error || "Failed to delete listing";
      console.error('Error details:', {
        message: errorMessage,
        status: error?.status,
        response: error?.response
      });
      toast.error(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  // Parse description metadata to extract fields
  const parseDescriptionMetadata = (description: string) => {
    const metadata: any = {};
    
    if (!description) return metadata;
    
    // Extract ZIP
    const zipMatch = description.match(/ZIP:\s*([^\n]+)/i);
    if (zipMatch) metadata.zip_code = zipMatch[1].trim();
    
    // Extract Type
    const typeMatch = description.match(/Type:\s*([^\n]+)/i);
    if (typeMatch) {
      const type = typeMatch[1].trim().replace(/\s+/g, '_').toLowerCase();
      if (['whole_apartment', 'private_room', 'shared_room'].includes(type)) {
        metadata.listing_type = type;
      }
    }
    
    // Extract Year Built
    const yearMatch = description.match(/Year Built:\s*(\d+)/i);
    if (yearMatch) metadata.year_built = parseInt(yearMatch[1]);
    
    // Extract Total Units
    const unitsMatch = description.match(/Total Units:\s*(\d+)/i);
    if (unitsMatch) metadata.total_units = parseInt(unitsMatch[1]);
    
    // Extract boolean flags
    metadata.intl_friendly = /International Student Friendly/i.test(description);
    metadata.pet_friendly = /Pet Friendly/i.test(description);
    metadata.utilities_included = /Utilities Included/i.test(description);
    metadata.parking_available = /Parking Available/i.test(description);
    metadata.furnished = /Furnished/i.test(description);
    
    // Extract Lease Term
    const leaseMatch = description.match(/Lease Term:\s*(\d+)/i);
    if (leaseMatch) metadata.lease_term_months = parseInt(leaseMatch[1]);
    
    // Extract Move-in Date
    const moveInMatch = description.match(/Move-in Date:\s*([^\n]+)/i);
    if (moveInMatch) metadata.move_in_date = moveInMatch[1].trim();
    
    // Extract Security Deposit
    const depositMatch = description.match(/Security Deposit:\s*\$?(\d+(?:,\d+)?)/i);
    if (depositMatch) metadata.security_deposit = parseInt(depositMatch[1].replace(/,/g, ''));
    
    // Extract Application Fee
    const feeMatch = description.match(/Application Fee:\s*\$?(\d+(?:,\d+)?)/i);
    if (feeMatch) metadata.application_fee = parseInt(feeMatch[1].replace(/,/g, ''));
    
    // Extract Website
    const websiteMatch = description.match(/Website:\s*([^\n]+)/i);
    if (websiteMatch) metadata.website_url = websiteMatch[1].trim();
    
    // Extract Amenities
    const amenitiesMatch = description.match(/Amenities:\s*([^\n]+)/i);
    if (amenitiesMatch) {
      metadata.amenities = amenitiesMatch[1].split(',').map((a: string) => a.trim()).filter((a: string) => a.length > 0);
    }
    
    // Extract Photos
    const photosMatch = description.match(/Photos:\s*([^\n]+)/i);
    if (photosMatch) {
      metadata.photos = photosMatch[1].split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    }
    
    // Extract clean description (remove metadata section)
    const cleanDesc = description.replace(/\[OWNER_ID:[^\]]+\]\n?/g, '').split('\n\nAdditional Information:')[0].trim();
    metadata.description = cleanDesc || '';
    
    return metadata;
  };

  const handleEditListing = async (listingId: string) => {
    try {
      setLoadingListingData(true);
      setEditingListingId(listingId);
      
      // Fetch full listing details
      const listing = await listingsAPI.getById(listingId);
      
      // Parse the listing data and populate form
      const metadata = parseDescriptionMetadata(listing.description || '');
      
      // Set basic fields
      setName(listing.title || listing.name || '');
      setAddress(listing.address || '');
      setCity(listing.city || '');
      setState(listing.state || '');
      setZipCode(metadata.zip_code || listing.zip_code || '');
      
      // Set description - use metadata description if available, otherwise cleaned description
      const cleanDescription = metadata.description || 
        (listing.description ? listing.description.replace(/\[OWNER_ID:[^\]]+\]\n?/g, '').split('\n\nAdditional Information:')[0].trim() : '');
      setDescription(cleanDescription || '');
      
      setWebsiteUrl(metadata.website_url || listing.website_url || '');
      setIntlFriendly(metadata.intl_friendly !== undefined ? metadata.intl_friendly : (listing.intlFriendly || false));
      setPhotos(listing.photos && listing.photos.length > 0 ? listing.photos : (metadata.photos || []));
      setAmenities(metadata.amenities && metadata.amenities.length > 0 ? metadata.amenities : (listing.amenities || []));
      setYearBuilt(metadata.year_built || listing.year_built);
      setTotalUnits(metadata.total_units || listing.total_units);
      setListingType(metadata.listing_type || '');
      setPetFriendly(metadata.pet_friendly || false);
      setUtilitiesIncluded(metadata.utilities_included || false);
      setLeaseTermMonths(metadata.lease_term_months);
      setMoveInDate(metadata.move_in_date || '');
      setParkingAvailable(metadata.parking_available || false);
      setFurnished(metadata.furnished || false);
      setSecurityDeposit(metadata.security_deposit);
      setApplicationFee(metadata.application_fee);
      setLatitude(listing.latitude);
      setLongitude(listing.longitude);
      
      // Set units - prefer _units from listing, otherwise create default from listing data
      if (listing._units && listing._units.length > 0) {
        setUnits(listing._units.map((unit: any) => ({
          beds: unit.beds || 0,
          baths: unit.baths || 0,
          rent_min: unit.rent_min,
          rent_max: unit.rent_max,
          availability_status: unit.availability_status || 'available',
          square_feet: unit.square_feet,
          unit_number: unit.unit_number || '',
        })));
      } else if (listing.beds && listing.beds > 0) {
        // Create unit from listing data if no units exist
        setUnits([{
          beds: listing.beds || 1,
          baths: listing.baths || 1,
          rent_min: listing._priceRange?.min || listing.price,
          rent_max: listing._priceRange?.max || listing.price,
          availability_status: 'available',
          square_feet: undefined,
          unit_number: '',
        }]);
      }
      
      // Switch to post tab and scroll to top
      setActiveTab('post');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      toast.success("Listing data loaded. Update the fields and click 'Update Listing' to save changes.");
    } catch (error: any) {
      console.error('Error loading listing for edit:', error);
      toast.error("Failed to load listing data");
      setEditingListingId(null);
    } finally {
      setLoadingListingData(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingListingId(null);
    // Reset form to default values
    setName("");
    setAddress("");
    setCity("");
    setState("");
    setZipCode("");
    setDescription("");
    setLatitude(undefined);
    setLongitude(undefined);
    setWebsiteUrl("");
    setIntlFriendly(false);
    setPhotos([]);
    setPhotoUrl("");
    setAmenities([]);
    setAmenityInput("");
    setYearBuilt(undefined);
    setTotalUnits(undefined);
    setListingType('');
    setPetFriendly(false);
    setUtilitiesIncluded(false);
    setLeaseTermMonths(undefined);
    setMoveInDate("");
    setParkingAvailable(false);
    setFurnished(false);
    setSecurityDeposit(undefined);
    setApplicationFee(undefined);
    setUnits([{
      beds: 1,
      baths: 1,
      rent_min: undefined,
      rent_max: undefined,
      availability_status: "available",
      square_feet: undefined,
      unit_number: "",
    }]);
    toast.info("Edit mode cancelled");
  };

  const addUnit = () => {
    setUnits([
      ...units,
      {
        beds: 1,
        baths: 1,
        rent_min: undefined,
        rent_max: undefined,
        availability_status: "available",
        square_feet: undefined,
        unit_number: "",
      },
    ]);
  };

  const removeUnit = (index: number) => {
    if (units.length > 1) {
      setUnits(units.filter((_, i) => i !== index));
    }
  };

  const updateUnit = (index: number, field: keyof Unit, value: any) => {
    const updated = [...units];
    updated[index] = { ...updated[index], [field]: value };
    setUnits(updated);
  };

  const addPhoto = () => {
    if (photoUrl.trim()) {
      setPhotos([...photos, photoUrl.trim()]);
      setPhotoUrl("");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }

      setUploadingPhotos(prev => [...prev, file.name]);
      try {
        const result = await listingsAPI.uploadPhoto(file);
        setPhotos(prev => [...prev, result.url]);
        toast.success(`${file.name} uploaded successfully`);
      } catch (error: any) {
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
      } finally {
        setUploadingPhotos(prev => prev.filter(name => name !== file.name));
      }
    }
    // Reset input
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const addAmenity = () => {
    if (amenityInput.trim() && !amenities.includes(amenityInput.trim())) {
      setAmenities([...amenities, amenityInput.trim()]);
      setAmenityInput("");
    }
  };

  const removeAmenity = (index: number) => {
    setAmenities(amenities.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validation
    if (!name.trim()) {
      setError("Property name is required");
      setIsLoading(false);
      return;
    }
    if (!address.trim()) {
      setError("Address is required");
      setIsLoading(false);
      return;
    }
    if (!city.trim()) {
      setError("City is required");
      setIsLoading(false);
      return;
    }
    if (!state.trim() || state.length !== 2) {
      setError("State must be 2 characters (e.g., VA)");
      setIsLoading(false);
      return;
    }
    if (units.length === 0) {
      setError("At least one unit is required");
      setIsLoading(false);
      return;
    }

    try {
      // Validate and clean listing type
      let validListingType: 'whole_apartment' | 'private_room' | 'shared_room' | undefined = undefined;
      if (listingType && listingType !== '') {
        if (['whole_apartment', 'private_room', 'shared_room'].includes(listingType)) {
          validListingType = listingType as 'whole_apartment' | 'private_room' | 'shared_room';
        }
      }

      // Validate website URL - must be a valid URL if provided
      let validWebsiteUrl: string | undefined = undefined;
      if (websiteUrl.trim()) {
        try {
          new URL(websiteUrl.trim());
          validWebsiteUrl = websiteUrl.trim();
        } catch {
          // Invalid URL, skip it
          console.warn('Invalid website URL, skipping:', websiteUrl);
        }
      }

      // Validate photos - must be valid URLs
      const validPhotos = photos.filter((photo) => {
        try {
          new URL(photo);
          return true;
        } catch {
          console.warn('Invalid photo URL, skipping:', photo);
          return false;
        }
      });

      const listingData = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zip_code: zipCode.trim() || undefined,
        description: description.trim() || undefined,
        // Convert null to undefined for optional numeric fields
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        website_url: validWebsiteUrl,
        intl_friendly: intlFriendly,
        photos: validPhotos.length > 0 ? validPhotos : undefined,
        amenities: amenities.length > 0 ? amenities : undefined,
        thumbnail_url: validPhotos.length > 0 ? validPhotos[0] : undefined,
        year_built: yearBuilt ?? undefined,
        total_units: totalUnits || units.length,
        listing_type: validListingType,
        pet_friendly: petFriendly,
        utilities_included: utilitiesIncluded,
        lease_term_months: leaseTermMonths ?? undefined,
        move_in_date: moveInDate.trim() || undefined,
        parking_available: parkingAvailable,
        furnished: furnished,
        security_deposit: securityDeposit ?? undefined,
        application_fee: applicationFee ?? undefined,
        units: units.map((unit) => ({
          beds: unit.beds || 0,
          baths: unit.baths || 0,
          rent_min: unit.rent_min ?? undefined,
          rent_max: unit.rent_max ?? undefined,
          availability_status: unit.availability_status || 'available',
          square_feet: unit.square_feet ?? undefined,
          unit_number: unit.unit_number?.trim() || undefined,
        })),
      };

      // Check if we're in edit mode
      if (editingListingId) {
        // Update existing listing
        const result = await listingsAPI.update(editingListingId, listingData);
        toast.success("Listing updated successfully!");
        setEditingListingId(null);
        // Reload listings and switch to my-listings tab
        setActiveTab('my-listings');
        await loadMyListings();
        // Reset form
        handleCancelEdit();
      } else {
        // Create new listing
        const result = await listingsAPI.create(listingData);
        // Clear any duplicate state on success
        setDuplicateListingId(null);
        setIsDuplicateOwner(false);
        toast.success("Listing created successfully!");
        navigate(`/properties/${result.listing.id}`);
      }
    } catch (err: any) {
      // Handle validation errors
      if (err?.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const validationErrors = err.response.data.errors;
        const errorMessages = validationErrors.map((e: any) => {
          const path = e.path?.join('.') || 'field';
          return `${path}: ${e.message}`;
        }).join(', ');
        setError(`Validation errors: ${errorMessages}`);
        toast.error(`Please fix the following errors: ${errorMessages}`);
        setIsLoading(false);
        return;
      }
      
      // Handle duplicate listing error specifically
      let errorMessage = err?.message || (editingListingId ? "Failed to update listing" : "Failed to create listing");
      
      // Check for duplicate error in various formats
      const isDuplicateError = err?.message?.includes('duplicate') || 
                               err?.message?.includes('already exists') ||
                               err?.message?.includes('unique constraint') ||
                               err?.message?.includes('ux_apartment_properties_listings_name_address');
      
      if (isDuplicateError) {
        // Try to extract a better error message from the response
        if (err?.response?.data?.message) {
          errorMessage = err.response.data.message;
          if (err.response.data.suggestion) {
            errorMessage += ` ${err.response.data.suggestion}`;
          }
          
          // If there's an existing listing ID, offer to view it
          if (err.response.data.existingListingId) {
            const listingId = err.response.data.existingListingId;
            const isOwner = err.response.data.isOwner;
            
            setDuplicateListingId(listingId);
            setIsDuplicateOwner(isOwner);
            
            if (isOwner) {
              errorMessage += ` You can view and update your existing listing.`;
            } else {
              errorMessage += ` You can view the existing listing to see if it's the same property.`;
            }
            
            // Show toast with action button using sonner's format
            toast.error(errorMessage, {
              action: {
                label: isOwner ? 'View Listing' : 'View Existing',
                onClick: () => navigate(`/properties/${listingId}`)
              },
              duration: 10000
            });
          } else {
            setDuplicateListingId(null);
            setIsDuplicateOwner(false);
            toast.error(errorMessage);
          }
        } else if (err?.response?.data?.error) {
          errorMessage = err.response.data.error;
          if (err.response.data.suggestion) {
            errorMessage += ` ${err.response.data.suggestion}`;
          }
          toast.error(errorMessage);
        } else {
          errorMessage = "A listing with this name and address already exists. Please use a different name or address, or update the existing listing if it belongs to you.";
          toast.error(errorMessage);
        }
      } else {
        toast.error(errorMessage);
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-surface border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center max-w-3xl mx-auto">
            <div className="mb-6">
              <div className="inline-flex items-center gap-3 bg-card border border-border rounded-full px-6 py-3 mb-6">
                <Home className="h-5 w-5 text-accent" />
                <span className="text-sm font-semibold text-primary">
                  {editingListingId ? 'Edit Your Listing' : 'Post New Listing'}
                </span>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4 leading-tight">
              {editingListingId ? (
                <>
                  Edit Your
                  <span className="text-accent"> Listing</span>
                </>
              ) : (
                <>
                  Share Your
                  <span className="text-accent"> Hokie Home</span>
                </>
              )}
            </h1>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              {editingListingId
                ? 'Update your listing information below. Make sure all details are accurate.'
                : 'List your property and help fellow Hokies find their perfect living space near Virginia Tech campus.'}
            </p>
            {editingListingId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                className="mb-4"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Edit
              </Button>
            )}
          </div>
        </div>
        {/* Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full bg-accent/5 blur-3xl"></div>
          <div className="absolute bottom-1/4 left-1/4 h-64 w-64 rounded-full bg-primary/5 blur-3xl"></div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab('post')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'post'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Post New Listing
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('my-listings')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'my-listings'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <List className="h-4 w-4" />
                My Listings
                {myListings.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-accent/10 text-accent rounded-full">
                    {myListings.length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* My Listings View */}
        {activeTab === 'my-listings' && (
          <div className="space-y-6">
            <Card className="bg-card border-border shadow-md">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-primary">My Listings</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Manage your posted listings. You can view, edit, or delete them here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMyListings ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-accent" />
                    <p className="text-muted-foreground">Loading your listings...</p>
                  </div>
                ) : myListings.length === 0 ? (
                  <div className="text-center py-12">
                    <Home className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Listings Yet</h3>
                    <p className="text-muted-foreground mb-6">
                      You haven't posted any listings yet. Start by posting your first listing!
                    </p>
                    <Button
                      variant="accent"
                      onClick={() => setActiveTab('post')}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Post New Listing
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {myListings.map((listing) => {
                      console.log('📋 Listing in map:', { id: listing.id, title: listing.title || listing.name });
                      const isExpanded = expandedListingId === listing.id;
                      return (
                      <Card key={listing.id} className="bg-card border-border shadow-md overflow-hidden">
                        <div className="relative">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                            {/* Image and Basic Info */}
                            <div className="md:col-span-1">
                              <PropertyCard
                                listing={listing}
                                onClick={() => navigate(`/properties/${listing.id}`)}
                              />
                            </div>
                            
                            {/* Details Section */}
                            <div className="md:col-span-2 space-y-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="text-xl font-bold text-foreground mb-2">
                                    {listing.title || listing.name}
                                  </h3>
                                  <div className="flex items-center gap-2 text-muted-foreground mb-3">
                                    <MapPin className="h-4 w-4" />
                                    <span className="text-sm">
                                      {listing.address}{listing.city ? `, ${listing.city}` : ''}{listing.state ? `, ${listing.state}` : ''}
                                    </span>
                                  </div>
                                  
                                  {/* Quick Stats */}
                                  <div className="flex flex-wrap gap-4 mb-3">
                                    {listing._priceRange && (listing._priceRange.min > 0 || listing._priceRange.max > 0) && (
                                      <div className="flex items-center gap-1 text-sm">
                                        <DollarSign className="h-4 w-4 text-accent" />
                                        <span className="font-semibold">
                                          ${listing._priceRange.min.toLocaleString()}
                                          {listing._priceRange.max > listing._priceRange.min && ` - $${listing._priceRange.max.toLocaleString()}`}
                                          /mo
                                        </span>
                                      </div>
                                    )}
                                    {listing.beds > 0 && (
                                      <div className="flex items-center gap-1 text-sm">
                                        <Bed className="h-4 w-4 text-muted-foreground" />
                                        <span>{listing.beds} bed{listing.beds !== 1 ? 's' : ''}</span>
                                      </div>
                                    )}
                                    {listing.baths > 0 && (
                                      <div className="flex items-center gap-1 text-sm">
                                        <Bath className="h-4 w-4 text-muted-foreground" />
                                        <span>{listing.baths} bath{listing.baths !== 1 ? 's' : ''}</span>
                                      </div>
                                    )}
                                    {listing._unitCount !== undefined && (
                                      <div className="flex items-center gap-1 text-sm">
                                        <Home className="h-4 w-4 text-muted-foreground" />
                                        <span>{listing._unitCount} unit{listing._unitCount !== 1 ? 's' : ''}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/properties/${listing.id}`);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditListing(listing.id);
                                    }}
                                    disabled={loadingListingData}
                                  >
                                    {loadingListingData && editingListingId === listing.id ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Loading...
                                      </>
                                    ) : (
                                      <>
                                        <Edit2 className="h-4 w-4 mr-2" />
                                        Edit
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedListingId(isExpanded ? null : listing.id);
                                    }}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="h-4 w-4 mr-2" />
                                        Less
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="h-4 w-4 mr-2" />
                                        More
                                      </>
                                    )}
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={deletingId === listing.id}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {deletingId === listing.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Listing?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove "{listing.title || listing.name}"? 
                                          This action cannot be undone. The listing and all associated units will be permanently removed.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteListing(listing.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          {deletingId === listing.id ? "Removing..." : "Remove"}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                              
                              {/* Expanded Details */}
                              {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-border space-y-4 animate-in slide-in-from-top-2">
                                  {/* Description */}
                                  {listing.description && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Info className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-semibold text-foreground">Description</span>
                                      </div>
                                      <p className="text-sm text-muted-foreground line-clamp-3">
                                        {listing.description}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Additional Details */}
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {listing.createdAt && (
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <Calendar className="h-3 w-3 text-muted-foreground" />
                                          <span className="text-xs font-semibold text-muted-foreground">Posted</span>
                                        </div>
                                        <p className="text-sm text-foreground">
                                          {new Date(listing.createdAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                    )}
                                    {listing._availableUnitCount !== undefined && (
                                      <div>
                                        <span className="text-xs font-semibold text-muted-foreground block mb-1">Available Units</span>
                                        <p className="text-sm text-foreground font-semibold text-accent">
                                          {listing._availableUnitCount} of {listing._unitCount || 0}
                                        </p>
                                      </div>
                                    )}
                                    {listing.intlFriendly && (
                                      <div>
                                        <span className="text-xs font-semibold text-muted-foreground block mb-1">Features</span>
                                        <p className="text-sm text-foreground">International Friendly</p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Amenities */}
                                  {listing.amenities && Array.isArray(listing.amenities) && listing.amenities.length > 0 && (
                                    <div>
                                      <span className="text-xs font-semibold text-muted-foreground block mb-2">Amenities</span>
                                      <div className="flex flex-wrap gap-2">
                                        {listing.amenities.slice(0, 6).map((amenity: string, idx: number) => (
                                          <Badge key={idx} variant="secondary" className="text-xs">
                                            {amenity}
                                          </Badge>
                                        ))}
                                        {listing.amenities.length > 6 && (
                                          <Badge variant="secondary" className="text-xs">
                                            +{listing.amenities.length - 6} more
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Photos Count */}
                                  {listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0 && (
                                    <div>
                                      <span className="text-xs font-semibold text-muted-foreground block mb-1">Photos</span>
                                      <p className="text-sm text-foreground">
                                        {listing.photos.length} photo{listing.photos.length !== 1 ? 's' : ''} uploaded
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Post New Listing View */}
        {activeTab === 'post' && (
          <>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{error}</span>
                  {duplicateListingId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/properties/${duplicateListingId}`)}
                      className="shrink-0"
                    >
                      {isDuplicateOwner ? 'View My Listing' : 'View Existing'}
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Basic Information</CardTitle>
              <CardDescription className="text-muted-foreground">Essential details about your property</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="listingType">Listing Type *</Label>
                <select
                  id="listingType"
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  required
                  disabled={isLoading}
                >
                  <option value="">Select listing type</option>
                  <option value="whole_apartment">Whole Apartment</option>
                  <option value="private_room">Private Room in Existing Apartment</option>
                  <option value="shared_room">Shared Room</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Choose whether you're listing an entire apartment, a private room, or a shared room
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Property Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., University Apartments"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main Street"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Blacksburg"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    placeholder="VA"
                    maxLength={2}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="24060"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude (optional)</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={latitude || ""}
                    onChange={(e) => setLatitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="37.2296"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude (optional)</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={longitude || ""}
                    onChange={(e) => setLongitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="-80.4139"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your property..."
                  rows={4}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Contact Information</CardTitle>
              <CardDescription className="text-muted-foreground">
                Potential renters will contact you through the secure messaging system. Your contact information will remain private.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL (Optional)</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  If you have a property website, you can add it here. All inquiries will go through our secure messaging system.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Units */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Units</CardTitle>
              <CardDescription className="text-muted-foreground">Add at least one unit to your listing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {units.map((unit, index) => (
                <Card key={index} className="p-4 bg-surface border-border">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold">Unit {index + 1}</h4>
                    {units.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUnit(index)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bedrooms</Label>
                      <Input
                        type="number"
                        min="0"
                        value={unit.beds}
                        onChange={(e) => updateUnit(index, "beds", parseInt(e.target.value) || 0)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bathrooms</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={unit.baths}
                        onChange={(e) => updateUnit(index, "baths", parseFloat(e.target.value) || 0)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Rent ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={unit.rent_min || ""}
                        onChange={(e) => updateUnit(index, "rent_min", e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Rent ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={unit.rent_max || ""}
                        onChange={(e) => updateUnit(index, "rent_max", e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Square Feet</Label>
                      <Input
                        type="number"
                        min="0"
                        value={unit.square_feet || ""}
                        onChange={(e) => updateUnit(index, "square_feet", e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit Number</Label>
                      <Input
                        value={unit.unit_number || ""}
                        onChange={(e) => updateUnit(index, "unit_number", e.target.value)}
                        placeholder="Apt 101"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Availability Status</Label>
                      <select
                        value={unit.availability_status}
                        onChange={(e) => updateUnit(index, "availability_status", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        disabled={isLoading}
                      >
                        <option value="available">Available</option>
                        <option value="vacant">Vacant</option>
                        <option value="ready">Ready</option>
                        <option value="occupied">Occupied</option>
                        <option value="unavailable">Unavailable</option>
                      </select>
                    </div>
                  </div>
                </Card>
              ))}
              <Button type="button" variant="outline" onClick={addUnit} disabled={isLoading}>
                <Plus className="h-4 w-4 mr-2" />
                Add Another Unit
              </Button>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Photos (Optional)</CardTitle>
              <CardDescription className="text-muted-foreground">Upload photos or add photo URLs for your property. Photos are optional but recommended.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label>Upload Photos</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    disabled={isLoading || uploadingPhotos.length > 0}
                    className="cursor-pointer"
                  />
                  {uploadingPhotos.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading {uploadingPhotos.length} photo(s)...
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  You can upload multiple images at once (max 10MB per image)
                </p>
              </div>

              {/* URL Input */}
              <div className="space-y-2">
                <Label>Or Add Photo URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    disabled={isLoading}
                  />
                  <Button type="button" onClick={addPhoto} disabled={isLoading || !photoUrl.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Photo Preview */}
              {photos.length > 0 && (
                <div className="space-y-2">
                  <Label>Uploaded Photos ({photos.length})</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-video rounded-lg overflow-hidden bg-surface-2 border border-surface-3">
                          <img
                            src={photo}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removePhoto(index)}
                          disabled={isLoading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Amenities */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Amenities</CardTitle>
              <CardDescription className="text-muted-foreground">List amenities available at your property</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  placeholder="e.g., Parking, Pool, Gym"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAmenity();
                    }
                  }}
                  disabled={isLoading}
                />
                <Button type="button" onClick={addAmenity} disabled={isLoading}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {amenities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {amenities.map((amenity, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1 bg-surface-2 rounded-full text-sm"
                    >
                      <span>{amenity}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() => removeAmenity(index)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Additional Information</CardTitle>
              <CardDescription className="text-muted-foreground">Lease terms, fees, and other important details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="yearBuilt">Year Built</Label>
                  <Input
                    id="yearBuilt"
                    type="number"
                    value={yearBuilt || ""}
                    onChange={(e) => setYearBuilt(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="2020"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalUnits">Total Units</Label>
                  <Input
                    id="totalUnits"
                    type="number"
                    value={totalUnits || ""}
                    onChange={(e) => setTotalUnits(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Auto-filled from units"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leaseTermMonths">Lease Term (Months)</Label>
                  <Input
                    id="leaseTermMonths"
                    type="number"
                    value={leaseTermMonths || ""}
                    onChange={(e) => setLeaseTermMonths(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="12"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="moveInDate">Move-in Date</Label>
                  <Input
                    id="moveInDate"
                    type="date"
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="securityDeposit">Security Deposit ($)</Label>
                  <Input
                    id="securityDeposit"
                    type="number"
                    min="0"
                    value={securityDeposit || ""}
                    onChange={(e) => setSecurityDeposit(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="500"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="applicationFee">Application Fee ($)</Label>
                  <Input
                    id="applicationFee"
                    type="number"
                    min="0"
                    value={applicationFee || ""}
                    onChange={(e) => setApplicationFee(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="50"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="intlFriendly"
                    checked={intlFriendly}
                    onCheckedChange={(checked) => setIntlFriendly(checked === true)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="intlFriendly" className="cursor-pointer">
                    International Student Friendly
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="petFriendly"
                    checked={petFriendly}
                    onCheckedChange={(checked) => setPetFriendly(checked === true)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="petFriendly" className="cursor-pointer">
                    Pet Friendly
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="utilitiesIncluded"
                    checked={utilitiesIncluded}
                    onCheckedChange={(checked) => setUtilitiesIncluded(checked === true)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="utilitiesIncluded" className="cursor-pointer">
                    Utilities Included
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="parkingAvailable"
                    checked={parkingAvailable}
                    onCheckedChange={(checked) => setParkingAvailable(checked === true)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="parkingAvailable" className="cursor-pointer">
                    Parking Available
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="furnished"
                    checked={furnished}
                    onCheckedChange={(checked) => setFurnished(checked === true)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="furnished" className="cursor-pointer">
                    Furnished
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator className="my-6" />

          {/* Submit Section */}
          <div className="bg-card border border-border rounded-lg shadow-md p-6">
            <div className="flex flex-col sm:flex-row justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => navigate("/properties")}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="lg"
                variant="accent"
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingListingId ? 'Updating...' : 'Posting...'}
                  </>
                ) : (
                  <>
                    {editingListingId ? (
                      <>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Update Listing
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Post New Listing
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center sm:text-right">
              {editingListingId
                ? 'Your changes will be saved immediately after submission.'
                : 'Your listing will be reviewed and published shortly after submission.'}
            </p>
          </div>
        </form>
          </>
        )}
      </div>
    </div>
  );
}

