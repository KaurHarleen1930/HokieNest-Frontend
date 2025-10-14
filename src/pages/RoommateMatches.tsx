import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Users, TrendingUp, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { roommateAPI } from '@/lib/api';

interface MatchResult {
  user_id: number;
  score: number;
  compatibility_details: {
    housing_score: number;
    lifestyle_score: number;
    profile_score: number;
    user_info: {
      first_name: string;
      last_name: string;
      age?: number;
      gender?: string;
      major?: string;
    };
  };
}

interface SavedMatch {
  match_id: number;
  user_id: number;
  score: number;
  created_at: string;
  last_updated: string;
  user_info: {
    first_name: string;
    last_name: string;
    age?: number;
    gender?: string;
    major?: string;
  };
}

type Match = MatchResult | SavedMatch;

interface MatchStats {
  total_users: number;
  user_matches: number;
  average_compatibility: number;
  user_id: number;
}

const RoommateMatches: React.FC = () => {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([]);
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('live');
  const { toast } = useToast();

  const fetchLiveMatches = async (limit: number = 10) => {
    try {
      setLoading(true);
      const data = await roommateAPI.getMatches(limit);
      setMatches(data.matches || []);
    } catch (error) {
        console.error('Error fetching live matches:', error);
        const errorMsg = error?.message || error?.response?.data?.message || '';
        if (errorMsg.includes('questionnaire')) {
          toast({
            title: 'Complete Questionnaire',
            description: 'You must complete the roommate questionnaire before you can find or generate matches.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: errorMsg || 'Failed to fetch live matches',
            variant: 'destructive',
          });
        }
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedMatches = async () => {
    try {
      setLoading(true);
      const data = await roommateAPI.getSavedMatches();
      setSavedMatches(data.matches || []);
    } catch (error) {
      console.error('Error fetching saved matches:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch saved matches',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateNewMatches = async () => {
    try {
      setLoading(true);
      const data = await roommateAPI.generateMatches(10);
      setMatches(data.matches || []);
      toast({
        title: 'Success',
        description: 'New matches generated and saved successfully!',
      });
    } catch (error) {
        console.error('Error generating matches:', error);
        const errorMsg = error?.message || error?.response?.data?.message || '';
        if (errorMsg.includes('questionnaire')) {
          toast({
            title: 'Complete Questionnaire',
            description: 'You must complete the roommate questionnaire before you can find or generate matches.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: errorMsg || 'Failed to generate new matches',
            variant: 'destructive',
          });
        }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await roommateAPI.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchLiveMatches();
    fetchSavedMatches();
    fetchStats();
  }, []);

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

  const MatchCard: React.FC<{ match: Match; isSaved?: boolean }> = ({ match, isSaved = false }) => {
    const userInfo = 'compatibility_details' in match ? match.compatibility_details.user_info : match.user_info;
    const score = match.score;

    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {userInfo.first_name} {userInfo.last_name}
            </CardTitle>
            <Badge variant={getScoreBadgeVariant(score)} className="text-sm">
              {score.toFixed(1)}% Match
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {userInfo.age && <span>Age: {userInfo.age}</span>}
            {userInfo.gender && <span>• {userInfo.gender}</span>}
            {userInfo.major && <span>• {userInfo.major}</span>}
          </div>
        </CardHeader>
        <CardContent>
          {!isSaved && 'compatibility_details' in match && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Housing Compatibility</span>
                  <span className={getScoreColor(match.compatibility_details.housing_score)}>
                    {match.compatibility_details.housing_score.toFixed(1)}%
                  </span>
                </div>
                <Progress value={match.compatibility_details.housing_score} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Lifestyle Compatibility</span>
                  <span className={getScoreColor(match.compatibility_details.lifestyle_score)}>
                    {match.compatibility_details.lifestyle_score.toFixed(1)}%
                  </span>
                </div>
                <Progress value={match.compatibility_details.lifestyle_score} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Profile Compatibility</span>
                  <span className={getScoreColor(match.compatibility_details.profile_score)}>
                    {match.compatibility_details.profile_score.toFixed(1)}%
                  </span>
                </div>
                <Progress value={match.compatibility_details.profile_score} className="h-2" />
              </div>
            </div>
          )}
          {isSaved && 'created_at' in match && (
            <div className="text-sm text-muted-foreground">
              <p>Match created: {new Date(match.created_at).toLocaleDateString()}</p>
              <p>Last updated: {new Date(match.last_updated).toLocaleDateString()}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Roommate Matches</h1>
        <p className="text-muted-foreground">
          Find your perfect roommate based on compatibility scores
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{stats.total_users}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <User className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Your Matches</p>
                  <p className="text-2xl font-bold">{matches.filter(match => match.score > 70).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Avg Compatibility</p>
                  <p className="text-2xl font-bold">{stats.average_compatibility.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 mb-8">
        <Button
          onClick={generateNewMatches}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh New Matches
        </Button>
      </div>

      {/* Matches List (Live Only) */}
      <div className="w-full mt-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : matches.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No live matches found. Try generating new matches!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.filter(match => match.score > 70).map((match) => (
              <MatchCard key={match.user_id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoommateMatches;
