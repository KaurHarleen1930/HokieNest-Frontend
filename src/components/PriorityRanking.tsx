import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    GripVertical,
    DollarSign,
    MapPin,
    Heart,
    Clock,
    Home,
    Users,
    Star,
    CheckCircle,
    ChevronUp,
    ChevronDown
} from "lucide-react";

export interface PriorityItem {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    category: 'budget' | 'location' | 'lifestyle' | 'pets' | 'timing' | 'work';
}

export interface PriorityRankingProps {
    onRankingChange?: (rankings: PriorityItem[]) => void;
    initialRankings?: PriorityItem[];
    onSubmit?: (rankings: PriorityItem[]) => void;
}

const defaultPriorities: PriorityItem[] = [
    {
        id: 'budget',
        name: 'Budget',
        description: 'Rent affordability and financial compatibility',
        icon: <DollarSign className="h-5 w-5" />,
        category: 'budget'
    },
    {
        id: 'location',
        name: 'Location',
        description: 'Distance to campus, commute time, and neighborhood',
        icon: <MapPin className="h-5 w-5" />,
        category: 'location'
    },
    {
        id: 'lifestyle',
        name: 'Lifestyle',
        description: 'Cleanliness, noise tolerance, and social preferences',
        icon: <Heart className="h-5 w-5" />,
        category: 'lifestyle'
    },
    {
        id: 'pets',
        name: 'Pets',
        description: 'Pet ownership and pet compatibility',
        icon: <Users className="h-5 w-5" />,
        category: 'pets'
    },
    {
        id: 'timing',
        name: 'Timing',
        description: 'Move-in date and lease length preferences',
        icon: <Clock className="h-5 w-5" />,
        category: 'timing'
    },
    {
        id: 'work',
        name: 'Work Style',
        description: 'Work from home days and quiet hours',
        icon: <Home className="h-5 w-5" />,
        category: 'work'
    }
];

export default function PriorityRanking({
    onRankingChange,
    initialRankings = defaultPriorities,
    onSubmit
}: PriorityRankingProps) {
    const [rankings, setRankings] = useState<PriorityItem[]>(initialRankings);
    const [draggedItem, setDraggedItem] = useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    useEffect(() => {
        onRankingChange?.(rankings);
    }, [rankings, onRankingChange]);

    // Improved drag and drop handlers
    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        setDraggedItem(itemId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemId);
        e.dataTransfer.setData('application/json', JSON.stringify({ id: itemId }));
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        // Only clear if we're leaving the card entirely
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverIndex(null);
        }
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        e.stopPropagation();

        let draggedId: string;
        try {
            draggedId = e.dataTransfer.getData('text/plain') || JSON.parse(e.dataTransfer.getData('application/json')).id;
        } catch {
            draggedId = e.dataTransfer.getData('text/plain');
        }

        if (!draggedId || draggedId === rankings[dropIndex].id) {
            setDraggedItem(null);
            setDragOverIndex(null);
            return;
        }

        const newRankings = [...rankings];
        const draggedIndex = newRankings.findIndex(item => item.id === draggedId);

        if (draggedIndex === -1) {
            setDraggedItem(null);
            setDragOverIndex(null);
            return;
        }

        // Remove dragged item and insert at new position
        const [draggedItem] = newRankings.splice(draggedIndex, 1);
        newRankings.splice(dropIndex, 0, draggedItem);

        setRankings(newRankings);
        setDraggedItem(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverIndex(null);
    };

    // Alternative: Move up/down buttons for better accessibility
    const moveItem = (index: number, direction: 'up' | 'down') => {
        const newRankings = [...rankings];
        const newIndex = direction === 'up' ? index - 1 : index + 1;

        if (newIndex >= 0 && newIndex < newRankings.length) {
            [newRankings[index], newRankings[newIndex]] = [newRankings[newIndex], newRankings[index]];
            setRankings(newRankings);
        }
    };

    const getPriorityWeight = (index: number): number => {
        // Higher priority (lower index) gets higher weight
        // 1st priority = 25%, 2nd = 20%, 3rd = 18%, 4th = 15%, 5th = 12%, 6th = 10%
        const weights = [25, 20, 18, 15, 12, 10];
        return weights[index] || 10;
    };

    const getPriorityColor = (index: number): string => {
        const colors = [
            'bg-red-100 text-red-800 border-red-200',
            'bg-orange-100 text-orange-800 border-orange-200',
            'bg-yellow-100 text-yellow-800 border-yellow-200',
            'bg-blue-100 text-blue-800 border-blue-200',
            'bg-indigo-100 text-indigo-800 border-indigo-200',
            'bg-purple-100 text-purple-800 border-purple-200'
        ];
        return colors[index] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const handleSubmit = () => {
        onSubmit?.(rankings);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                    Rank Your Roommate Priorities
                </h2>
                <p className="text-muted-foreground">
                    Drag and drop the cards or use the up/down arrows to rank what matters most to you when finding a roommate
                </p>
            </div>

            <div className="space-y-3">
                {rankings.map((item, index) => (
                    <Card
                        key={item.id}
                        className={`
              transition-all duration-200 hover:shadow-md
              ${draggedItem === item.id ? 'opacity-50 scale-95' : ''}
              ${dragOverIndex === index ? 'ring-2 ring-primary ring-opacity-50' : ''}
            `}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                                {/* Drag Handle */}
                                <div className="flex-shrink-0 cursor-move">
                                    <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                                </div>

                                {/* Priority Badge */}
                                <div className="flex-shrink-0">
                                    <Badge className={`${getPriorityColor(index)} border`}>
                                        #{index + 1}
                                    </Badge>
                                </div>

                                {/* Weight Badge */}
                                <div className="flex-shrink-0">
                                    <Badge variant="outline" className="text-xs">
                                        {getPriorityWeight(index)}%
                                    </Badge>
                                </div>

                                {/* Icon */}
                                <div className="flex-shrink-0 text-primary">
                                    {item.icon}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-foreground">{item.name}</h3>
                                    <p className="text-sm text-muted-foreground">{item.description}</p>
                                </div>

                                {/* Priority Level Indicator */}
                                <div className="flex-shrink-0">
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: 6 }, (_, i) => (
                                            <Star
                                                key={i}
                                                className={`h-4 w-4 ${i < (6 - index)
                                                        ? 'text-yellow-400 fill-current'
                                                        : 'text-gray-300'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Move Up/Down Buttons */}
                                <div className="flex-shrink-0 flex flex-col gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => moveItem(index, 'up')}
                                        disabled={index === 0}
                                    >
                                        <ChevronUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => moveItem(index, 'down')}
                                        disabled={index === rankings.length - 1}
                                    >
                                        <ChevronDown className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Summary */}
            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Your Priority Summary
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {rankings.map((item, index) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                                <span className="font-medium">{item.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">#{index + 1}</span>
                                    <Badge variant="outline" className="text-xs">
                                        {getPriorityWeight(index)}%
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Submit Button */}
            {onSubmit && (
                <div className="flex justify-center">
                    <Button onClick={handleSubmit} size="lg" className="gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Save My Priorities
                    </Button>
                </div>
            )}
        </div>
    );
}
