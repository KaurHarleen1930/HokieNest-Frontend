import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Heart, Star, Users, DollarSign, Clock, Home, Target, MapPin, Shield, TrendingUp, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface HousingPriorities {
    budget: number;
    commute: number;
    safety: number;
    roommates: number;
}

interface RoommateProfile {
    id: string;
    name: string;
    email: string;
    age: number;
    gender: string;
    major: string;
    compatibilityScore: number;
    priorityScore: number;
    preferences: {
        budgetRange: [number, number];
        sleepSchedule: string;
        socialVibe: string;
        cleanlinessLevel: number;
    };
    housingData: {
        preferredBudget: number;
        commuteDistance: number;
        safetyRating: number;
        roommateCompatibility: number;
    };
    scoreBreakdown: {
        budget: number;
        commute: number;
        safety: number;
        roommates: number;
    };
}

export default function PriorityBasedMatching() {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [roommates, setRoommates] = useState<RoommateProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [userPriorities, setUserPriorities] = useState<HousingPriorities | null>(null);
    const [showPriorityBreakdown, setShowPriorityBreakdown] = useState(false);

    // Fetch real roommate matches from API
    const fetchRoommateMatches = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('http://localhost:4000/api/v1/roommate-matching/matches', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const matches = await response.json();
                console.log('Fetched real roommate matches:', matches);
                return matches;
            } else if (response.status === 400) {
                const error = await response.json();
                throw new Error(error.message || 'Please complete your questionnaire first');
            } else {
                throw new Error('Failed to fetch roommate matches');
            }
        } catch (error) {
            console.error('Failed to fetch roommate matches:', error);
            throw error;
        }
    };

    useEffect(() => {
        console.log("PriorityBasedMatching: useEffect running, isAuthenticated:", isAuthenticated);

        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        const loadData = async () => {
            try {
                setLoading(true);

                // Fetch real roommate matches from API
                const matches = await fetchRoommateMatches();

                // Transform API data to match our interface
                const transformedRoommates = matches.map((match: any) => ({
                    id: match.user.user_id.toString(),
                    name: `${match.user.first_name} ${match.user.last_name}`,
                    email: match.user.email,
                    age: match.user.age || 0,
                    gender: match.user.gender || 'Not specified',
                    major: match.user.major || 'Not specified',
                    compatibilityScore: match.compatibilityScore,
                    priorityScore: match.priorityScore,
                    preferences: {
                        budgetRange: match.housing ? [match.housing.budget_min, match.housing.budget_max] : [0, 0],
                        sleepSchedule: match.lifestyle?.sleep_schedule || 'Not specified',
                        socialVibe: match.lifestyle?.noise_tolerance || 'Not specified',
                        cleanlinessLevel: match.lifestyle?.cleanliness_level || 0,
                    },
                    housingData: {
                        preferredBudget: match.housing ? (match.housing.budget_min + match.housing.budget_max) / 2 : 0,
                        commuteDistance: match.housing?.max_distance ? parseFloat(match.housing.max_distance) : 0,
                        safetyRating: match.lifestyle?.cleanliness_level || 0,
                        roommateCompatibility: match.compatibilityScore / 10,
                    },
                    scoreBreakdown: match.scoreBreakdown
                }));

                // Extract user priorities from the first match (they should all be the same)
                if (matches.length > 0 && matches[0].priorities) {
                    setUserPriorities({
                        budget: matches[0].priorities.budget_priority,
                        commute: matches[0].priorities.commute_priority,
                        safety: matches[0].priorities.safety_priority,
                        roommates: matches[0].priorities.roommates_priority
                    });
                }

                console.log("PriorityBasedMatching: Setting real roommates", transformedRoommates);
                setRoommates(transformedRoommates);
                setLoading(false);
            } catch (error: any) {
                console.error("Failed to load roommate matches:", error);
                toast.error(error.message || "Failed to load roommate matches");
                setLoading(false);
            }
        };

        loadData();
    }, [isAuthenticated]);

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

    console.log("PriorityBasedMatching: Render", { loading, roommatesCount: roommates.length, isAuthenticated });

    if (!isAuthenticated) {
        return (
            <div className="container mx-auto px-4 py-8">
                <EmptyState
                    icon={<Users className="h-12 w-12" />}
                    title="Authentication Required"
                    description="Please log in to find compatible roommates based on your housing priorities"
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
                    <h1 className="text-3xl font-bold text-foreground mb-2">Priority-Based Roommate Matching</h1>
                    <p className="text-muted">Loading potential roommates based on your housing priorities...</p>
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
                    description="Complete your roommate questionnaire with housing priorities to find compatible roommates"
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
                        <h1 className="text-3xl font-bold text-foreground mb-2">Priority-Based Roommate Matching</h1>
                        <p className="text-muted">
                            {roommates.length} potential roommate{roommates.length !== 1 ? 's' : ''} found
                            {userPriorities && (
                                <span className="ml-2 text-sm">
                                    • Ranked by your housing priorities
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowPriorityBreakdown(!showPriorityBreakdown)}
                            className="gap-2"
                        >
                            <Info className="h-4 w-4" />
                            {showPriorityBreakdown ? 'Hide' : 'Show'} Priorities
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

                {/* Priority Breakdown */}
                {showPriorityBreakdown && userPriorities && (
                    <Card className="mb-6 bg-surface border-surface-3">
                        <CardHeader>
                            <CardTitle className="text-lg">Your Housing Priorities</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <DollarSign className="h-4 w-4 text-green-600" />
                                        <span className="font-medium">Budget</span>
                                    </div>
                                    <div className="text-2xl font-bold text-green-600">{userPriorities.budget}%</div>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <MapPin className="h-4 w-4 text-blue-600" />
                                        <span className="font-medium">Commute</span>
                                    </div>
                                    <div className="text-2xl font-bold text-blue-600">{userPriorities.commute}%</div>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <Shield className="h-4 w-4 text-purple-600" />
                                        <span className="font-medium">Safety</span>
                                    </div>
                                    <div className="text-2xl font-bold text-purple-600">{userPriorities.safety}%</div>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <Users className="h-4 w-4 text-orange-600" />
                                        <span className="font-medium">Roommates</span>
                                    </div>
                                    <div className="text-2xl font-bold text-orange-600">{userPriorities.roommates}%</div>
                                </div>
                            </div>
                            <div className="mt-4 text-center">
                                <Button
                                    variant="link"
                                    onClick={() => navigate('/housing-priorities-demo')}
                                    className="text-sm"
                                >
                                    Update My Priorities
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
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
                                <div className="text-right">
                                    <Badge className={`${getCompatibilityColor(roommate.priorityScore)} border-0 mb-1`}>
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        {roommate.priorityScore}%
                                    </Badge>
                                    <div className="text-xs text-muted-foreground">Priority Match</div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {/* Priority Match Score */}
                            <div className="p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">Priority Match</span>
                                    <span className={`text-sm font-semibold ${getCompatibilityColor(roommate.priorityScore).split(' ')[0]}`}>
                                        {getCompatibilityLabel(roommate.priorityScore)}
                                    </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${roommate.priorityScore}%` }}
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
                                        <span className="font-medium">{roommate.scoreBreakdown.budget} pts</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3 text-blue-600" />
                                            Commute
                                        </span>
                                        <span className="font-medium">{roommate.scoreBreakdown.commute} pts</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <Shield className="h-3 w-3 text-purple-600" />
                                            Safety
                                        </span>
                                        <span className="font-medium">{roommate.scoreBreakdown.safety} pts</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3 w-3 text-orange-600" />
                                            Roommates
                                        </span>
                                        <span className="font-medium">{roommate.scoreBreakdown.roommates} pts</span>
                                    </div>
                                </div>
                            </div>

                            {/* Housing Data */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium">Housing Preferences</h4>
                                <div className="flex items-center gap-2 text-sm">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    <span>Budget: ${roommate.housingData.preferredBudget}/mo</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span>Commute: {roommate.housingData.commuteDistance} mi</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                    <span>Safety: {roommate.housingData.safetyRating}/10</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span>Compatibility: {roommate.housingData.roommateCompatibility}/10</span>
                                </div>
                            </div>

                            {/* Lifestyle Preferences */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium">Lifestyle</h4>
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span>{roommate.preferences.sleepSchedule}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Home className="h-4 w-4 text-muted-foreground" />
                                    <span>{roommate.preferences.socialVibe}</span>
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
