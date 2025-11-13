import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Target, Users, TrendingUp, Settings, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function WeightedMatchingDemo() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Authentication Required</CardTitle>
                        <CardDescription>
                            Please log in to access the weighted roommate matching system.
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
                    <h1 className="text-4xl font-bold text-foreground">Weighted Roommate Matching</h1>
                    <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                        Set importance weights for questionnaire questions and get personalized roommate matches
                    </p>
                    <Badge variant="outline" className="text-sm">
                        Integrated into Find Roommates Tab
                    </Badge>
                </div>

                {/* Features */}
                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="bg-surface border-surface-3">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5 text-blue-600" />
                                Weight Assignment
                            </CardTitle>
                            <CardDescription>
                                Adjust importance levels for key questionnaire questions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>• 8 key questions with 1-5 importance scale</li>
                                <li>• Real-time weight adjustment with sliders</li>
                                <li>• Color-coded importance levels</li>
                                <li>• Instant ranking updates</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="bg-surface border-surface-3">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-green-600" />
                                Personalized Rankings
                            </CardTitle>
                            <CardDescription>
                                Get roommate matches ranked by your specific priorities
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>• Weighted scoring algorithm</li>
                                <li>• Detailed score breakdowns</li>
                                <li>• Personalized match rankings</li>
                                <li>• Transparent scoring system</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                {/* Demo Options */}
                <Card className="bg-surface border-surface-3">
                    <CardHeader>
                        <CardTitle>Try the Weighted Matching System</CardTitle>
                        <CardDescription>
                            Experience the enhanced roommate matching with weight assignments
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                                <h4 className="font-medium">Enhanced Find Roommates</h4>
                                <p className="text-sm text-muted-foreground">
                                    Try the enhanced roommate matching with weight assignments integrated into the Find Roommates tab
                                </p>
                                <Button
                                    onClick={() => navigate('/enhanced-roommate-matching')}
                                    className="w-full gap-2"
                                >
                                    Try Enhanced Matching
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-medium">Original Find Roommates</h4>
                                <p className="text-sm text-muted-foreground">
                                    View the original roommate matching system for comparison
                                </p>
                                <Button
                                    onClick={() => navigate('/roommate-matching')}
                                    variant="outline"
                                    className="w-full gap-2"
                                >
                                    <Users className="h-4 w-4" />
                                    Original Matching
                                </Button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-medium">Complete Questionnaire</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Set up your full profile to get the best weighted matches
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
                        <CardTitle>How Weighted Matching Works</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                                    <span className="text-blue-600 font-bold">1</span>
                                </div>
                                <h4 className="font-medium">Set Weights</h4>
                                <p className="text-sm text-muted-foreground">
                                    Adjust importance levels for key questions using sliders
                                </p>
                            </div>
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                    <span className="text-green-600 font-bold">2</span>
                                </div>
                                <h4 className="font-medium">Algorithm Calculates</h4>
                                <p className="text-sm text-muted-foreground">
                                    System applies your weights to rank potential roommates
                                </p>
                            </div>
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                                    <span className="text-purple-600 font-bold">3</span>
                                </div>
                                <h4 className="font-medium">Get Results</h4>
                                <p className="text-sm text-muted-foreground">
                                    See personalized rankings with detailed score breakdowns
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Weight Scale */}
                <Card className="bg-surface border-surface-3">
                    <CardHeader>
                        <CardTitle>Weight Scale</CardTitle>
                        <CardDescription>
                            Understanding the 1-5 importance scale
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-5">
                            {[
                                { level: 1, label: "Not Important", color: "bg-gray-100 text-gray-600", description: "This factor doesn't matter much" },
                                { level: 2, label: "Somewhat Important", color: "bg-blue-100 text-blue-600", description: "This factor is somewhat relevant" },
                                { level: 3, label: "Important", color: "bg-green-100 text-green-600", description: "This factor is important for compatibility" },
                                { level: 4, label: "Very Important", color: "bg-orange-100 text-orange-600", description: "This factor is very important for a good match" },
                                { level: 5, label: "Critical", color: "bg-red-100 text-red-600", description: "This factor is essential for compatibility" },
                            ].map((weight) => (
                                <div key={weight.level} className="text-center space-y-2">
                                    <Badge className={weight.color}>
                                        {weight.level} - {weight.label}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground">{weight.description}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}






