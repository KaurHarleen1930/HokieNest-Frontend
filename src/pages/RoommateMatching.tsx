import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Heart, Star, Users, DollarSign, Clock, Home, Target, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { roommatesAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface RoommateProfile {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: string;
  major: string;
  compatibilityScore: number;
  preferences: {
    budgetRange: [number, number];
    sleepSchedule: string;
    socialVibe: string;
    cleanlinessLevel: number;
    moveInDate: string;
    leaseLength: string[];
    maxDistance: string;
    quietHoursStart: string;
    quietHoursEnd: string;
    choresPreference: string;
    guestsFrequency: string;
    workFromHomeDays: number;
    hasPets: string[];
    comfortableWithPets: boolean;
    petAllergies: string[];
    smokingPolicy: string[];
  };
}

export default function RoommateMatching() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [roommates, setRoommates] = useState<RoommateProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("RoommateMatching: useEffect running, isAuthenticated:", isAuthenticated);
    
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    const fetchRoommates = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("RoommateMatching: Fetching roommate matches...");
        const response = await roommatesAPI.findMatches(20);
        
        console.log("RoommateMatching: Received matches", response);
        setRoommates(response.matches);
        
        if (response.matches.length === 0) {
          toast({
            title: "No matches found",
            description: "Complete your roommate questionnaire to find compatible roommates.",
          });
        }
      } catch (error: any) {
        console.error("RoommateMatching: Error fetching matches", error);
        setError(error.message || "Failed to fetch roommate matches");
        
        toast({
          title: "Error",
          description: error.message || "Failed to fetch roommate matches. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRoommates();
  }, [isAuthenticated, toast]);

  const getCompatibilityColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50";
    if (score >= 80) return "text-blue-600 bg-blue-50";
    if (score >= 70) return "text-yellow-600 bg-yellow-50";
    return "text-orange-600 bg-orange-50";
  };

  const getCompatibilityLabel = (score: number) => {
    if (score >= 90) return "Excellent Match";
    if (score >= 80) return "Great Match";
    if (score >= 70) return "Good Match";
    return "Fair Match";
  };

  console.log("RoommateMatching: Render", { loading, roommatesCount: roommates.length, isAuthenticated, error });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="Authentication Required"
          description="Please log in to find compatible roommates"
          action={{
            label: "Log In",
            onClick: () => navigate('/login')
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          icon={<AlertCircle className="h-12 w-12" />}
          title="Error Loading Matches"
          description={error}
          action={{
            label: "Try Again",
            onClick: () => window.location.reload()
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Find Your Perfect Roommate</h1>
          <p className="text-muted">Loading potential roommates...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading roommates...</p>
          </div>
        </div>
      </div>
    );
  }

  if (roommates.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No Roommates Found"
          description="Complete your roommate questionnaire to find compatible roommates"
          action={{
            label: "Complete Questionnaire",
            onClick: () => navigate('/roommate-questionnaire')
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Find Your Perfect Roommate</h1>
            <p className="text-muted">
              {roommates.length} potential roommate{roommates.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/roommate-profile')}
            className="gap-2"
          >
            <Target className="h-4 w-4" />
            View My Profile
          </Button>
        </div>
      </div>

      {/* Roommate Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roommates.map((roommate) => (
          <Card key={roommate.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{roommate.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{roommate.major}</p>
                  <p className="text-xs text-muted-foreground">{roommate.age} years old</p>
                </div>
                <Badge className={`${getCompatibilityColor(roommate.compatibilityScore)} border-0`}>
                  <Star className="h-3 w-3 mr-1" />
                  {roommate.compatibilityScore}%
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Compatibility Info */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Compatibility</span>
                  <span className={`text-sm font-semibold ${getCompatibilityColor(roommate.compatibilityScore).split(' ')[0]}`}>
                    {getCompatibilityLabel(roommate.compatibilityScore)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${roommate.compatibilityScore}%` }}
                  />
                </div>
              </div>

              {/* Key Preferences */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>Budget: ${roommate.preferences.budgetRange[0]}-${roommate.preferences.budgetRange[1]}/mo</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{roommate.preferences.sleepSchedule}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <span>{roommate.preferences.socialVibe}</span>
                </div>
                {roommate.preferences.moveInDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Move-in: {new Date(roommate.preferences.moveInDate).toLocaleDateString()}</span>
                  </div>
                )}
                {roommate.preferences.workFromHomeDays > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span>WFH: {roommate.preferences.workFromHomeDays} days/week</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 gap-2">
                  <Heart className="h-4 w-4" />
                  Connect
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}