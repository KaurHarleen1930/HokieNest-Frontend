import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

interface QuestionWeight {
  questionId: string;
  weight: number; // 1-5 scale
}

interface WeightedMatch {
  user: {
    user_id: number;
    email: string;
    first_name: string;
    last_name: string;
    gender?: string;
    age?: number;
    major?: string;
  };
  housing: any;
  lifestyle: any;
  questionWeights: QuestionWeight[];
  compatibilityScore: number;
  weightedScore: number;
  scoreBreakdown: {
    budget: number;
    sleepSchedule: number;
    cleanliness: number;
    socialVibe: number;
    pets: number;
    workFromHome: number;
    guests: number;
    smoking: number;
  };
}

// Calculate compatibility score for a specific question
function calculateQuestionCompatibility(
  user1Value: any,
  user2Value: any,
  questionId: string
): number {
  switch (questionId) {
    case 'budget':
      if (!user1Value || !user2Value) return 50;
      const user1Budget = (user1Value.budget_min + user1Value.budget_max) / 2;
      const user2Budget = (user2Value.budget_min + user2Value.budget_max) / 2;
      const budgetDiff = Math.abs(user1Budget - user2Budget);
      return Math.max(0, 100 - (budgetDiff / 10)); // 10 points per $100 difference

    case 'sleepSchedule':
      if (!user1Value || !user2Value) return 50;
      if (user1Value.sleep_schedule === user2Value.sleep_schedule) return 100;
      if (user1Value.sleep_schedule === 'flexible' || user2Value.sleep_schedule === 'flexible') return 70;
      return 30; // Very different sleep schedules

    case 'cleanliness':
      if (!user1Value || !user2Value) return 50;
      const diff = Math.abs(user1Value.cleanliness_level - user2Value.cleanliness_level);
      return Math.max(0, 100 - (diff * 20)); // 20 points per level difference

    case 'socialVibe':
      if (!user1Value || !user2Value) return 50;
      if (user1Value.noise_tolerance === user2Value.noise_tolerance) return 100;
      if (user1Value.noise_tolerance === 'moderate' || user2Value.noise_tolerance === 'moderate') return 70;
      return 30; // Very different social preferences

    case 'pets':
      if (!user1Value || !user2Value) return 50;
      const user1Pets = user1Value.pets || '';
      const user2Pets = user2Value.pets || '';
      const user1Comfortable = user1Value.comfortable_with_pets;
      const user2Comfortable = user2Value.comfortable_with_pets;
      
      if (user1Pets === user2Pets) return 100;
      if (user1Comfortable && user2Comfortable) return 80;
      if (!user1Comfortable && !user2Comfortable) return 100;
      return 20; // Mismatch

    case 'workFromHome':
      if (!user1Value || !user2Value) return 50;
      const wfhDiff = Math.abs(user1Value.work_from_home_days - user2Value.work_from_home_days);
      return Math.max(0, 100 - (wfhDiff * 10)); // 10 points per day difference

    case 'guests':
      if (!user1Value || !user2Value) return 50;
      if (user1Value.guests_frequency === user2Value.guests_frequency) return 100;
      // Partial compatibility for similar guest preferences
      const guestLevels = ['Never', 'Rarely', 'Occasionally', 'Frequently', 'Very frequently'];
      const user1Level = guestLevels.indexOf(user1Value.guests_frequency);
      const user2Level = guestLevels.indexOf(user2Value.guests_frequency);
      if (user1Level === -1 || user2Level === -1) return 50;
      const guestDiff = Math.abs(user1Level - user2Level);
      return Math.max(0, 100 - (guestDiff * 20));

    case 'smoking':
      if (!user1Value || !user2Value) return 50;
      const user1Smoking = user1Value.smoking_policy || [];
      const user2Smoking = user2Value.smoking_policy || [];
      
      // Check if any policies match
      const hasMatch = user1Smoking.some((policy: string) => user2Smoking.includes(policy));
      return hasMatch ? 100 : 20;

    default:
      return 50;
  }
}

