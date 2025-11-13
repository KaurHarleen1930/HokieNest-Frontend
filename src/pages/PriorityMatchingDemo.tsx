import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Target, Users, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function PriorityMatchingDemo() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Authentication Required</CardTitle>
                        <CardDescription>
                            Please log in to access the priority-based roommate matching system.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate('/login')} className="w-full">
                            Log In
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-foreground">Priority-Based Roommate Matching</h1>
                    <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                        Experience the next generation of roommate matching that uses your housing priorities to find the perfect matches
                    </p>
                    <Badge variant="outline" className="text-sm">
                        Demo Version - Works with Real Data
                    </Badge>
                </div>

                {/* Features */}
                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="bg-surface border-surface-3">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-5 w-5 text-blue-600" />
                                Housing Priorities Integration
                            </CardTitle>
                            <CardDescription>
                                Set your priorities for budget, commute, safety, and roommate compatibility
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>• Weighted scoring based on your preferences</li>
                                <li>• Real-time priority adjustment</li>
                                <li>• Transparent algorithm explanation</li>
                                <li>• Personalized match rankings</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="bg-surface border-surface-3">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-green-600" />
                                Real User Matching
                            </CardTitle>
                            <CardDescription>
                                Find actual VT students based on comprehensive compatibility analysis
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>• Lifestyle compatibility scoring</li>
                                <li>• Housing preference matching</li>
                                <li>• Priority-weighted final rankings</li>
                                <li>• Detailed score breakdowns</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                {/* Demo Options */}
                <Card className="bg-surface border-surface-3">
                    <CardHeader>
                        <CardTitle>Try the Priority-Based Matching System</CardTitle>
                        <CardDescription>
                            Choose how you'd like to experience the enhanced roommate matching
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                                <h4 className="font-medium">Option 1: Set Your Priorities</h4>
                                <p className="text-sm text-muted-foreground">
                                    Configure your housing priorities and see how they affect roommate matching
                                </p>
                                <Button
                                    onClick={() => navigate('/housing-priorities-demo')}
                                    className="w-full gap-2"
                                >
                                    Configure Priorities
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-medium">Option 2: View Priority-Based Matches</h4>
                                <p className="text-sm text-muted-foreground">
                                    See real roommate matches ranked by your housing priorities
                                </p>
                                <Button
                                    onClick={() => navigate('/priority-based-matching')}
                                    variant="outline"
                                    className="w-full gap-2"
                                >
                                    <TrendingUp className="h-4 w-4" />
                                    View Matches
                                </Button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-medium">Complete Questionnaire</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Set up your full profile including housing priorities
                                    </p>
                                </div>
                                <Button
                                    onClick={() => navigate('/roommate-questionnaire')}
                                    variant="secondary"
                                    className="gap-2"
                                >
                                    Start Questionnaire
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* How It Works */}
                <Card className="bg-surface border-surface-3">
                    <CardHeader>
                        <CardTitle>How Priority-Based Matching Works</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                                    <span className="text-blue-600 font-bold">1</span>
                                </div>
                                <h4 className="font-medium">Set Priorities</h4>
                                <p className="text-sm text-muted-foreground">
                                    Configure your housing priorities (budget, commute, safety, roommates)
                                </p>
                            </div>
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                    <span className="text-green-600 font-bold">2</span>
                                </div>
                                <h4 className="font-medium">Algorithm Analysis</h4>
                                <p className="text-sm text-muted-foreground">
                                    System analyzes compatibility and applies your priority weights
                                </p>
                            </div>
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                                    <span className="text-purple-600 font-bold">3</span>
                                </div>
                                <h4 className="font-medium">Personalized Results</h4>
                                <p className="text-sm text-muted-foreground">
                                    Get ranked matches with detailed score breakdowns
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}






