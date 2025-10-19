import { useState, useEffect } from "react";
import { HousingScore } from "./HousingScore";
import { preferencesAPI } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Target } from "lucide-react";

interface HousingScoreWithPrioritiesProps {
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

interface HousingPriorities {
  budget: number;
  commute: number;
  safety: number;
  roommates: number;
}

const defaultPriorities: HousingPriorities = {
  budget: 25,
  commute: 25,
  safety: 25,
  roommates: 25,
};

export const HousingScoreWithPriorities = ({ property }: HousingScoreWithPrioritiesProps) => {
  const [priorities, setPriorities] = useState<HousingPriorities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPriorities = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const userPriorities = await preferencesAPI.getHousingPriorities();
        setPriorities(userPriorities);
      } catch (err) {
        console.error('Failed to fetch housing priorities:', err);
        setError('Unable to load your housing priorities');
        // Use default priorities as fallback
        setPriorities(defaultPriorities);
      } finally {
        setLoading(false);
      }
    };

    fetchPriorities();
  }, []);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            <CardTitle>Housing Match Score</CardTitle>
          </div>
          <CardDescription>Loading your preferences...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-2 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-2 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-2 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-2 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !priorities) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Housing Match Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}. Please check your profile settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {error && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Using default priorities. {error}
          </AlertDescription>
        </Alert>
      )}
      <HousingScore 
        priorities={priorities || defaultPriorities} 
        property={property} 
      />
    </div>
  );
};

export default HousingScoreWithPriorities;