// Calculate weighted score based on question weights
function calculateWeightedScore(
  userWeights: QuestionWeight[],
  potentialRoommate: {
    housing: any;
    lifestyle: any;
  },
  currentUser: {
    housing: any;
    lifestyle: any;
  }
): { score: number; breakdown: any } {
  let totalWeightedScore = 0;
  let totalWeight = 0;
  const breakdown: any = {};

  for (const weight of userWeights) {
    const compatibilityScore = calculateQuestionCompatibility(
      currentUser.housing || currentUser.lifestyle,
      potentialRoommate.housing || potentialRoommate.lifestyle,
      weight.questionId
    );

    const weightedScore = (compatibilityScore * weight.weight) / 5; // Normalize to 1-5 scale
    totalWeightedScore += weightedScore;
    totalWeight += weight.weight;
    
    breakdown[weight.questionId] = Math.round(weightedScore);
  }

  const finalScore = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 100) : 50;

  return {
    score: finalScore,
    breakdown
  };
}

// Get weighted roommate matches
router.get('/weighted-matches', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get current user's preferences and weights
    const { data: currentUserHousing } = await supabase
      .from('housing_preferences')
      .select('*')
      .eq('user_id', currentUserId)
      .single();

    const { data: currentUserLifestyle } = await supabase
      .from('lifestyle_preferences')
      .select('*')
      .eq('user_id', currentUserId)
      .single();

    const { data: currentUserPriorities } = await supabase
      .from('housing_priorities')
      .select('*')
      .eq('user_id', currentUserId)
      .single();

    if (!currentUserHousing || !currentUserLifestyle) {
      return res.status(400).json({ 
        message: 'Please complete your roommate questionnaire first' 
      });
    }

    // Convert housing priorities to question weights format
    const priorities = currentUserPriorities?.preferences || { budget: 25, commute: 25, safety: 25, roommates: 25 };
    const userWeights: QuestionWeight[] = [
      { questionId: 'budget', weight: Math.round(priorities.budget / 20) || 3 },
      { questionId: 'sleepSchedule', weight: Math.round(priorities.roommates / 20) || 3 },
      { questionId: 'cleanliness', weight: Math.round(priorities.safety / 20) || 3 },
      { questionId: 'socialVibe', weight: Math.round(priorities.roommates / 20) || 3 },
      { questionId: 'pets', weight: 2 },
      { questionId: 'workFromHome', weight: 2 },
      { questionId: 'guests', weight: 2 },
      { questionId: 'smoking', weight: 3 },
    ];

    // Get all other users with their preferences
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select(`
        user_id,
        email,
        first_name,
        last_name,
        gender,
        age,
        major
      `)
      .neq('user_id', currentUserId)
      .eq('is_admin', false);

    if (usersError) {
      throw usersError;
    }

    if (!allUsers || allUsers.length === 0) {
      return res.json({ matches: [], userWeights });
    }

    // Get preferences for all users
    const userIds = allUsers.map(u => u.user_id);
    const { data: allHousingPrefs } = await supabase
      .from('housing_preferences')
      .select('*')
      .in('user_id', userIds);

    const { data: allLifestylePrefs } = await supabase
      .from('lifestyle_preferences')
      .select('*')
      .in('user_id', userIds);

    // Create lookup maps
    const housingMap = new Map(allHousingPrefs?.map(h => [h.user_id, h]) || []);
    const lifestyleMap = new Map(allLifestylePrefs?.map(l => [l.user_id, l]) || []);

    // Calculate matches
    const matches: WeightedMatch[] = allUsers
      .filter(user => {
        // Only include users who have completed their questionnaire
        return housingMap.has(user.user_id) && lifestyleMap.has(user.user_id);
      })
      .map(user => {
        const housing = housingMap.get(user.user_id);
        const lifestyle = lifestyleMap.get(user.user_id);

        // Calculate basic compatibility score
        const compatibilityScore = 75; // Simplified for now

        // Calculate weighted score
        const weightedData = calculateWeightedScore(
          userWeights,
          { housing, lifestyle },
          { housing: currentUserHousing, lifestyle: currentUserLifestyle }
        );

        return {
          user,
          housing,
          lifestyle,
          questionWeights: userWeights,
          compatibilityScore,
          weightedScore: weightedData.score,
          scoreBreakdown: weightedData.breakdown
        };
      })
      .filter(match => match.weightedScore > 30) // Filter out very low matches
      .sort((a, b) => b.weightedScore - a.weightedScore) // Sort by weighted score
      .slice(0, 20); // Limit to top 20 matches

    res.json({ matches, userWeights });
  } catch (error) {
    console.error('Weighted matching error:', error);
    next(error);
  }
});

export { router as weightedMatchingRoutes };

