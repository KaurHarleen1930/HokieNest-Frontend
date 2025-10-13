import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNavigate } from "react-router-dom";
import { Edit, User, DollarSign, Calendar, MapPin, Moon, Sparkles, Users, Home, Briefcase, Heart, AlertCircle, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { preferencesAPI } from "@/lib/api";

interface RoommatePreferences {
  budgetRange: [number, number];
  moveInDate: string;
  leaseLength: string[];
  maxDistance: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  sleepSchedule: string;
  cleanlinessLevel: number;
  choresPreference: string;
  guestsFrequency: string;
  socialVibe: string;
  workFromHomeDays: number;
  hasPets: string[];
  comfortableWithPets: boolean;
  petAllergies: string[];
  smokingPolicy: string[];
}

export default function RoommateProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, token } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<RoommatePreferences | null>(null);
  const [editedPreferences, setEditedPreferences] = useState<RoommatePreferences | null>(null);

  // Load preferences from database on component mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (!isAuthenticated || !token) {
        // Fallback to localStorage if not authenticated
        const saved = localStorage.getItem("roommatePreferences");
        if (saved) {
          const parsedPreferences = JSON.parse(saved);
          setPreferences(parsedPreferences);
          setEditedPreferences(parsedPreferences);
        }
        setLoading(false);
        return;
      }

      try {
        const data = await preferencesAPI.getPreferences();
        
        if (data.housing && data.lifestyle) {
          // Convert database data back to frontend format
          const convertedPreferences: RoommatePreferences = {
            budgetRange: [data.housing.budget_min, data.housing.budget_max],
            moveInDate: data.housing.move_in_date ? data.housing.move_in_date.substring(0, 7) : "", // Convert YYYY-MM-DD to YYYY-MM
            leaseLength: [], // This field isn't in the database yet
            maxDistance: "", // This field isn't in the database yet
            quietHoursStart: "22:00", // Default values for fields not in database
            quietHoursEnd: "07:00",
            sleepSchedule: data.lifestyle.sleep_schedule === 'early' ? 'Early bird' : 
                          data.lifestyle.sleep_schedule === 'late' ? 'Night owl' : 'Flexible',
            cleanlinessLevel: data.lifestyle.cleanliness_level,
            choresPreference: "", // This field isn't in the database yet
            guestsFrequency: "", // This field isn't in the database yet
            socialVibe: data.lifestyle.noise_tolerance === 'quiet' ? 'Quiet – mostly keep to myself' :
                       data.lifestyle.noise_tolerance === 'moderate' ? 'Balanced – sometimes socialize, sometimes recharge' :
                       'Lively – I enjoy a busy, social household',
            workFromHomeDays: 3, // Default value
            hasPets: data.lifestyle.pets === 'has_pets' ? ['Yes — Dog'] : [], // Simplified mapping
            comfortableWithPets: data.lifestyle.pets !== 'allergic',
            petAllergies: data.lifestyle.pets === 'allergic' ? ['Cats'] : [],
            smokingPolicy: [], // Default value
          };
          
          setPreferences(convertedPreferences);
          setEditedPreferences(convertedPreferences);
          
          // Also save to localStorage as backup
          localStorage.setItem("roommatePreferences", JSON.stringify(convertedPreferences));
        } else {
          // No preferences in database, check localStorage
          const saved = localStorage.getItem("roommatePreferences");
          if (saved) {
            const parsedPreferences = JSON.parse(saved);
            setPreferences(parsedPreferences);
            setEditedPreferences(parsedPreferences);
          }
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
        // Fallback to localStorage
        const saved = localStorage.getItem("roommatePreferences");
        if (saved) {
          const parsedPreferences = JSON.parse(saved);
          setPreferences(parsedPreferences);
          setEditedPreferences(parsedPreferences);
        }
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [isAuthenticated, token]);

  const handleSave = async () => {
    if (!editedPreferences) return;

    try {
      if (isAuthenticated && token) {
        // Save to database
        await preferencesAPI.saveHousing(editedPreferences);
        await preferencesAPI.saveLifestyle(editedPreferences);
      }

      // Save to localStorage as backup
      localStorage.setItem("roommatePreferences", JSON.stringify(editedPreferences));
      setPreferences(editedPreferences);
      setIsEditing(false);
      
      toast({
        title: "Profile Updated",
        description: "Your roommate preferences have been saved successfully.",
      });
    } catch (error: any) {
      console.error("Failed to save preferences:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditedPreferences(preferences);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-primary mb-4">Loading Profile</h2>
          <p className="text-muted">
            Loading your roommate preferences...
          </p>
        </Card>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-muted mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-primary mb-4">No Profile Found</h2>
          <p className="text-muted mb-6">
            You haven't completed the roommate questionnaire yet.
          </p>
          <Button onClick={() => navigate("/roommate-questionnaire")}>
            Start Questionnaire
          </Button>
        </Card>
      </div>
    );
  }

  const formatMonthYear = (dateStr: string) => {
    if (!dateStr) return "Not specified";
    const [year, month] = dateStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const sections = [
    {
      icon: DollarSign,
      title: "Budget",
      color: "text-accent",
      bgColor: "bg-accent/10",
      items: [
        { label: "Monthly Budget Range", value: `$${preferences.budgetRange[0]} - $${preferences.budgetRange[1]}` },
      ],
    },
    {
      icon: Calendar,
      title: "Move-In & Lease",
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        { label: "Move-In Date", value: formatMonthYear(preferences.moveInDate) },
        { label: "Lease Length", value: preferences.leaseLength.join(", ") || "Not specified" },
      ],
    },
    {
      icon: MapPin,
      title: "Location",
      color: "text-accent",
      bgColor: "bg-accent/10",
      items: [
        { label: "Max Distance from Campus", value: preferences.maxDistance || "Not specified" },
      ],
    },
    {
      icon: Moon,
      title: "Sleep & Quiet Hours",
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        { label: "Quiet Hours", value: `${preferences.quietHoursStart} - ${preferences.quietHoursEnd}` },
        { label: "Sleep Schedule", value: preferences.sleepSchedule || "Not specified" },
      ],
    },
    {
      icon: Sparkles,
      title: "Cleanliness",
      color: "text-accent",
      bgColor: "bg-accent/10",
      items: [
        { label: "Tidiness Level", value: `${preferences.cleanlinessLevel}/5` },
        { label: "Chores Preference", value: preferences.choresPreference || "Not specified" },
      ],
    },
    {
      icon: Users,
      title: "Social Preferences",
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        { label: "Guests Frequency", value: preferences.guestsFrequency || "Not specified" },
        { label: "Social Vibe", value: preferences.socialVibe || "Not specified" },
      ],
    },
    {
      icon: Briefcase,
      title: "Work/Study Routine",
      color: "text-accent",
      bgColor: "bg-accent/10",
      items: [
        { label: "Work From Home", value: `${preferences.workFromHomeDays} days/week` },
      ],
    },
    {
      icon: Heart,
      title: "Pets",
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        { label: "Has Pets", value: preferences.hasPets.join(", ") || "None" },
        { label: "Comfortable With Pets", value: preferences.comfortableWithPets ? "Yes" : "No" },
        { label: "Pet Allergies", value: preferences.petAllergies.join(", ") || "None" },
      ],
    },
    {
      icon: Home,
      title: "Lifestyle Policies",
      color: "text-accent",
      bgColor: "bg-accent/10",
      items: [
        { label: "Smoking/Alcohol Policy", value: preferences.smokingPolicy.join(", ") || "Not specified" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-primary">Roommate Profile</h1>
                <p className="text-muted">Your preferences for finding the perfect match</p>
              </div>
            </div>
            {isEditing ? (
              <div className="flex gap-2">
                <Button onClick={handleCancel} variant="outline" className="gap-2">
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditing(true)} className="gap-2">
                <Edit className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        {/* Compatibility Score Banner */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-primary mb-2">Profile Complete!</h3>
            <p className="text-muted">
              We'll use this information to match you with compatible roommates. The more detailed your preferences, the better the matches.
            </p>
          </div>
        </Card>

        {/* Preferences Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {isEditing ? (
            <>
              <Card className="p-6">
                <Label className="text-lg font-semibold text-primary mb-4 block">Budget Range</Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Min: ${editedPreferences?.budgetRange[0]}</span>
                      <span>Max: ${editedPreferences?.budgetRange[1]}</span>
                    </div>
                    <Slider
                      min={400}
                      max={2000}
                      step={50}
                      value={editedPreferences?.budgetRange}
                      onValueChange={(value) => setEditedPreferences(prev => prev ? {...prev, budgetRange: value as [number, number]} : null)}
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="text-lg font-semibold text-primary mb-4 block">Move-In & Lease</Label>
                <div className="space-y-4">
                  <div>
                    <Label>Move-In Date (YYYY-MM)</Label>
                    <Input
                      type="month"
                      value={editedPreferences?.moveInDate}
                      onChange={(e) => setEditedPreferences(prev => prev ? {...prev, moveInDate: e.target.value} : null)}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Lease Length</Label>
                    <div className="space-y-2">
                      {["One semester", "Full academic year", "12 months or more"].map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            checked={editedPreferences?.leaseLength.includes(option)}
                            onCheckedChange={(checked) => {
                              setEditedPreferences(prev => {
                                if (!prev) return null;
                                const updated = checked
                                  ? [...prev.leaseLength, option]
                                  : prev.leaseLength.filter(l => l !== option);
                                return {...prev, leaseLength: updated};
                              });
                            }}
                          />
                          <Label>{option}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="text-lg font-semibold text-primary mb-4 block">Location</Label>
                <div className="space-y-4">
                  <Label>Max Distance from Campus</Label>
                  <RadioGroup
                    value={editedPreferences?.maxDistance}
                    onValueChange={(value) => setEditedPreferences(prev => prev ? {...prev, maxDistance: value} : null)}
                  >
                    {["Within 5 minutes", "Within 10 minutes", "Within 15 minutes", "Up to 30 minutes"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={option} />
                        <Label htmlFor={option}>{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="text-lg font-semibold text-primary mb-4 block">Quiet Hours & Sleep</Label>
                <div className="space-y-4">
                  <div>
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={editedPreferences?.quietHoursStart}
                      onChange={(e) => setEditedPreferences(prev => prev ? {...prev, quietHoursStart: e.target.value} : null)}
                    />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={editedPreferences?.quietHoursEnd}
                      onChange={(e) => setEditedPreferences(prev => prev ? {...prev, quietHoursEnd: e.target.value} : null)}
                    />
                  </div>
                  <div>
                    <Label>Sleep Schedule</Label>
                    <RadioGroup
                      value={editedPreferences?.sleepSchedule}
                      onValueChange={(value) => setEditedPreferences(prev => prev ? {...prev, sleepSchedule: value} : null)}
                    >
                      {["Early bird", "Night owl", "Flexible"].map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <RadioGroupItem value={option} id={option} />
                          <Label htmlFor={option}>{option}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="text-lg font-semibold text-primary mb-4 block">Cleanliness & Chores</Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm">Tidiness Level: {editedPreferences?.cleanlinessLevel}/5</div>
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[editedPreferences?.cleanlinessLevel || 3]}
                      onValueChange={(value) => setEditedPreferences(prev => prev ? {...prev, cleanlinessLevel: value[0]} : null)}
                    />
                  </div>
                  <div>
                    <Label>Chores Preference</Label>
                    <RadioGroup
                      value={editedPreferences?.choresPreference}
                      onValueChange={(value) => setEditedPreferences(prev => prev ? {...prev, choresPreference: value} : null)}
                    >
                      {["Okay to rotate chores", "Prefer separate chores", "Prefer to hire a cleaner"].map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <RadioGroupItem value={option} id={option} />
                          <Label htmlFor={option}>{option}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="text-lg font-semibold text-primary mb-4 block">Guests Policy</Label>
                <div className="space-y-4">
                  <RadioGroup
                    value={editedPreferences?.guestsFrequency}
                    onValueChange={(value) => setEditedPreferences(prev => prev ? {...prev, guestsFrequency: value} : null)}
                  >
                    {["Rarely (once a month or less)", "Occasionally (1–2 times per month)", "Regularly (once a week)", "Often (2+ times per week)"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={option} />
                        <Label htmlFor={option}>{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="text-lg font-semibold text-primary mb-4 block">Social Vibe</Label>
                <div className="space-y-4">
                  <RadioGroup
                    value={editedPreferences?.socialVibe}
                    onValueChange={(value) => setEditedPreferences(prev => prev ? {...prev, socialVibe: value} : null)}
                  >
                    {["Quiet – mostly keep to myself", "Balanced – sometimes socialize, sometimes recharge", "Lively – I enjoy a busy, social household"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={option} />
                        <Label htmlFor={option}>{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="text-lg font-semibold text-primary mb-4 block">Work From Home</Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm">{editedPreferences?.workFromHomeDays} days/week</div>
                    <Slider
                      min={0}
                      max={7}
                      step={1}
                      value={[editedPreferences?.workFromHomeDays || 0]}
                      onValueChange={(value) => setEditedPreferences(prev => prev ? {...prev, workFromHomeDays: value[0]} : null)}
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="text-lg font-semibold text-primary mb-4 block">Pets</Label>
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Has Pets</Label>
                    <div className="space-y-2">
                      {["Dog", "Cat", "Other", "None"].map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            checked={editedPreferences?.hasPets.includes(option)}
                            onCheckedChange={(checked) => {
                              setEditedPreferences(prev => {
                                if (!prev) return null;
                                const updated = checked
                                  ? [...prev.hasPets, option]
                                  : prev.hasPets.filter(p => p !== option);
                                return {...prev, hasPets: updated};
                              });
                            }}
                          />
                          <Label>{option}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={editedPreferences?.comfortableWithPets}
                      onCheckedChange={(checked) => setEditedPreferences(prev => prev ? {...prev, comfortableWithPets: checked as boolean} : null)}
                    />
                    <Label>Comfortable with pets</Label>
                  </div>
                  <div>
                    <Label className="mb-2 block">Pet Allergies</Label>
                    <div className="space-y-2">
                      {["None", "Cats", "Dogs", "Other"].map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            checked={editedPreferences?.petAllergies.includes(option)}
                            onCheckedChange={(checked) => {
                              setEditedPreferences(prev => {
                                if (!prev) return null;
                                const updated = checked
                                  ? [...prev.petAllergies, option]
                                  : prev.petAllergies.filter(a => a !== option);
                                return {...prev, petAllergies: updated};
                              });
                            }}
                          />
                          <Label>{option}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <Label className="text-lg font-semibold text-primary mb-4 block">Lifestyle Policies</Label>
                <div className="space-y-4">
                  <Label className="mb-2 block">Smoking/Alcohol Policy</Label>
                  <div className="space-y-2">
                    {["No smoking, vaping, or alcohol", "Smoking outside only", "Social drinking okay", "No restrictions"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          checked={editedPreferences?.smokingPolicy.includes(option)}
                          onCheckedChange={(checked) => {
                            setEditedPreferences(prev => {
                              if (!prev) return null;
                              const updated = checked
                                ? [...prev.smokingPolicy, option]
                                : prev.smokingPolicy.filter(s => s !== option);
                              return {...prev, smokingPolicy: updated};
                            });
                          }}
                        />
                        <Label>{option}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </>
          ) : (
            sections.map((section) => {
              const Icon = section.icon;
              return (
                <Card key={section.title} className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={`${section.bgColor} p-3 rounded-lg`}>
                      <Icon className={`h-6 w-6 ${section.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-primary mb-3">{section.title}</h3>
                      <div className="space-y-2">
                        {section.items.map((item) => (
                          <div key={item.label}>
                            <p className="text-sm text-muted-dark font-medium">{item.label}</p>
                            <p className="text-foreground">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-4 justify-center">
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Home
          </Button>
          <Button onClick={() => navigate("/properties")} className="gap-2">
            Browse Properties
          </Button>
        </div>
      </div>
    </div>
  );
}
