import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Heart, Star, Users, DollarSign, Clock, Home, Target, MapPin, Shield, TrendingUp, Info, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface QuestionWeight {
  questionId: string;
  weight: number;
}

interface WeightedMatch {
  user: {
    user_id: number;
    email: string;
    first_name: string;
    last_name: string;
    gender?: string;
    age?: number;
    major?: string;
  };
  housing: any;
  lifestyle: any;
  questionWeights: QuestionWeight[];
  compatibilityScore: number;
  weightedScore: number;
  scoreBreakdown: {
    budget: number;
    sleepSchedule: number;
    cleanliness: number;
    socialVibe: number;
    pets: number;
    workFromHome: number;
    guests: number;
    smoking: number;
  };
}

export default function WeightedMatching() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [matches, setMatches] = useState<WeightedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [userWeights, setUserWeights] = useState<QuestionWeight[]>([]);
  const [showWeightBreakdown, setShowWeightBreakdown] = useState(false);

  // Fetch weighted roommate matches from API
  const fetchWeightedMatches = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;
      const response = await fetch(`${API_BASE_URL}/roommate-matching/weighted-matches`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched weighted roommate matches:', data);
        return data;
      } else if (response.status === 400) {
        const error = await response.json();
        throw new Error(error.message || 'Please complete your weighted questionnaire first');
      } else {
        throw new Error('Failed to fetch weighted roommate matches');
      }
    } catch (error) {
      console.error('Failed to fetch weighted roommate matches:', error);
      throw error;
    }
  };

  useEffect(() => {
    console.log("WeightedMatching: useEffect running, isAuthenticated:", isAuthenticated);
    
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Fetch weighted roommate matches from API
        const data = await fetchWeightedMatches();
        
        setMatches(data.matches || []);
        setUserWeights(data.userWeights || []);
        setLoading(false);
      } catch (error: any) {
        console.error("Failed to load weighted roommate matches:", error);
        toast.error(error.message || "Failed to load weighted roommate matches");
        setLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50";
    if (score >= 80) return "text-blue-600 bg-blue-50";
    if (score >= 70) return "text-yellow-600 bg-yellow-50";
    return "text-orange-600 bg-orange-50";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent Match";
    if (score >= 80) return "Great Match";
    if (score >= 70) return "Good Match";
    return "Fair Match";
  };

  const getWeightLabel = (weight: number) => {
    const labels = {
      1: "Not Important",
      2: "Somewhat Important", 
      3: "Important",
      4: "Very Important",
      5: "Critical"
    };
    return labels[weight as keyof typeof labels] || "Unknown";
  };

  const getWeightColor = (weight: number) => {
    const colors = {
      1: "bg-gray-100 text-gray-600",
      2: "bg-blue-100 text-blue-600",
      3: "bg-green-100 text-green-600", 
      4: "bg-orange-100 text-orange-600",
      5: "bg-red-100 text-red-600"
    };
    return colors[weight as keyof typeof colors] || "bg-gray-100 text-gray-600";
  };

  console.log("WeightedMatching: Render", { loading, matchesCount: matches.length, isAuthenticated });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="Authentication Required"
          description="Please log in to find compatible roommates based on your weighted preferences"
          action={{
            label: "Log In",
            onClick: () => navigate('/login')
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Weighted Roommate Matching</h1>
          <p className="text-muted">Loading potential roommates based on your weighted preferences...</p>
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

  if (matches.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No Roommates Found"
          description="Complete your weighted roommate questionnaire to find compatible roommates based on your preferences"
          action={{
            label: "Complete Weighted Questionnaire",
            onClick: () => navigate('/weighted-questionnaire')
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Weighted Roommate Matching</h1>
            <p className="text-muted">
              {matches.length} potential roommate{matches.length !== 1 ? 's' : ''} found
              {userWeights.length > 0 && (
                <span className="ml-2 text-sm">
                  • Ranked by your weighted preferences
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowWeightBreakdown(!showWeightBreakdown)}
              className="gap-2"
            >
              <Info className="h-4 w-4" />
              {showWeightBreakdown ? 'Hide' : 'Show'} My Weights
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/weighted-questionnaire')}
              className="gap-2"
            >
              <Target className="h-4 w-4" />
              Update Weights
            </Button>
          </div>
        </div>

        {/* Weight Breakdown */}
        {showWeightBreakdown && userWeights.length > 0 && (
          <Card className="mb-6 bg-surface border-surface-3">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Your Question Weights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {userWeights.map((weight) => (
                  <div key={weight.questionId} className="text-center">
                    <div className="mb-2">
                      <Badge className={getWeightColor(weight.weight)}>
                        {weight.weight} - {getWeightLabel(weight.weight)}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium capitalize">
                      {weight.questionId.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Button
                  variant="link"
                  onClick={() => navigate('/weighted-questionnaire')}
                  className="text-sm"
                >
                  Update My Weights
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Roommate Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {matches.map((match) => (
          <Card key={match.user.user_id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{match.user.first_name} {match.user.last_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{match.user.major || 'Not specified'}</p>
                  <p className="text-xs text-muted-foreground">{match.user.age || 0} years old</p>
                </div>
                <div className="text-right">
                  <Badge className={`${getScoreColor(match.weightedScore)} border-0 mb-1`}>
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {match.weightedScore}%
                  </Badge>
                  <div className="text-xs text-muted-foreground">Weighted Match</div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Weighted Match Score */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Weighted Match</span>
                  <span className={`text-sm font-semibold ${getScoreColor(match.weightedScore).split(' ')[0]}`}>
                    {getScoreLabel(match.weightedScore)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${match.weightedScore}%` }}
                  />
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Score Breakdown</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-green-600" />
                      Budget
                    </span>
                    <span className="font-medium">{match.scoreBreakdown.budget} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-blue-600" />
                      Sleep
                    </span>
                    <span className="font-medium">{match.scoreBreakdown.sleepSchedule} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3 text-purple-600" />
                      Clean
                    </span>
                    <span className="font-medium">{match.scoreBreakdown.cleanliness} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <Home className="h-3 w-3 text-orange-600" />
                      Social
                    </span>
                    <span className="font-medium">{match.scoreBreakdown.socialVibe} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-pink-600" />
                      Pets
                    </span>
                    <span className="font-medium">{match.scoreBreakdown.pets} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-indigo-600" />
                      WFH
                    </span>
                    <span className="font-medium">{match.scoreBreakdown.workFromHome} pts</span>
                  </div>
                </div>
              </div>

              {/* Lifestyle Preferences */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Lifestyle</h4>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{match.lifestyle?.sleep_schedule || 'Not specified'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <span>{match.lifestyle?.noise_tolerance || 'Not specified'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>Cleanliness: {match.lifestyle?.cleanliness_level || 0}/5</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 gap-2">
                  <Heart className="h-4 w-4" />
                  Connect
                </Button>
                <Button variant="outline" className="flex-1">
                  View Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}






