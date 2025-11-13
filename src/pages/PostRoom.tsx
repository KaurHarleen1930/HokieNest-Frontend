import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { roomListingsAPI, listingsAPI } from "@/lib/api";
import { Home, AlertCircle, Plus, Trash2, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function PostRoom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Room fields
  const [listingType, setListingType] = useState<'private_room' | 'shared_room' | 'whole_unit'>('private_room');
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [beds, setBeds] = useState(1);
  const [baths, setBaths] = useState(1);
  const [squareFeet, setSquareFeet] = useState<number | undefined>(undefined);
  const [rentAmount, setRentAmount] = useState<number | undefined>(undefined);
  const [securityDeposit, setSecurityDeposit] = useState<number | undefined>(undefined);
  const [applicationFee, setApplicationFee] = useState<number | undefined>(undefined);
  const [moveInDate, setMoveInDate] = useState("");
  const [leaseTermMonths, setLeaseTermMonths] = useState<number | undefined>(undefined);
  const [furnished, setFurnished] = useState(false);
  const [petFriendly, setPetFriendly] = useState(false);
  const [utilitiesIncluded, setUtilitiesIncluded] = useState(false);
  const [parkingAvailable, setParkingAvailable] = useState(false);
  const [intlFriendly, setIntlFriendly] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityInput, setAmenityInput] = useState("");
  const [houseRules, setHouseRules] = useState("");
  const [preferredGender, setPreferredGender] = useState<'male' | 'female' | 'any'>('any');
  const [preferredAgeRange, setPreferredAgeRange] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [propertyId, setPropertyId] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setUploadingPhotos(fileArray.map(f => f.name));

    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }

      try {
        const result = await listingsAPI.uploadPhoto(file);
        setPhotos(prev => [...prev, result.url]);
        toast.success(`${file.name} uploaded successfully`);
      } catch (error: any) {
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    setUploadingPhotos([]);
    e.target.value = '';
  };

  const addPhoto = () => {
    if (photoUrl.trim() && !photos.includes(photoUrl.trim())) {
      setPhotos(prev => [...prev, photoUrl.trim()]);
      setPhotoUrl("");
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const addAmenity = () => {
    if (amenityInput.trim() && !amenities.includes(amenityInput.trim())) {
      setAmenities(prev => [...prev, amenityInput.trim()]);
      setAmenityInput("");
    }
  };

  const removeAmenity = (index: number) => {
    setAmenities(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validation
    if (!title.trim()) {
      setError("Title is required");
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
    if (!rentAmount || rentAmount <= 0) {
      setError("Rent amount is required");
      setIsLoading(false);
      return;
    }

    try {
      const listingData = {
        listing_type: listingType,
        title: title.trim(),
        description: description.trim() || undefined,
        address: address.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zip_code: zipCode.trim() || undefined,
        beds,
        baths,
        square_feet: squareFeet,
        rent_amount: rentAmount,
        security_deposit: securityDeposit,
        application_fee: applicationFee,
        move_in_date: moveInDate || undefined,
        lease_term_months: leaseTermMonths,
        furnished,
        pet_friendly: petFriendly,
        utilities_included: utilitiesIncluded,
        parking_available: parkingAvailable,
        intl_friendly: intlFriendly,
        photos: photos.length > 0 ? photos : undefined,
        amenities: amenities.length > 0 ? amenities : undefined,
        house_rules: houseRules.trim() || undefined,
        preferred_gender: preferredGender,
        preferred_age_range: preferredAgeRange.trim() || undefined,
        website_url: websiteUrl.trim() || undefined,
        property_id: propertyId || null,
      };

      const result = await roomListingsAPI.create(listingData);
      toast.success("Room listing created successfully!");
      // Navigate to properties page (we can create a room listing detail page later)
      navigate('/properties');
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to create room listing";
      setError(errorMessage);
      toast.error(errorMessage);
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
                <span className="text-sm font-semibold text-primary">Post Your Room</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4 leading-tight">
              List Your
              <span className="text-accent"> Available Room</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              Share your available room or unit and help fellow Hokies find their perfect living space.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Basic Information</CardTitle>
              <CardDescription className="text-muted-foreground">Tell us about your room</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="listingType">Listing Type *</Label>
                <select
                  id="listingType"
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  required
                >
                  <option value="private_room">Private Room</option>
                  <option value="shared_room">Shared Room</option>
                  <option value="whole_unit">Whole Unit</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Cozy private room in 3BR apartment"
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the room, location, and what makes it special..."
                  rows={4}
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Blacksburg"
                    disabled={isLoading}
                    required
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
                    disabled={isLoading}
                    required
                  />
                </div>
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
            </CardContent>
          </Card>

          {/* Room Details */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Room Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="beds">Beds *</Label>
                  <Input
                    id="beds"
                    type="number"
                    min="0"
                    value={beds}
                    onChange={(e) => setBeds(Number(e.target.value))}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baths">Baths *</Label>
                  <Input
                    id="baths"
                    type="number"
                    min="0"
                    step="0.5"
                    value={baths}
                    onChange={(e) => setBaths(Number(e.target.value))}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="squareFeet">Square Feet</Label>
                  <Input
                    id="squareFeet"
                    type="number"
                    min="0"
                    value={squareFeet || ""}
                    onChange={(e) => setSquareFeet(e.target.value ? Number(e.target.value) : undefined)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rentAmount">Monthly Rent ($) *</Label>
                  <Input
                    id="rentAmount"
                    type="number"
                    min="0"
                    value={rentAmount || ""}
                    onChange={(e) => setRentAmount(e.target.value ? Number(e.target.value) : undefined)}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="securityDeposit">Security Deposit ($)</Label>
                  <Input
                    id="securityDeposit"
                    type="number"
                    min="0"
                    value={securityDeposit || ""}
                    onChange={(e) => setSecurityDeposit(e.target.value ? Number(e.target.value) : undefined)}
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
                    onChange={(e) => setApplicationFee(e.target.value ? Number(e.target.value) : undefined)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="leaseTermMonths">Lease Term (months)</Label>
                  <Input
                    id="leaseTermMonths"
                    type="number"
                    min="1"
                    value={leaseTermMonths || ""}
                    onChange={(e) => setLeaseTermMonths(e.target.value ? Number(e.target.value) : undefined)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="furnished"
                    checked={furnished}
                    onCheckedChange={(checked) => setFurnished(checked as boolean)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="furnished">Furnished</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="petFriendly"
                    checked={petFriendly}
                    onCheckedChange={(checked) => setPetFriendly(checked as boolean)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="petFriendly">Pet Friendly</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="utilitiesIncluded"
                    checked={utilitiesIncluded}
                    onCheckedChange={(checked) => setUtilitiesIncluded(checked as boolean)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="utilitiesIncluded">Utilities Included</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="parkingAvailable"
                    checked={parkingAvailable}
                    onCheckedChange={(checked) => setParkingAvailable(checked as boolean)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="parkingAvailable">Parking Available</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="intlFriendly"
                    checked={intlFriendly}
                    onCheckedChange={(checked) => setIntlFriendly(checked as boolean)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="intlFriendly">International Student Friendly</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Roommate Preferences */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Roommate Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preferredGender">Preferred Gender</Label>
                <select
                  id="preferredGender"
                  value={preferredGender}
                  onChange={(e) => setPreferredGender(e.target.value as any)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  disabled={isLoading}
                >
                  <option value="any">Any</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredAgeRange">Preferred Age Range</Label>
                <Input
                  id="preferredAgeRange"
                  value={preferredAgeRange}
                  onChange={(e) => setPreferredAgeRange(e.target.value)}
                  placeholder="e.g., 18-25, 25-35"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="houseRules">House Rules</Label>
                <Textarea
                  id="houseRules"
                  value={houseRules}
                  onChange={(e) => setHouseRules(e.target.value)}
                  placeholder="Any house rules or preferences..."
                  rows={3}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Photos (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Upload Photos</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  disabled={isLoading || uploadingPhotos.length > 0}
                />
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <Card className="bg-card border-border shadow-md">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Listing...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-5 w-5" />
                      Create Room Listing
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/properties')}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}

