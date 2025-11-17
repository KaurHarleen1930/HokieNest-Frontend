import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
    DollarSign,
    MapPin,
    Shield,
    Users,
    TrendingUp,
    Star,
    Info,
    Target,
    BarChart3
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface HousingPriorities {
    budget: number;
    commute: number;
    safety: number;
    roommates: number;
}

interface DemoProperty {
    id: string;
    name: string;
    price: number;
    distance: number;
    safetyScore: number;
    roommateCompatibility: number;
    description: string;
    amenities: string[];
}

const DEMO_PROPERTIES: DemoProperty[] = [
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

export default function HousingPrioritiesDemo() {
    const { user } = useAuth();
    const [priorities, setPriorities] = useState<HousingPriorities>({
        budget: 40,
        commute: 30,
        safety: 20,
        roommates: 10
    });

    const [isValid, setIsValid] = useState(true);
    const [recommendations, setRecommendations] = useState<Array<DemoProperty & { score: number; breakdown: any }>>([]);

    // Calculate total and validate
    useEffect(() => {
        const total = priorities.budget + priorities.commute + priorities.safety + priorities.roommates;
        setIsValid(total === 100);

        if (total === 100) {
            calculateRecommendations();
        }
    }, [priorities]);

    const calculateRecommendations = () => {
        const scoredProperties = DEMO_PROPERTIES.map(property => {
            // Normalize scores (0-100 scale)
            const budgetScore = Math.max(0, 100 - ((property.price - 800) / 10)); // Lower price = higher score
            const commuteScore = Math.max(0, 100 - (property.distance * 20)); // Closer = higher score
            const safetyScore = property.safetyScore * 10; // Already 0-10 scale
            const roommateScore = property.roommateCompatibility * 10; // Already 0-10 scale

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

    const handlePriorityChange = (key: keyof HousingPriorities, value: number[]) => {
        setPriorities(prev => ({
            ...prev,
            [key]: value[0]
        }));
    };

    const savePriorities = async () => {
        if (!isValid) {
            toast.error('Priorities must total exactly 100%');
            return;
        }

        try {
            const token = localStorage.getItem('auth_token');
            const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/api/v1`;

            const response = await fetch(`${API_BASE_URL}/preferences/housing-priorities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(priorities)
            });

            if (response.ok) {
                toast.success('Housing priorities saved successfully!');
            } else {
                throw new Error('Failed to save priorities');
            }
        } catch (error) {
            toast.error('Failed to save priorities. Please try again.');
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

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-foreground">Housing Priorities Demo</h1>
                    <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                        Configure your housing priorities with weighted preferences to get personalized property recommendations
                    </p>
                    {user && (
                        <Badge variant="outline" className="text-sm">
                            Logged in as: {user.email}
                        </Badge>
                    )}
                </div>

                {/* Priority Configuration */}
                <Card className="bg-surface border-surface-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            Configure Your Priorities
                        </CardTitle>
                        <CardDescription>
                            Adjust the sliders to set your housing priorities. The percentages must total exactly 100%.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Budget Priority */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-green-600" />
                                    <span className="font-medium">Budget Affordability</span>
                                </div>
                                <Badge variant="outline">{priorities.budget}%</Badge>
                            </div>
                            <Slider
                                value={[priorities.budget]}
                                onValueChange={(value) => handlePriorityChange('budget', value)}
                                max={100}
                                step={5}
                                className="w-full"
                            />
                            <p className="text-sm text-muted-foreground">
                                How important is staying within your budget?
                            </p>
                        </div>

                        <Separator />

                        {/* Commute Priority */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-blue-600" />
                                    <span className="font-medium">Commute Distance</span>
                                </div>
                                <Badge variant="outline">{priorities.commute}%</Badge>
                            </div>
                            <Slider
                                value={[priorities.commute]}
                                onValueChange={(value) => handlePriorityChange('commute', value)}
                                max={100}
                                step={5}
                                className="w-full"
                            />
                            <p className="text-sm text-muted-foreground">
                                How important is living close to campus?
                            </p>
                        </div>

                        <Separator />

                        {/* Safety Priority */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-purple-600" />
                                    <span className="font-medium">Safety & Security</span>
                                </div>
                                <Badge variant="outline">{priorities.safety}%</Badge>
                            </div>
                            <Slider
                                value={[priorities.safety]}
                                onValueChange={(value) => handlePriorityChange('safety', value)}
                                max={100}
                                step={5}
                                className="w-full"
                            />
                            <p className="text-sm text-muted-foreground">
                                How important is neighborhood safety?
                            </p>
                        </div>

                        <Separator />

                        {/* Roommates Priority */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-orange-600" />
                                    <span className="font-medium">Roommate Compatibility</span>
                                </div>
                                <Badge variant="outline">{priorities.roommates}%</Badge>
                            </div>
                            <Slider
                                value={[priorities.roommates]}
                                onValueChange={(value) => handlePriorityChange('roommates', value)}
                                max={100}
                                step={5}
                                className="w-full"
                            />
                            <p className="text-sm text-muted-foreground">
                                How important is finding compatible roommates?
                            </p>
                        </div>

                        {/* Total Validation */}
                        <div className="pt-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">Total Priority</span>
                                <Badge variant={isValid ? "default" : "destructive"}>
                                    {priorities.budget + priorities.commute + priorities.safety + priorities.roommates}%
                                </Badge>
                            </div>
                            <Progress
                                value={priorities.budget + priorities.commute + priorities.safety + priorities.roommates}
                                className="h-2"
                            />
                            {!isValid && (
                                <Alert variant="destructive" className="mt-2">
                                    <AlertDescription>
                                        Priorities must total exactly 100% to get recommendations
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        {/* Save Button */}
                        <Button
                            onClick={savePriorities}
                            disabled={!isValid}
                            className="w-full"
                            size="lg"
                        >
                            Save My Priorities
                        </Button>
                    </CardContent>
                </Card>

                {/* Recommendations */}
                {isValid && recommendations.length > 0 && (
                    <Card className="bg-surface border-surface-3">
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
                                {recommendations.map((property, index) => (
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
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Algorithm Explanation */}
                <Card className="bg-surface border-surface-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5" />
                            How the Algorithm Works
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <h4 className="font-medium">1. Data Collection</h4>
                                <p className="text-sm text-muted-foreground">
                                    Users set weighted priorities for budget, commute, safety, and roommate compatibility.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium">2. Property Scoring</h4>
                                <p className="text-sm text-muted-foreground">
                                    Each property gets scored on all criteria (0-100 scale).
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium">3. Weighted Calculation</h4>
                                <p className="text-sm text-muted-foreground">
                                    Final score = (Budget Score × Budget Weight) + (Commute Score × Commute Weight) + ...
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium">4. Personalized Ranking</h4>
                                <p className="text-sm text-muted-foreground">
                                    Properties are ranked by their weighted scores for personalized recommendations.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

