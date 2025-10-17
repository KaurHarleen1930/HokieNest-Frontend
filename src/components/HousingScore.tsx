import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  MapPin, 
  Shield, 
  Users, 
  TrendingUp,
  Target,
  Star
} from "lucide-react";

interface HousingScoreProps {
  priorities: {
    budget: number;
    commute: number;
    safety: number;
    roommates: number;
  };
  property: {
    id: string;
    title: string;
    price: number;
    address: string;
    distanceFromCampus?: number;
    safetyScore?: number;
    roommateCompatibility?: number;
  };
}

export const HousingScore = ({ priorities, property }: HousingScoreProps) => {
  // Calculate individual scores (0-100)
  const budgetScore = calculateBudgetScore(property.price, priorities.budget);
  const commuteScore = calculateCommuteScore(property.distanceFromCampus, priorities.commute);
  const safetyScore = calculateSafetyScore(property.safetyScore, priorities.safety);
  const roommateScore = calculateRoommateScore(property.roommateCompatibility, priorities.roommates);

  // Calculate weighted total score
  const totalScore = Math.round(
    (budgetScore * priorities.budget / 100) +
    (commuteScore * priorities.commute / 100) +
    (safetyScore * priorities.safety / 100) +
    (roommateScore * priorities.roommates / 100)
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    if (score >= 40) return "outline";
    return "destructive";
  };

  const getOverallRating = (score: number) => {
    if (score >= 90) return { label: "Excellent", color: "text-green-600" };
    if (score >= 80) return { label: "Very Good", color: "text-green-500" };
    if (score >= 70) return { label: "Good", color: "text-yellow-600" };
    if (score >= 60) return { label: "Fair", color: "text-orange-600" };
    if (score >= 50) return { label: "Poor", color: "text-red-500" };
    return { label: "Very Poor", color: "text-red-600" };
  };

  const overallRating = getOverallRating(totalScore);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Housing Match Score
            </CardTitle>
            <CardDescription>
              Based on your priority preferences
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getScoreColor(totalScore)}`}>
              {totalScore}/100
            </div>
            <Badge variant={getScoreBadgeVariant(totalScore)} className="mt-1">
              {overallRating.label}
            </Badge>
          </div>
        </div>
        <Progress value={totalScore} className="h-2 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ScoreItem
              icon={DollarSign}
              title="Budget"
              score={budgetScore}
              priority={priorities.budget}
              color="text-green-600"
            />
            <ScoreItem
              icon={MapPin}
              title="Commute"
              score={commuteScore}
              priority={priorities.commute}
              color="text-blue-600"
            />
            <ScoreItem
              icon={Shield}
              title="Safety"
              score={safetyScore}
              priority={priorities.safety}
              color="text-purple-600"
            />
            <ScoreItem
              icon={Users}
              title="Roommates"
              score={roommateScore}
              priority={priorities.roommates}
              color="text-orange-600"
            />
          </div>
          
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Priority Weighted Score</span>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{totalScore}/100</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ScoreItem = ({ 
  icon: Icon, 
  title, 
  score, 
  priority, 
  color 
}: { 
  icon: any; 
  title: string; 
  score: number; 
  priority: number; 
  color: string;
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="outline" className="text-xs">
          {priority}%
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={score} className="h-1 flex-1" />
        <span className={`text-sm font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
      </div>
    </div>
  );
};

// Scoring algorithms
function calculateBudgetScore(price: number, priority: number): number {
  // This would be based on user's budget preferences
  // For demo purposes, assuming budget range is $500-$2000
  const budgetMin = 500;
  const budgetMax = 2000;
  
  if (price <= budgetMin) return 100;
  if (price >= budgetMax) return 0;
  
  // Linear interpolation
  return Math.round(100 - ((price - budgetMin) / (budgetMax - budgetMin)) * 100);
}

function calculateCommuteScore(distance?: number, priority: number): number {
  if (!distance) return 50; // Default if no distance data
  
  // Distance in minutes
  if (distance <= 5) return 100;
  if (distance <= 10) return 80;
  if (distance <= 15) return 60;
  if (distance <= 30) return 40;
  return 20;
}

function calculateSafetyScore(safetyScore?: number, priority: number): number {
  if (!safetyScore) return 50; // Default if no safety data
  
  // Safety score 1-10 scale
  return Math.round((safetyScore / 10) * 100);
}

function calculateRoommateScore(compatibility?: number, priority: number): number {
  if (!compatibility) return 50; // Default if no compatibility data
  
  // Compatibility score 0-100
  return compatibility;
}

export default HousingScore;
