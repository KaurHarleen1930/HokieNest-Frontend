import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Target } from "lucide-react";
import PriorityRanking, { PriorityItem } from "@/components/PriorityRanking";
import { useToast } from "@/hooks/use-toast";
import { priorityWeightsAPI } from "@/lib/api";

export default function PriorityRankingPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState<'intro' | 'ranking' | 'complete'>('ranking');
    const [userRankings, setUserRankings] = useState<PriorityItem[]>([]);

    const handleRankingChange = (rankings: PriorityItem[]) => {
        setUserRankings(rankings);
    };

    const handleSubmit = async (rankings: PriorityItem[]) => {
        try {
            // Convert rankings to weights
            const weights = {
                budget: rankings.find(r => r.id === 'budget') ? getWeightForRank(rankings.findIndex(r => r.id === 'budget')) : 20,
                location: rankings.find(r => r.id === 'location') ? getWeightForRank(rankings.findIndex(r => r.id === 'location')) : 18,
                lifestyle: rankings.find(r => r.id === 'lifestyle') ? getWeightForRank(rankings.findIndex(r => r.id === 'lifestyle')) : 18,
                pets: rankings.find(r => r.id === 'pets') ? getWeightForRank(rankings.findIndex(r => r.id === 'pets')) : 15,
                timing: rankings.find(r => r.id === 'timing') ? getWeightForRank(rankings.findIndex(r => r.id === 'timing')) : 15,
                work: rankings.find(r => r.id === 'work') ? getWeightForRank(rankings.findIndex(r => r.id === 'work')) : 14,
            };

            // Save to backend using the API
            await priorityWeightsAPI.saveWeights(weights);

            toast({
                title: "Priorities Saved!",
                description: "Your roommate matching preferences have been updated.",
            });

            setCurrentStep('complete');
        } catch (error: any) {
            console.error('Error saving priorities:', error);
            const errorMessage = error.message || "Failed to save your priorities. Please try again.";
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        }
    };

    // Helper function to get weight percentage based on rank
    const getWeightForRank = (rank: number): number => {
        // Your custom priority weights: #1=25%, #2=20%, #3=18%, #4=15%, #5=12%, #6=10%
        const weights = [25, 20, 18, 15, 12, 10];
        return weights[rank] || 10;
    };

    const handleStartRanking = () => {
        setCurrentStep('ranking');
    };

    const handleGoToMatching = () => {
        navigate('/roommate-matching');
    };

    const handleGoBack = () => {
        if (currentStep === 'ranking') {
            setCurrentStep('intro');
        } else if (currentStep === 'complete') {
            setCurrentStep('ranking');
        }
    };

    if (currentStep === 'intro') {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-3xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="p-3 rounded-full bg-primary/10">
                                <Target className="h-8 w-8 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">
                            Set Your Roommate Priorities
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Help us find your perfect roommate by ranking what matters most to you.
                            Drag and drop the preferences below to show us your priorities.
                        </p>
                    </div>

                    {/* Benefits */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">🎯 Better Matches</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    Get roommate suggestions that align with your most important preferences,
                                    whether that's budget, location, or lifestyle compatibility.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">⚡ Personalized Results</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    Our algorithm will prioritize matches based on your rankings,
                                    giving you the most relevant roommate suggestions first.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">🔄 Easy Updates</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    Change your priorities anytime as your needs evolve.
                                    Your matching results will automatically update.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">📊 Transparent Scoring</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    See exactly why each roommate was matched with you based on
                                    your priority rankings and compatibility scores.
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-4">
                        <Button variant="outline" onClick={() => navigate('/roommate-matching')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Matching
                        </Button>
                        <Button onClick={handleStartRanking} size="lg">
                            Start Ranking
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (currentStep === 'ranking') {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => navigate('/roommate-matching')} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Matching
                    </Button>
                </div>

                <PriorityRanking
                    onRankingChange={handleRankingChange}
                    onSubmit={handleSubmit}
                />
            </div>
        );
    }

    if (currentStep === 'complete') {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-2xl mx-auto text-center space-y-8">
                    <div className="space-y-4">
                        <div className="flex justify-center">
                            <div className="p-4 rounded-full bg-green-100">
                                <Target className="h-12 w-12 text-green-600" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">
                            Priorities Set Successfully!
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Your roommate matching preferences have been saved.
                            We'll use these priorities to find your perfect roommate matches.
                        </p>
                    </div>

                    {/* Show their top 3 priorities */}
                    <Card className="text-left">
                        <CardHeader>
                            <CardTitle>Your Top Priorities</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {userRankings.slice(0, 3).map((item, index) => (
                                    <div key={item.id} className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                                            {index + 1}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.icon}
                                            <span className="font-medium">{item.name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-center gap-4">
                        <Button variant="outline" onClick={handleGoBack}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Edit Priorities
                        </Button>
                        <Button onClick={handleGoToMatching} size="lg">
                            Find My Matches
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
