import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ConnectionRequestModal } from "@/components/ConnectionRequestModal";
import { Heart, Star, Users, DollarSign, Clock, Home, Target, Settings, Zap, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface QuestionWeight {
    questionId: string;
    weight: number; // 1-5 scale
    label: string;
    description: string;
}

interface RoommateProfile {
    id: string;
    name: string;
    email: string;
    age: number;
    gender: string;
    major: string;
    compatibilityScore: number;
    weightedScore: number;
    preferences: {
        budgetRange: [number, number];
        sleepSchedule: string;
        socialVibe: string;
        cleanlinessLevel: number;
    };
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

const defaultWeights: QuestionWeight[] = [
    { questionId: "budget", weight: 3, label: "Budget Compatibility", description: "How important is budget alignment?" },
    { questionId: "sleepSchedule", weight: 4, label: "Sleep Schedule", description: "How important is compatible sleep schedule?" },
    { questionId: "cleanliness", weight: 4, label: "Cleanliness Level", description: "How important is similar cleanliness standards?" },
    { questionId: "socialVibe", weight: 3, label: "Social Preferences", description: "How important is compatible social vibe?" },
    { questionId: "pets", weight: 2, label: "Pet Compatibility", description: "How important is pet preference alignment?" },
    { questionId: "workFromHome", weight: 2, label: "Work From Home", description: "How important is WFH schedule compatibility?" },
    { questionId: "guests", weight: 2, label: "Guest Frequency", description: "How important is guest preference alignment?" },
    { questionId: "smoking", weight: 3, label: "Smoking/Alcohol Policy", description: "How important is smoking/alcohol policy alignment?" },
];

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

export default function EnhancedRoommateMatching() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [roommates, setRoommates] = useState<RoommateProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [questionWeights, setQuestionWeights] = useState<QuestionWeight[]>(defaultWeights);
    const [showWeightSettings, setShowWeightSettings] = useState(false);
    const [weightsChanged, setWeightsChanged] = useState(false);
    const [selectedRoommate, setSelectedRoommate] = useState<RoommateProfile | null>(null);
    const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

    // Load saved weights from localStorage
    useEffect(() => {
        const savedWeights = localStorage.getItem('roommateQuestionWeights');
        if (savedWeights) {
            setQuestionWeights(JSON.parse(savedWeights));
        }
    }, []);

    // Save weights to localStorage
    const saveWeights = (weights: QuestionWeight[]) => {
        localStorage.setItem('roommateQuestionWeights', JSON.stringify(weights));
        setQuestionWeights(weights);
        setWeightsChanged(true);
    };

    // Update individual weight
    const updateWeight = (questionId: string, weight: number) => {
        const updatedWeights = questionWeights.map(w =>
            w.questionId === questionId ? { ...w, weight } : w
        );
        saveWeights(updatedWeights);
    };

    // Calculate weighted scores for roommates
    const calculateWeightedScores = (roommates: any[]) => {
        return roommates.map(roommate => {
            // Mock calculation - in real implementation, this would use actual compatibility data
            const baseScore = roommate.compatibilityScore;
            const weightedScore = Math.min(100, baseScore + Math.random() * 10 - 5); // Add some variation

            // Mock score breakdown
            const scoreBreakdown = {
                budget: Math.round(Math.random() * 20 + 10),
                sleepSchedule: Math.round(Math.random() * 20 + 10),
                cleanliness: Math.round(Math.random() * 20 + 10),
                socialVibe: Math.round(Math.random() * 20 + 10),
                pets: Math.round(Math.random() * 15 + 5),
                workFromHome: Math.round(Math.random() * 15 + 5),
                guests: Math.round(Math.random() * 15 + 5),
                smoking: Math.round(Math.random() * 15 + 5),
            };

            return {
                ...roommate,
                weightedScore: Math.round(weightedScore),
                scoreBreakdown
            };
        });
    };

    useEffect(() => {
        console.log("EnhancedRoommateMatching: useEffect running, isAuthenticated:", isAuthenticated);

        if (!isAuthenticated) {
            setLoading(false);
            return;
        }

        // Simulate loading with mock data
        setTimeout(() => {
            const mockRoommates = [
                {
                    id: "1",
                    name: "Alex Chen",
                    email: "alex.chen@vt.edu",
                    age: 22,
                    gender: "Male",
                    major: "Computer Science",
                    compatibilityScore: 92,
                    preferences: {
                        budgetRange: [800, 1200] as [number, number],
                        sleepSchedule: "Early bird",
                        socialVibe: "Balanced",
                        cleanlinessLevel: 4,
                    },
                },
                {
                    id: "2",
                    name: "Sarah Johnson",
                    email: "sarah.j@vt.edu",
                    age: 21,
                    gender: "Female",
                    major: "Engineering",
                    compatibilityScore: 87,
                    preferences: {
                        budgetRange: [700, 1100] as [number, number],
                        sleepSchedule: "Flexible",
                        socialVibe: "Quiet",
                        cleanlinessLevel: 3,
                    },
                },
                {
                    id: "3",
                    name: "Mike Rodriguez",
                    email: "mike.r@vt.edu",
                    age: 23,
                    gender: "Male",
                    major: "Business",
                    compatibilityScore: 78,
                    preferences: {
                        budgetRange: [900, 1300] as [number, number],
                        sleepSchedule: "Night owl",
                        socialVibe: "Lively",
                        cleanlinessLevel: 2,
                    },
                },
                {
                    id: "4",
                    name: "Emma Wilson",
                    email: "emma.w@vt.edu",
                    age: 20,
                    gender: "Female",
                    major: "Architecture",
                    compatibilityScore: 85,
                    preferences: {
                        budgetRange: [750, 1050] as [number, number],
                        sleepSchedule: "Early bird",
                        socialVibe: "Quiet",
                        cleanlinessLevel: 5,
                    },
                }
            ];

            const roommatesWithWeights = calculateWeightedScores(mockRoommates);

            // Sort by weighted score
            roommatesWithWeights.sort((a, b) => b.weightedScore - a.weightedScore);

            console.log("EnhancedRoommateMatching: Setting roommates with weighted scores", roommatesWithWeights);
            setRoommates(roommatesWithWeights);
            setLoading(false);
        }, 1000);
    }, [isAuthenticated, weightsChanged]);

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

    console.log("EnhancedRoommateMatching: Render", { loading, roommatesCount: roommates.length, isAuthenticated });

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
                    <h1 className="text-3xl font-bold text-foreground mb-2">Find Roommates</h1>
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
                        <h1 className="text-3xl font-bold text-foreground mb-2">Find Roommates</h1>
                        <p className="text-muted">
                            {roommates.length} potential roommate{roommates.length !== 1 ? 's' : ''} found
                            <span className="ml-2 text-sm">• Ranked by your weighted preferences</span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowWeightSettings(!showWeightSettings)}
                            className="gap-2"
                        >
                            <Settings className="h-4 w-4" />
                            {showWeightSettings ? 'Hide' : 'Adjust'} Weights
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

                {/* Weight Settings Panel */}
                {showWeightSettings && (
                    <Card className="mb-6 bg-surface border-surface-3">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Zap className="h-5 w-5 text-yellow-600" />
                                Adjust Question Weights
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Set how important each factor is for finding your ideal roommate (1 = not important, 5 = critical)
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                {questionWeights.map((weight) => (
                                    <div key={weight.questionId} className="space-y-3 p-4 border rounded-lg">
                                        <div>
                                            <h4 className="font-medium">{weight.label}</h4>
                                            <p className="text-sm text-muted-foreground">{weight.description}</p>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">Importance Level</span>
                                                <Badge className={weightColors[weight.weight as keyof typeof weightColors]}>
                                                    {weight.weight} - {weightLabels[weight.weight as keyof typeof weightLabels]}
                                                </Badge>
                                            </div>
                                            <Slider
                                                value={[weight.weight]}
                                                onValueChange={(value) => updateWeight(weight.questionId, value[0])}
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
                                ))}
                            </div>

                            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-medium mb-1">How this works:</p>
                                        <p className="text-muted-foreground">
                                            These weights determine how much each factor influences your roommate matches.
                                            Higher weights mean that factor is more important in finding your perfect match.
                                            Changes will automatically update your roommate rankings.
                                        </p>
                                    </div>
                                </div>
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
                                    <Badge className={`${getCompatibilityColor(roommate.weightedScore)} border-0 mb-1`}>
                                        <Star className="h-3 w-3 mr-1" />
                                        {roommate.weightedScore}%
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
                                    <span className={`text-sm font-semibold ${getCompatibilityColor(roommate.weightedScore).split(' ')[0]}`}>
                                        {getCompatibilityLabel(roommate.weightedScore)}
                                    </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${roommate.weightedScore}%` }}
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
                                            <Clock className="h-3 w-3 text-blue-600" />
                                            Sleep
                                        </span>
                                        <span className="font-medium">{roommate.scoreBreakdown.sleepSchedule} pts</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <Home className="h-3 w-3 text-purple-600" />
                                            Clean
                                        </span>
                                        <span className="font-medium">{roommate.scoreBreakdown.cleanliness} pts</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3 w-3 text-orange-600" />
                                            Social
                                        </span>
                                        <span className="font-medium">{roommate.scoreBreakdown.socialVibe} pts</span>
                                    </div>
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
                                <div className="flex items-center gap-2 text-sm">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    <span>${roommate.preferences.budgetRange[0]}-${roommate.preferences.budgetRange[1]}/mo</span>
                                </div>
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
                                <Button variant="outline" className="flex-1">
                                    View Profile
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
                        compatibilityScore: selectedRoommate.weightedScore || selectedRoommate.compatibilityScore,
                    }}
                />
            )}
        </div>
    );
}

