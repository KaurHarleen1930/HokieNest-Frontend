import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { preferencesAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface RoommatePreferences {
  age: number;
  gender: string;
  major: string;
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

const defaultPreferences: RoommatePreferences = {
  age: 18,
  gender: "",
  major: "",
  budgetRange: [700, 1200],
  moveInDate: "",
  leaseLength: [],
  maxDistance: "",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  sleepSchedule: "",
  cleanlinessLevel: 3,
  choresPreference: "",
  guestsFrequency: "",
  socialVibe: "",
  workFromHomeDays: 3,
  hasPets: [],
  comfortableWithPets: false,
  petAllergies: [],
  smokingPolicy: [],
};

export default function RoommateQuestionnaire() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, token } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<RoommatePreferences>(
    () => {
      const saved = localStorage.getItem("roommatePreferences");
      return saved ? JSON.parse(saved) : defaultPreferences;
    }
  );

  const totalSteps = 10;
  const progress = (currentStep / totalSteps) * 100;

  // Check if user already has a profile in the database
  useEffect(() => {
    const checkExistingProfile = async () => {
      // Check if this is a restart request
      const urlParams = new URLSearchParams(window.location.search);
      const isRestart = urlParams.get('restart') === 'true';
      
      if (!isAuthenticated || !token) {
        setLoading(false);
        return;
      }

      // Skip profile check if restart is requested
      if (isRestart) {
        setLoading(false);
        // Clear the restart parameter from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      try {
        const data = await preferencesAPI.getPreferences();
        
        // If user has both housing and lifestyle preferences, redirect to profile page
        if (data.housing && data.lifestyle) {
          toast({
            title: "Profile Found",
            description: "You already have a roommate profile. Redirecting to your profile page.",
          });
          
          // Small delay to show the toast message
          setTimeout(() => {
            navigate("/roommate-profile");
          }, 1500);
          return;
        }
      } catch (error) {
        console.error("Failed to check existing profile:", error);
        // Continue with questionnaire if check fails
      } finally {
        setLoading(false);
      }
    };

    checkExistingProfile();
  }, [isAuthenticated, token, navigate, toast]);

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleComplete = async () => {
    try {
      if (!isAuthenticated || !token) {
        toast({
          title: "Error",
          description: "Please log in first.",
          variant: "destructive",
        });
        return;
      }

      // Update profile info (age, gender, major)
      const profileRes = await fetch("/api/v1/roommate/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          age: preferences.age,
          gender: preferences.gender,
          major: preferences.major,
        }),
      });
      if (!profileRes.ok) {
        const err = await profileRes.json();
        throw new Error(err.message || "Failed to update profile info");
      }

      await preferencesAPI.saveHousing(preferences);
      await preferencesAPI.saveLifestyle(preferences);

      localStorage.setItem("roommatePreferences", JSON.stringify(preferences));
      toast({
        title: "Profile Complete!",
        description: "Your roommate preferences have been saved to your account.",
      });

      navigate("/roommate-profile");
    } catch (error: any) {
      console.error("Failed to save preferences:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences.",
        variant: "destructive",
      });
    }
  };


  const updatePreference = (key: keyof RoommatePreferences, value: any) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArrayValue = (key: keyof RoommatePreferences, value: string) => {
    const currentArray = preferences[key] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter((v) => v !== value)
      : [...currentArray, value];
    updatePreference(key, newArray);
  };

  // Show loading screen while checking for existing profile
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-primary mb-2">Checking Profile</h2>
          <p className="text-muted">
            Checking if you already have a roommate profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-muted">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-card border border-border rounded-lg shadow-md p-8 mb-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  � Tell us about yourself
                </h2>
                <p className="text-muted">This info helps us match you with compatible roommates.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="age">Age</Label>
                  <input
                    id="age"
                    type="number"
                    min={16}
                    max={99}
                    value={preferences.age}
                    onChange={(e) => updatePreference("age", Number(e.target.value))}
                    className="w-full px-4 py-2 border border-border rounded-md bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    value={preferences.gender}
                    onChange={(e) => updatePreference("gender", e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-md bg-background"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="major">Major</Label>
                  <input
                    id="major"
                    type="text"
                    value={preferences.major}
                    onChange={(e) => updatePreference("major", e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-md bg-background"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Move-In & Lease */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  📅 When can you move in?
                </h2>
                <input
                  type="month"
                  value={preferences.moveInDate}
                  onChange={(e) => updatePreference("moveInDate", e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-md bg-background"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  📆 How long do you plan to stay?
                </h2>
                <div className="space-y-3">
                  {["One semester", "Full academic year", "12 months or more"].map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.leaseLength.includes(option)}
                        onCheckedChange={() => toggleArrayValue("leaseLength", option)}
                      />
                      <Label className="cursor-pointer">{option}</Label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted mt-4">
                  We'll prioritize matches with overlapping move-in dates and lease terms.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  📍 What's the farthest you're comfortable living from the VT campus?
                </h2>
              </div>
              <RadioGroup value={preferences.maxDistance} onValueChange={(v) => updatePreference("maxDistance", v)}>
                <div className="space-y-3">
                  {["Within 5 minutes", "Within 10 minutes", "Within 15 minutes", "Up to 30 minutes"].map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={option} />
                      <Label htmlFor={option} className="cursor-pointer">{option}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
              <p className="text-sm text-muted">
                Your commute radius helps us pair you with roommates who prefer the same area.
              </p>
            </div>
          )}

          {/* Step 4: Quiet Hours */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🌙 When do you prefer quiet at home?
                </h2>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label>Start Time</Label>
                    <input
                      type="time"
                      value={preferences.quietHoursStart}
                      onChange={(e) => updatePreference("quietHoursStart", e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-md bg-background mt-2"
                    />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <input
                      type="time"
                      value={preferences.quietHoursEnd}
                      onChange={(e) => updatePreference("quietHoursEnd", e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-md bg-background mt-2"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  😴 Which best describes you?
                </h2>
                <RadioGroup value={preferences.sleepSchedule} onValueChange={(v) => updatePreference("sleepSchedule", v)}>
                  <div className="space-y-3">
                    {["Early bird", "Night owl", "Flexible"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={option} />
                        <Label htmlFor={option} className="cursor-pointer">{option}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
              <p className="text-sm text-muted">
                We'll match people whose quiet hours overlap most.
              </p>
            </div>
          )}

          {/* Step 5: Cleanliness */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🧽 How tidy are you?
                </h2>
                <div className="space-y-4 mt-4">
                  <Slider
                    value={[preferences.cleanlinessLevel]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={(vals) => updatePreference("cleanlinessLevel", vals[0])}
                  />
                  <div className="flex justify-between text-sm text-muted">
                    <span>Very Relaxed</span>
                    <span className="text-lg font-semibold text-primary">{preferences.cleanlinessLevel}</span>
                    <span>Very Tidy</span>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🧹 How do you feel about weekly chores?
                </h2>
                <RadioGroup value={preferences.choresPreference} onValueChange={(v) => updatePreference("choresPreference", v)}>
                  <div className="space-y-3">
                    {["Okay to rotate chores", "Prefer separate chores", "Prefer to hire a cleaner"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={option} />
                        <Label htmlFor={option} className="cursor-pointer">{option}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
              <p className="text-sm text-muted">
                Matching tidy levels helps prevent small conflicts later.
              </p>
            </div>
          )}

          {/* Step 6: Guests */}
          {currentStep === 6 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🧑‍🤝‍🧑 How often is it okay to have guests or friends over?
                </h2>
                <RadioGroup value={preferences.guestsFrequency} onValueChange={(v) => updatePreference("guestsFrequency", v)}>
                  <div className="space-y-3">
                    {[
                      "Rarely (once a month or less)",
                      "Occasionally (1–2 times per month)",
                      "Regularly (once a week)",
                      "Often (2+ times per week)",
                    ].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={option} />
                        <Label htmlFor={option} className="cursor-pointer">{option}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 7: Social Vibe */}
          {currentStep === 7 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🎉 What kind of social vibe do you prefer at home?
                </h2>
                <RadioGroup value={preferences.socialVibe} onValueChange={(v) => updatePreference("socialVibe", v)}>
                  <div className="space-y-3">
                    {[
                      "Quiet – mostly keep to myself",
                      "Balanced – sometimes socialize, sometimes recharge",
                      "Lively – I enjoy a busy, social household",
                    ].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={option} />
                        <Label htmlFor={option} className="cursor-pointer">{option}</Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 8: Work From Home */}
          {currentStep === 8 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  💻 How many days per week do you usually work or study from home?
                </h2>
                <div className="space-y-4 mt-4">
                  <Slider
                    value={[preferences.workFromHomeDays]}
                    min={0}
                    max={7}
                    step={1}
                    onValueChange={(vals) => updatePreference("workFromHomeDays", vals[0])}
                  />
                  <div className="text-center">
                    <span className="text-3xl font-bold text-primary">{preferences.workFromHomeDays}</span>
                    <span className="text-muted ml-2">days/week</span>
                  </div>
                </div>
                <p className="text-sm text-muted mt-4">
                  Matching similar routines avoids noise or space conflicts.
                </p>
              </div>
            </div>
          )}

          {/* Step 9: Pets */}
          {currentStep === 9 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🐾 Do you have any pets?
                </h2>
                <div className="space-y-3">
                  {["Yes — Dog", "Yes — Cat", "Yes — Other", "No"].map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.hasPets.includes(option)}
                        onCheckedChange={() => toggleArrayValue("hasPets", option)}
                      />
                      <Label className="cursor-pointer">{option}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🐾 Are you comfortable living with pets?
                </h2>
                <RadioGroup
                  value={preferences.comfortableWithPets ? "yes" : "no"}
                  onValueChange={(v) => updatePreference("comfortableWithPets", v === "yes")}
                >
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="pets-yes" />
                      <Label htmlFor="pets-yes" className="cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="pets-no" />
                      <Label htmlFor="pets-no" className="cursor-pointer">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🐾 Do you have any pet allergies?
                </h2>
                <div className="space-y-3">
                  {["None", "Cats", "Dogs", "Other"].map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.petAllergies.includes(option)}
                        onCheckedChange={() => toggleArrayValue("petAllergies", option)}
                      />
                      <Label className="cursor-pointer">{option}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 10: Smoking/Alcohol */}
          {currentStep === 10 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🚭 What's acceptable at home?
                </h2>
                <div className="space-y-3">
                  {[
                    "No smoking, vaping, or alcohol",
                    "Smoking outside only",
                    "Social drinking okay",
                    "No restrictions",
                  ].map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.smokingPolicy.includes(option)}
                        onCheckedChange={() => toggleArrayValue("smokingPolicy", option)}
                      />
                      <Label className="cursor-pointer">{option}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          {currentStep < totalSteps ? (
            <Button onClick={handleNext} className="gap-2">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleComplete} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Complete Profile
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
