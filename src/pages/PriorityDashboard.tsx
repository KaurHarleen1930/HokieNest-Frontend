import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Target,
    DollarSign,
    MapPin,
    Shield,
    Users,
    BarChart3,
    TrendingUp,
    Settings,
    ArrowRight,
    Info,
    Star,
    CheckCircle,
    AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import HousingPrioritiesSelector, { HousingPriorities } from '@/components/HousingPrioritiesSelector';

interface PropertyRecommendation {
    id: string;
    name: string;
    price: number;
    distance: number;
    safetyScore: number;
    roommateCompatibility: number;
    score: number;
    breakdown: {
        budget: number;
        commute: number;
        safety: number;
        roommates: number;
    };
    description: string;
    amenities: string[];
}

const DEMO_PROPERTIES: Omit<PropertyRecommendation, 'score' | 'breakdown'>[] = [
    {
        id: '1',
        name: 'University Commons',
        price: 1200,
        distance: 0.8,
        safetyScore: 9.2,
        roommateCompatibility: 8.5,
        description: 'Modern apartment complex right next to campus',
        amenities: ['Pool', 'Gym', 'Study Rooms', 'Parking']
    },
    {
        id: '2',
        name: 'Downtown Lofts',
        price: 1800,
        distance: 2.5,
        safetyScore: 7.8,
        roommateCompatibility: 6.2,
        description: 'Luxury lofts in the heart of downtown',
        amenities: ['Rooftop Deck', 'Concierge', 'Pet Spa', 'Business Center']
    },
    {
        id: '3',
        name: 'Quiet Gardens',
        price: 950,
        distance: 1.2,
        safetyScore: 8.9,
        roommateCompatibility: 9.1,
        description: 'Peaceful community with great roommate matching',
        amenities: ['Garden', 'Library', 'Community Kitchen', 'Laundry']
    },
    {
        id: '4',
        name: 'Tech Hub Apartments',
        price: 1500,
        distance: 1.8,
        safetyScore: 8.5,
        roommateCompatibility: 7.8,
        description: 'Tech-focused community with high-speed internet',
        amenities: ['Fiber Internet', 'Co-working Space', 'Gaming Room', 'EV Charging']
    }
];

