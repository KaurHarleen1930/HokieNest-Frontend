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
    Target,
    BarChart3,
    Save,
    X,
    Settings
} from 'lucide-react';

export interface HousingPriorities {
    budget: number;
    commute: number;
    safety: number;
    roommates: number;
}

interface HousingPrioritiesSelectorProps {
    initialPriorities?: HousingPriorities;
    onSave?: (priorities: HousingPriorities) => Promise<void>;
    onCancel?: () => void;
    showSaveButton?: boolean;
    showCancelButton?: boolean;
    className?: string;
}

export const HousingPrioritiesSelector: React.FC<HousingPrioritiesSelectorProps> = ({
    initialPriorities = { budget: 25, commute: 25, safety: 25, roommates: 25 },
    onSave,
    onCancel,
    showSaveButton = true,
    showCancelButton = true,
    className = ""
}) => {
    const [priorities, setPriorities] = useState<HousingPriorities>(initialPriorities);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setPriorities(initialPriorities);
    }, [initialPriorities]);

    const handlePriorityChange = (key: keyof HousingPriorities, value: number[]) => {
        setPriorities(prev => ({
            ...prev,
            [key]: value[0]
        }));
    };

    const getTotalPriorities = () => {
        return priorities.budget + priorities.commute + priorities.safety + priorities.roommates;
    };

    const isPrioritiesValid = () => {
        return getTotalPriorities() === 100;
    };

    const handleSave = async () => {
        if (!isPrioritiesValid()) return;
        
        setIsLoading(true);
        try {
            if (onSave) {
                await onSave(priorities);
            }
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving priorities:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setPriorities(initialPriorities);
        setIsEditing(false);
        if (onCancel) {
            onCancel();
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
        <Card className={`bg-surface border-surface-3 ${className}`}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Housing Priorities
                </CardTitle>
                <CardDescription>
                    Configure your housing priorities to get personalized recommendations
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {!isEditing ? (
                    <div className="space-y-4">
                        {/* Priority Overview */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                                <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-green-600">{priorities.budget}%</div>
                                <div className="text-sm text-muted-foreground">Budget</div>
                            </div>
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                                <MapPin className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-blue-600">{priorities.commute}%</div>
                                <div className="text-sm text-muted-foreground">Commute</div>
                            </div>
                            <div className="text-center p-3 bg-purple-50 rounded-lg">
                                <Shield className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-purple-600">{priorities.safety}%</div>
                                <div className="text-sm text-muted-foreground">Safety</div>
                            </div>
                            <div className="text-center p-3 bg-orange-50 rounded-lg">
                                <Users className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-orange-600">{priorities.roommates}%</div>
                                <div className="text-sm text-muted-foreground">Roommates</div>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Total Priority</span>
                            <Badge variant="default" className="text-sm">
                                {getTotalPriorities()}%
                            </Badge>
                        </div>

                        <Button 
                            onClick={() => setIsEditing(true)} 
                            variant="outline" 
                            className="w-full"
                        >
                            <Settings className="h-4 w-4 mr-2" />
                            Edit Priorities
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
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
                                <Badge variant={isPrioritiesValid() ? "default" : "destructive"}>
                                    {getTotalPriorities()}%
                                </Badge>
                            </div>
                            <Progress
                                value={getTotalPriorities()}
                                className="h-2"
                            />
                            {!isPrioritiesValid() && (
                                <Alert variant="destructive" className="mt-2">
                                    <AlertDescription>
                                        Priorities must total exactly 100% to save
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            {showSaveButton && (
                                <Button 
                                    onClick={handleSave} 
                                    disabled={isLoading || !isPrioritiesValid()} 
                                    className="flex-1"
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    {isLoading ? 'Saving...' : 'Save Priorities'}
                                </Button>
                            )}
                            {showCancelButton && (
                                <Button 
                                    onClick={handleCancel} 
                                    variant="outline" 
                                    className="flex-1"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default HousingPrioritiesSelector;
