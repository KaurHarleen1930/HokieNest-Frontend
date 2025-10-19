import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, CheckCircle2, Star, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { preferencesAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface QuestionWeight {
  questionId: string;
  weight: number; // 1-5 scale (1 = not important, 5 = very important)
}

interface WeightedRoommatePreferences {
  // Original preferences
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
  
  // Question weights
  questionWeights: QuestionWeight[];
}

const defaultPreferences: WeightedRoommatePreferences = {
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
  questionWeights: [
    { questionId: "budget", weight: 3 },
    { questionId: "sleepSchedule", weight: 4 },
    { questionId: "cleanliness", weight: 4 },
    { questionId: "socialVibe", weight: 3 },
    { questionId: "pets", weight: 2 },
    { questionId: "workFromHome", weight: 2 },
    { questionId: "guests", weight: 2 },
    { questionId: "smoking", weight: 3 },
  ]
};

const weightLabels = {
  1: "Not Important",
  2: "Somewhat Important", 
  3: "Important",
  4: "Very Important",
  5: "Critical"
};

const weightColors = {
  1: "bg-gray-100 text-gray-600",
  2: "bg-blue-100 text-blue-600",
  3: "bg-green-100 text-green-600", 
  4: "bg-orange-100 text-orange-600",
  5: "bg-red-100 text-red-600"
};

export default function WeightedQuestionnaire() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, token } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<WeightedRoommatePreferences>(
    () => {
      const saved = localStorage.getItem("weightedRoommatePreferences");
      return saved ? JSON.parse(saved) : defaultPreferences;
    }
  );

  const totalSteps = 11; // Added weight selection step
  const progress = (currentStep / totalSteps) * 100;

  // Check if user already has a profile
  useEffect(() => {
    const checkExistingProfile = async () => {
      if (!isAuthenticated || !token) {
        setLoading(false);
        return;
      }

      try {
        const data = await preferencesAPI.getPreferences();
        
        if (data.housing && data.lifestyle) {
          toast({
            title: "Profile Found",
            description: "You already have a roommate profile. Redirecting to your profile page.",
          });
          
          setTimeout(() => {
            navigate("/roommate-profile");
          }, 1500);
          return;
        }
      } catch (error) {
        console.log("No existing profile found, continuing with questionnaire");
      }
      
      setLoading(false);
    };

    checkExistingProfile();
  }, [isAuthenticated, token, navigate, toast]);

  const updatePreference = (key: keyof WeightedRoommatePreferences, value: any) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem("weightedRoommatePreferences", JSON.stringify(updated));
      return updated;
    });
  };

  const updateQuestionWeight = (questionId: string, weight: number) => {
    setPreferences(prev => {
      const updatedWeights = prev.questionWeights.map(w => 
        w.questionId === questionId ? { ...w, weight } : w
      );
      const updated = { ...prev, questionWeights: updatedWeights };
      localStorage.setItem("weightedRoommatePreferences", JSON.stringify(updated));
      return updated;
    });
  };

  const toggleArrayValue = (key: keyof WeightedRoommatePreferences, value: string) => {
    const currentArray = preferences[key] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updatePreference(key, newArray);
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);
      
      // Save housing preferences
      await preferencesAPI.saveHousingPreferences({
        budget_min: preferences.budgetRange[0],
        budget_max: preferences.budgetRange[1],
        move_in_date: preferences.moveInDate,
        lease_length: preferences.leaseLength,
        max_distance: preferences.maxDistance,
        quiet_hours_start: preferences.quietHoursStart,
        quiet_hours_end: preferences.quietHoursEnd,
      });

      // Save lifestyle preferences
      await preferencesAPI.saveLifestylePreferences({
        cleanliness_level: preferences.cleanlinessLevel,
        noise_tolerance: preferences.socialVibe,
        sleep_schedule: preferences.sleepSchedule,
        cooking_habits: preferences.choresPreference,
        diet: "flexible", // Default value
        pets: preferences.hasPets.join(", "),
        sharing_items: "negotiable", // Default value
        chores_preference: preferences.choresPreference,
        guests_frequency: preferences.guestsFrequency,
        work_from_home_days: preferences.workFromHomeDays,
        comfortable_with_pets: preferences.comfortableWithPets,
        pet_allergies: preferences.petAllergies,
        smoking_policy: preferences.smokingPolicy,
      });

      // Save question weights as housing priorities (reusing existing schema)
      const totalWeight = preferences.questionWeights.reduce((sum, w) => sum + w.weight, 0);
      await preferencesAPI.saveHousingPriorities({
        budget_priority: Math.round((preferences.questionWeights.find(w => w.questionId === "budget")?.weight || 3) * 100 / totalWeight),
        commute_priority: Math.round((preferences.questionWeights.find(w => w.questionId === "maxDistance")?.weight || 2) * 100 / totalWeight),
        safety_priority: Math.round((preferences.questionWeights.find(w => w.questionId === "cleanliness")?.weight || 4) * 100 / totalWeight),
        roommates_priority: Math.round((preferences.questionWeights.find(w => w.questionId === "socialVibe")?.weight || 3) * 100 / totalWeight),
      });

      toast({
        title: "Profile Complete!",
        description: "Your weighted roommate preferences have been saved successfully.",
      });

      localStorage.removeItem("weightedRoommatePreferences");
      navigate("/roommate-profile");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading questionnaire...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {currentStep} of {totalSteps}</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Content */}
        <div className="bg-card rounded-lg shadow-sm border p-8 min-h-[500px]">
          {/* Step 1: Budget */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  💰 What's your budget range?
                </h2>
                <p className="text-muted-foreground mb-4">
                  Set your monthly rent budget range
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Monthly Rent Range</Label>
                  <div className="mt-2 space-y-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Minimum: ${preferences.budgetRange[0]}</Label>
                      <Slider
                        value={[preferences.budgetRange[0]]}
                        onValueChange={(value) => updatePreference("budgetRange", [value[0], preferences.budgetRange[1]])}
                        min={400}
                        max={2000}
                        step={50}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Maximum: ${preferences.budgetRange[1]}</Label>
                      <Slider
                        value={[preferences.budgetRange[1]]}
                        onValueChange={(value) => updatePreference("budgetRange", [preferences.budgetRange[0], value[0]])}
                        min={preferences.budgetRange[0]}
                        max={2500}
                        step={50}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Move-In & Lease */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  📅 When do you want to move in?
                </h2>
                <p className="text-muted-foreground mb-4">
                  Select your preferred move-in date and lease length
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Move-in Date</Label>
                  <input
                    type="date"
                    value={preferences.moveInDate}
                    onChange={(e) => updatePreference("moveInDate", e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>

                <div>
                  <Label className="text-base font-medium">Lease Length</Label>
                  <div className="mt-2 space-y-2">
                    {["6 months", "12 months", "18 months", "24 months"].map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          checked={preferences.leaseLength.includes(option)}
                          onCheckedChange={() => toggleArrayValue("leaseLength", option)}
                        />
                        <Label className="cursor-pointer">{option}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  📍 How far from campus?
                </h2>
                <p className="text-muted-foreground mb-4">
                  What's the maximum distance you're willing to commute?
                </p>
              </div>

              <div className="space-y-4">
                <RadioGroup
                  value={preferences.maxDistance}
                  onValueChange={(value) => updatePreference("maxDistance", value)}
                >
                  {[
                    { value: "0.5", label: "0.5 miles (Walking distance)" },
                    { value: "1", label: "1 mile" },
                    { value: "2", label: "2 miles" },
                    { value: "5", label: "5 miles" },
                    { value: "10", label: "10+ miles" },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 4: Quiet Hours */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🤫 What are your quiet hours?
                </h2>
                <p className="text-muted-foreground mb-4">
                  When do you prefer quiet time for studying or sleeping?
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base font-medium">Quiet Hours Start</Label>
                    <input
                      type="time"
                      value={preferences.quietHoursStart}
                      onChange={(e) => updatePreference("quietHoursStart", e.target.value)}
                      className="mt-2 w-full px-3 py-2 border border-input rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-base font-medium">Quiet Hours End</Label>
                    <input
                      type="time"
                      value={preferences.quietHoursEnd}
                      onChange={(e) => updatePreference("quietHoursEnd", e.target.value)}
                      className="mt-2 w-full px-3 py-2 border border-input rounded-md bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Cleanliness */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🧹 How clean do you like to keep things?
                </h2>
                <p className="text-muted-foreground mb-4">
                  Rate your cleanliness preference from 1 (very messy) to 5 (very clean)
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">
                    Cleanliness Level: {preferences.cleanlinessLevel}/5
                  </Label>
                  <Slider
                    value={[preferences.cleanlinessLevel]}
                    onValueChange={(value) => updatePreference("cleanlinessLevel", value[0])}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Very Messy</span>
                    <span>Very Clean</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Guests */}
          {currentStep === 6 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  👥 How often do you have guests?
                </h2>
                <p className="text-muted-foreground mb-4">
                  How frequently do you typically have visitors?
                </p>
              </div>

              <div className="space-y-4">
                <RadioGroup
                  value={preferences.guestsFrequency}
                  onValueChange={(value) => updatePreference("guestsFrequency", value)}
                >
                  {[
                    "Never",
                    "Rarely (once a month)",
                    "Occasionally (once a week)",
                    "Frequently (multiple times a week)",
                    "Very frequently (almost daily)",
                  ].map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={option} />
                      <Label htmlFor={option} className="cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 7: Social Vibe */}
          {currentStep === 7 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🎉 What's your social vibe?
                </h2>
                <p className="text-muted-foreground mb-4">
                  How do you prefer to socialize at home?
                </p>
              </div>

              <div className="space-y-4">
                <RadioGroup
                  value={preferences.socialVibe}
                  onValueChange={(value) => updatePreference("socialVibe", value)}
                >
                  {[
                    "Quiet and studious",
                    "Balanced (study and social)",
                    "Social and lively",
                    "Party atmosphere",
                  ].map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={option} />
                      <Label htmlFor={option} className="cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 8: Work From Home */}
          {currentStep === 8 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  💻 How often do you work from home?
                </h2>
                <p className="text-muted-foreground mb-4">
                  How many days per week do you typically work from home?
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">
                    Days per week: {preferences.workFromHomeDays}
                  </Label>
                  <Slider
                    value={[preferences.workFromHomeDays]}
                    onValueChange={(value) => updatePreference("workFromHomeDays", value[0])}
                    min={0}
                    max={7}
                    step={1}
                    className="w-full mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Never</span>
                    <span>Every day</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 9: Pets */}
          {currentStep === 9 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🐕 What about pets?
                </h2>
                <p className="text-muted-foreground mb-4">
                  Do you have pets or are you comfortable living with them?
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Do you have pets?</Label>
                  <div className="mt-2 space-y-2">
                    {["Dog", "Cat", "Bird", "Fish", "Other", "No pets"].map((option) => (
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
                  <Label className="text-base font-medium">Are you comfortable with pets?</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={preferences.comfortableWithPets}
                        onCheckedChange={(checked) => updatePreference("comfortableWithPets", checked)}
                      />
                      <Label className="cursor-pointer">Yes, I'm comfortable with pets</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-base font-medium">Pet allergies?</Label>
                  <div className="mt-2 space-y-2">
                    {["Dogs", "Cats", "Birds", "None"].map((option) => (
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
            </div>
          )}

          {/* Step 10: Smoking/Alcohol */}
          {currentStep === 10 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  🚭 What's acceptable at home?
                </h2>
                <p className="text-muted-foreground mb-4">
                  What are your preferences regarding smoking and alcohol?
                </p>
              </div>

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
          )}

          {/* Step 11: Question Weights */}
          {currentStep === 11 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-primary mb-2">
                  ⭐ How important are these factors?
                </h2>
                <p className="text-muted-foreground mb-4">
                  Rate how important each factor is for finding your ideal roommate (1 = not important, 5 = critical)
                </p>
              </div>

              <div className="space-y-6">
                {[
                  { id: "budget", label: "Budget Compatibility", description: "How important is it that your roommate has a similar budget?" },
                  { id: "sleepSchedule", label: "Sleep Schedule", description: "How important is it to have compatible sleep schedules?" },
                  { id: "cleanliness", label: "Cleanliness Level", description: "How important is it to have similar cleanliness standards?" },
                  { id: "socialVibe", label: "Social Preferences", description: "How important is it to have compatible social vibes?" },
                  { id: "pets", label: "Pet Compatibility", description: "How important is it to have compatible pet preferences?" },
                  { id: "workFromHome", label: "Work From Home", description: "How important is it to have compatible work-from-home schedules?" },
                  { id: "guests", label: "Guest Frequency", description: "How important is it to have compatible guest preferences?" },
                  { id: "smoking", label: "Smoking/Alcohol Policy", description: "How important is it to have compatible smoking/alcohol policies?" },
                ].map((question) => {
                  const weight = preferences.questionWeights.find(w => w.questionId === question.id)?.weight || 3;
                  return (
                    <div key={question.id} className="space-y-3 p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{question.label}</h4>
                        <p className="text-sm text-muted-foreground">{question.description}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Importance Level</span>
                          <Badge className={weightColors[weight as keyof typeof weightColors]}>
                            {weight} - {weightLabels[weight as keyof typeof weightLabels]}
                          </Badge>
                        </div>
                        <Slider
                          value={[weight]}
                          onValueChange={(value) => updateQuestionWeight(question.id, value[0])}
                          min={1}
                          max={5}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Not Important</span>
                          <span>Critical</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">How this works:</p>
                    <p className="text-muted-foreground">
                      These weights will be used to rank potential roommates. Higher weights mean that factor is more important 
                      in finding your perfect match. The system will prioritize matches who align with your most important preferences.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
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