export default function PriorityDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [priorities, setPriorities] = useState<HousingPriorities>({
        budget: 40,
        commute: 30,
        safety: 20,
        roommates: 10
    });
    const [recommendations, setRecommendations] = useState<PropertyRecommendation[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchUserPriorities();
    }, []);

    useEffect(() => {
        if (isPrioritiesValid()) {
            calculateRecommendations();
        }
    }, [priorities]);

    const fetchUserPriorities = async () => {
        try {
            const token = localStorage.getItem('auth_token');            
            const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;

            const response = await fetch(`${API_BASE_URL}/preferences/housing-priorities`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.priorities) {
                    setPriorities(data.priorities);
                }
            }
        } catch (error) {
            console.error('Error fetching priorities:', error);
        }
    };

    const isPrioritiesValid = () => {
        return priorities.budget + priorities.commute + priorities.safety + priorities.roommates === 100;
    };

    const calculateRecommendations = () => {
        const scoredProperties = DEMO_PROPERTIES.map(property => {
            // Normalize scores (0-100 scale)
            const budgetScore = Math.max(0, 100 - ((property.price - 800) / 10));
            const commuteScore = Math.max(0, 100 - (property.distance * 20));
            const safetyScore = property.safetyScore * 10;
            const roommateScore = property.roommateCompatibility * 10;

            // Calculate weighted score
            const weightedScore =
                (budgetScore * priorities.budget / 100) +
                (commuteScore * priorities.commute / 100) +
                (safetyScore * priorities.safety / 100) +
                (roommateScore * priorities.roommates / 100);

            return {
                ...property,
                score: Math.round(weightedScore),
                breakdown: {
                    budget: Math.round(budgetScore * priorities.budget / 100),
                    commute: Math.round(commuteScore * priorities.commute / 100),
                    safety: Math.round(safetyScore * priorities.safety / 100),
                    roommates: Math.round(roommateScore * priorities.roommates / 100)
                }
            };
        });

        // Sort by score (highest first)
        scoredProperties.sort((a, b) => b.score - a.score);
        setRecommendations(scoredProperties);
    };

    const handleSavePriorities = async (newPriorities: HousingPriorities) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;

            const response = await fetch(`${API_BASE_URL}/preferences/housing-priorities`, {
            
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newPriorities)
            });

            if (response.ok) {
                setPriorities(newPriorities);
                toast.success('Housing priorities updated successfully!');
            } else {
                throw new Error('Failed to save priorities');
            }
        } catch (error) {
            toast.error('Failed to save priorities. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getScoreBadgeVariant = (score: number) => {
        if (score >= 80) return 'default';
        if (score >= 60) return 'secondary';
        return 'destructive';
    };

    const getOverallRating = (score: number) => {
        if (score >= 90) return { label: "Excellent", color: "text-green-600" };
        if (score >= 80) return { label: "Very Good", color: "text-green-500" };
        if (score >= 70) return { label: "Good", color: "text-yellow-600" };
        if (score >= 60) return { label: "Fair", color: "text-orange-600" };
        if (score >= 50) return { label: "Poor", color: "text-red-500" };
        return { label: "Very Poor", color: "text-red-600" };
    };

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-foreground">Housing Priority Dashboard</h1>
                    <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                        Manage your housing priorities and get personalized property recommendations
                    </p>
                    {user && (
                        <Badge variant="outline" className="text-sm">
                            Logged in as: {user.email}
                        </Badge>
                    )}
                </div>

                <Tabs defaultValue="priorities" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="priorities">My Priorities</TabsTrigger>
                        <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    {/* Priorities Tab */}
                    <TabsContent value="priorities" className="space-y-6">
                        <HousingPrioritiesSelector
                            initialPriorities={priorities}
                            onSave={handleSavePriorities}
                            className="max-w-4xl mx-auto"
                        />

                        {/* Priority Insights */}
                        <Card className="max-w-4xl mx-auto">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Info className="h-5 w-5" />
                                    Priority Insights
                                </CardTitle>
                                <CardDescription>
                                    Understanding how your priorities affect your housing search
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Your Top Priority</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {priorities.budget >= Math.max(priorities.commute, priorities.safety, priorities.roommates) 
                                                ? "Budget is your highest priority. You'll see more affordable options first."
                                                : priorities.commute >= Math.max(priorities.budget, priorities.safety, priorities.roommates)
                                                ? "Location is your highest priority. You'll see properties closer to campus first."
                                                : priorities.safety >= Math.max(priorities.budget, priorities.commute, priorities.roommates)
                                                ? "Safety is your highest priority. You'll see safer neighborhoods first."
                                                : "Roommate compatibility is your highest priority. You'll see better roommate matches first."
                                            }
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Balance Assessment</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {Math.max(priorities.budget, priorities.commute, priorities.safety, priorities.roommates) - 
                                             Math.min(priorities.budget, priorities.commute, priorities.safety, priorities.roommates) <= 10
                                                ? "Your priorities are well-balanced, giving you diverse options."
                                                : "You have strong preferences in certain areas, which will help narrow down your search."
                                            }
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Recommendations Tab */}
                    <TabsContent value="recommendations" className="space-y-6">
                        {!isPrioritiesValid() ? (
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    Please configure your priorities first to see personalized recommendations.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5" />
                                            Personalized Recommendations
                                        </CardTitle>
                                        <CardDescription>
                                            Properties ranked by your weighted preferences
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid gap-6 md:grid-cols-2">
                                            {recommendations.map((property, index) => {
                                                const overallRating = getOverallRating(property.score);
                                                return (
                                                    <Card key={property.id} className="bg-surface-2 border-surface-3">
                                                        <CardHeader className="pb-3">
                                                            <div className="flex items-start justify-between">
                                                                <div>
                                                                    <CardTitle className="text-lg">{property.name}</CardTitle>
                                                                    <CardDescription>{property.description}</CardDescription>
                                                                </div>
                                                                <div className="text-right">
                                                                    <Badge variant={getScoreBadgeVariant(property.score)} className="text-sm">
                                                                        #{index + 1}
                                                                    </Badge>
                                                                    <div className={`text-2xl font-bold ${getScoreColor(property.score)}`}>
                                                                        {property.score}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">Match Score</div>
                                                                    <div className={`text-xs ${overallRating.color}`}>
                                                                        {overallRating.label}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="space-y-4">
                                                            {/* Property Details */}
                                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <DollarSign className="h-4 w-4 text-green-600" />
                                                                    <span>${property.price}/mo</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <MapPin className="h-4 w-4 text-blue-600" />
                                                                    <span>{property.distance} mi</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Shield className="h-4 w-4 text-purple-600" />
                                                                    <span>{property.safetyScore}/10</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Users className="h-4 w-4 text-orange-600" />
                                                                    <span>{property.roommateCompatibility}/10</span>
                                                                </div>
                                                            </div>

                                                            {/* Score Breakdown */}
                                                            <div className="space-y-2">
                                                                <h4 className="text-sm font-medium">Score Breakdown</h4>
                                                                <div className="space-y-1">
                                                                    <div className="flex justify-between text-xs">
                                                                        <span>Budget: {property.breakdown.budget} pts</span>
                                                                        <span>({priorities.budget}% weight)</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span>Commute: {property.breakdown.commute} pts</span>
                                                                        <span>({priorities.commute}% weight)</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span>Safety: {property.breakdown.safety} pts</span>
                                                                        <span>({priorities.safety}% weight)</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span>Roommates: {property.breakdown.roommates} pts</span>
                                                                        <span>({priorities.roommates}% weight)</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Amenities */}
                                                            <div className="space-y-2">
                                                                <h4 className="text-sm font-medium">Amenities</h4>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {property.amenities.map((amenity, idx) => (
                                                                        <Badge key={idx} variant="secondary" className="text-xs">
                                                                            {amenity}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </TabsContent>

                    {/* Analytics Tab */}
                    <TabsContent value="analytics" className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5" />
                                        Priority Distribution
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {[
                                        { key: 'budget', label: 'Budget', value: priorities.budget, color: 'bg-green-500' },
                                        { key: 'commute', label: 'Commute', value: priorities.commute, color: 'bg-blue-500' },
                                        { key: 'safety', label: 'Safety', value: priorities.safety, color: 'bg-purple-500' },
                                        { key: 'roommates', label: 'Roommates', value: priorities.roommates, color: 'bg-orange-500' }
                                    ].map((item) => (
                                        <div key={item.key} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>{item.label}</span>
                                                <span>{item.value}%</span>
                                            </div>
                                            <Progress value={item.value} className="h-2" />
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Star className="h-5 w-5" />
                                        Recommendation Quality
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {recommendations.length > 0 && (
                                        <>
                                            <div className="text-center">
                                                <div className="text-3xl font-bold text-primary">
                                                    {Math.round(recommendations.reduce((sum, p) => sum + p.score, 0) / recommendations.length)}
                                                </div>
                                                <div className="text-sm text-muted-foreground">Average Match Score</div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Top Match</span>
                                                    <span className="font-medium">{recommendations[0]?.score || 0}%</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span>Lowest Match</span>
                                                    <span className="font-medium">{recommendations[recommendations.length - 1]?.score || 0}%</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" />
                                    Optimization Tips
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <h4 className="font-medium">For Better Matches</h4>
                                        <ul className="text-sm text-muted-foreground space-y-1">
                                            <li>• Consider adjusting priorities based on your current needs</li>
                                            <li>• Higher budget priority may limit location options</li>
                                            <li>• Safety and roommate compatibility often correlate</li>
                                        </ul>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Algorithm Insights</h4>
                                        <ul className="text-sm text-muted-foreground space-y-1">
                                            <li>• Scores are calculated using weighted averages</li>
                                            <li>• Real-time updates as you adjust priorities</li>
                                            <li>• Recommendations improve with more data</li>
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Action Buttons */}
                <div className="flex justify-center gap-4">
                    <Button 
                        onClick={() => navigate('/roommate-matching')} 
                        variant="outline"
                    >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Find Roommates
                    </Button>
                    <Button 
                        onClick={() => navigate('/properties')} 
                        variant="outline"
                    >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Browse Properties
                    </Button>
                </div>
            </div>
        </div>
    );
}
