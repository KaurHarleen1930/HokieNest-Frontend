import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConnectionRequestModal } from "@/components/ConnectionRequestModal";
import { Heart, Star, Users, DollarSign, Clock, Home, Target, AlertCircle, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { roommatesAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { HousingStatus, HousingStatusLabels } from "@/types/HousingStatus";

interface RoommateProfile {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: string;
  major: string;
  compatibilityScore: number;
  housing_status?: HousingStatus;
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
  const [selectedRoommate, setSelectedRoommate] = useState<RoommateProfile | null>(null);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

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
        const response = await roommatesAPI.findMatches(50);

        console.log("RoommateMatching: Received matches", response);

        // TEMP: Add random housing statuses for demo
         const statuses = Object.values(HousingStatus);
        const enrichedMatches = response.matches.map((r: any) => ({
          ...r,
          housing_status: statuses[Math.floor(Math.random() * statuses.length)],
     }));

setRoommates(enrichedMatches);
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

  const handleConnectClick = (roommate: RoommateProfile) => {
    setSelectedRoommate(roommate);
    setIsConnectionModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsConnectionModalOpen(false);
    setSelectedRoommate(null);
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
              {roommates.length > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  (showing all available matches)
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/priority-ranking')}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Set Priorities
            </Button>
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
      </div>

      {/* Roommate Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roommates.map((roommate) => (
          <Card key={roommate.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4 relative">
              {/* Housing Status & Match Score Container */}
              <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
               {roommate.housing_status && (
                <Badge
                    variant="secondary"
                    className="text-xs bg-primary/10 text-primary border-0"
                 >
                    {HousingStatusLabels[roommate.housing_status]}
                </Badge>
                )}
                 <Badge
                   className={`${getCompatibilityColor(roommate.compatibilityScore)} border-0 text-xs`}
                  >
                   <Star className="h-3 w-3 mr-1" />
                      {roommate.compatibilityScore}%
                  </Badge>
               </div>

              <div>
              <CardTitle className="text-lg">{roommate.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{roommate.major}</p>
              <p className="text-xs text-muted-foreground">{roommate.age} years old</p>
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
                <Button 
                  className="flex-1 gap-2"
                  onClick={() => handleConnectClick(roommate)}
                >
                  <Heart className="h-4 w-4" />
                  Connect
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Connection Request Modal */}
      {selectedRoommate && (
        <ConnectionRequestModal
          isOpen={isConnectionModalOpen}
          onClose={handleCloseModal}
          roommate={{
            id: selectedRoommate.id,
            name: selectedRoommate.name,
            email: selectedRoommate.email,
            compatibilityScore: selectedRoommate.compatibilityScore,
          }}
        />
      )}
    </div>
  );
}