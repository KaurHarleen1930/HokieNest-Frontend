
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// ...existing types and other route definitions...

// Update user profile: age, gender, major
router.post('/profile/update', authenticateToken as any, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { age, gender, major } = req.body;
    if (age === undefined || gender === undefined || major === undefined) {
      return res.status(400).json({ message: 'Missing required fields: age, gender, major' });
    }
    const { error } = await supabase
      .from('users')
      .update({ age, gender, major })
      .eq('user_id', userId);
    if (error) {
      return res.status(500).json({ message: error.message || 'Unknown error' });
    }
    res.json({ message: 'Profile updated successfully', age, gender, major });
  } catch (err: any) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: err?.message || 'Internal server error' });
  }
});

// Types for matching data
interface UserProfile {
  user_id: number;
  first_name: string;
  last_name: string;
  gender?: string;
  age?: number;
  major?: string;
}

interface HousingPreferences {
  housing_id: number;
  user_id: number;
  budget_min?: number;
  budget_max?: number;
  move_in_date?: string;
  move_out_date?: string;
  lease_length?: string[];
  max_distance?: string;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

interface LifestylePreferences {
  lifestyle_id: number;
  user_id: number;
  cleanliness_level: number;
  noise_tolerance: string;
  sleep_schedule: string;
  cooking_habits: string;
  diet: string;
  pets: string;
  sharing_items: string;
  chores_preference?: string;
  guests_frequency?: string;
  work_from_home_days?: number;
  comfortable_with_pets?: boolean;
  pet_allergies?: string[];
  smoking_policy?: string[];
}

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

class RoommateMatcher {
  private weights = {
    housing: 0.3,      // Budget and timeline compatibility
    lifestyle: 0.4,    // Living habits compatibility
    profile: 0.3       // Basic profile compatibility
  };

  // Calculate housing compatibility score (0-100)
  private calculateHousingCompatibility(
    user1Housing: HousingPreferences | null,
    user2Housing: HousingPreferences | null
  ): number {
    if (!user1Housing || !user2Housing) {
      return 0; // No score if missing data (should not happen with our filtering)
    }

    let score = 0;
    let factors = 0;

    // Budget compatibility
    if (user1Housing.budget_min && user1Housing.budget_max && 
        user2Housing.budget_min && user2Housing.budget_max) {
      
      const overlapMin = Math.max(user1Housing.budget_min, user2Housing.budget_min);
      const overlapMax = Math.min(user1Housing.budget_max, user2Housing.budget_max);
      
      if (overlapMin <= overlapMax) {
        const user1Range = user1Housing.budget_max - user1Housing.budget_min;
        const user2Range = user2Housing.budget_max - user2Housing.budget_min;
        const overlapRange = overlapMax - overlapMin;
        
        if (user1Range > 0 && user2Range > 0) {
          const overlapScore = (overlapRange / Math.min(user1Range, user2Range)) * 100;
          score += Math.min(overlapScore, 100);
        } else {
          score += 100; // Perfect match if ranges are identical
        }
      } else {
        score += 0; // No overlap
      }
      factors += 1;
    }

    // Timeline compatibility
    if (user1Housing.move_in_date && user1Housing.move_out_date &&
        user2Housing.move_in_date && user2Housing.move_out_date) {
      
      const user1Start = new Date(user1Housing.move_in_date);
      const user1End = new Date(user1Housing.move_out_date);
      const user2Start = new Date(user2Housing.move_in_date);
      const user2End = new Date(user2Housing.move_out_date);
      
      // Check if move-in/out dates overlap
      if (user1Start <= user2End && user2Start <= user1End) {
        const overlapStart = new Date(Math.max(user1Start.getTime(), user2Start.getTime()));
        const overlapEnd = new Date(Math.min(user1End.getTime(), user2End.getTime()));
        const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
        
        const user1Duration = Math.ceil((user1End.getTime() - user1Start.getTime()) / (1000 * 60 * 60 * 24));
        const user2Duration = Math.ceil((user2End.getTime() - user2Start.getTime()) / (1000 * 60 * 60 * 24));
        const avgDuration = (user1Duration + user2Duration) / 2;
        
        if (avgDuration > 0) {
          const timelineScore = (overlapDays / avgDuration) * 100;
          score += Math.min(timelineScore, 100);
        } else {
          score += 100;
        }
      } else {
        score += 0; // No timeline overlap
      }
      factors += 1;
    }

    return factors > 0 ? score / factors : 0;
  }

  // Calculate lifestyle compatibility score (0-100)
  private calculateLifestyleCompatibility(
    user1Lifestyle: LifestylePreferences | null,
    user2Lifestyle: LifestylePreferences | null
  ): number {
    if (!user1Lifestyle || !user2Lifestyle) {
      return 0; // No score if missing data (should not happen with our filtering)
    }

    let score = 0;
    let factors = 0;

    // Cleanliness compatibility
    const cleanlinessDiff = Math.abs(user1Lifestyle.cleanliness_level - user2Lifestyle.cleanliness_level);
    const cleanlinessScore = Math.max(0, 100 - (cleanlinessDiff * 25)); // 25 points per level difference
    score += cleanlinessScore;
    factors += 1;

    // Noise tolerance compatibility
    const noiseCompatibility = this.getNoiseCompatibility(user1Lifestyle.noise_tolerance, user2Lifestyle.noise_tolerance);
    score += noiseCompatibility;
    factors += 1;

    // Sleep schedule compatibility
    const sleepCompatibility = this.getSleepCompatibility(user1Lifestyle.sleep_schedule, user2Lifestyle.sleep_schedule);
    score += sleepCompatibility;
    factors += 1;

    // Pets compatibility
    const petsCompatibility = this.getPetsCompatibility(user1Lifestyle.pets, user2Lifestyle.pets);
    score += petsCompatibility;
    factors += 1;

    // Sharing items compatibility
    const sharingCompatibility = this.getSharingCompatibility(user1Lifestyle.sharing_items, user2Lifestyle.sharing_items);
    score += sharingCompatibility;
    factors += 1;

    // Diet compatibility
    const dietCompatibility = this.getDietCompatibility(user1Lifestyle.diet, user2Lifestyle.diet);
    score += dietCompatibility;
    factors += 1;

    return factors > 0 ? score / factors : 50;
  }

  // Calculate profile compatibility score (0-100)
  private calculateProfileCompatibility(
    user1Profile: UserProfile,
    user2Profile: UserProfile
  ): number {
    let score = 0;
    let factors = 0;

    // Age compatibility (prefer similar ages)
    if (user1Profile.age && user2Profile.age) {
      const ageDiff = Math.abs(user1Profile.age - user2Profile.age);
      const ageScore = Math.max(0, 100 - (ageDiff * 5)); // 5 points per year difference
      score += ageScore;
      factors += 1;
    }

    // Major compatibility (bonus for same major)
    if (user1Profile.major && user2Profile.major) {
      const majorScore = user1Profile.major.toLowerCase() === user2Profile.major.toLowerCase() ? 100 : 50;
      score += majorScore;
      factors += 1;
    }

    // Gender compatibility (neutral for now, can be customized based on preferences)
    score += 100; 
    factors += 1;

    const finalScore = factors > 0 ? score / factors : 50;
    return finalScore;
  }

  // Helper methods for specific compatibility calculations
  private getNoiseCompatibility(noise1: string, noise2: string): number {
    const noiseScale = { 'quiet': 0, 'moderate': 50, 'loud': 100 };
    const noise1Value = noiseScale[noise1 as keyof typeof noiseScale] ?? 50;
    const noise2Value = noiseScale[noise2 as keyof typeof noiseScale] ?? 50;
    const noiseDiff = Math.abs(noise1Value - noise2Value);
    return Math.max(0, 100 - noiseDiff);
  }

  private getSleepCompatibility(sleep1: string, sleep2: string): number {
    const sleepScale = { 'early': 0, 'flexible': 50, 'late': 100 };
    const sleep1Value = sleepScale[sleep1 as keyof typeof sleepScale] ?? 50;
    const sleep2Value = sleepScale[sleep2 as keyof typeof sleepScale] ?? 50;
    const sleepDiff = Math.abs(sleep1Value - sleep2Value);
    return Math.max(0, 100 - sleepDiff);
  }

  private getPetsCompatibility(pets1: string, pets2: string): number {
    if (pets1 === pets2) {
      return 100;
    }
    if ((pets1 === 'no_pets' && pets2 !== 'no_pets') || (pets2 === 'no_pets' && pets1 !== 'no_pets')) {
      return 0; // One wants pets, other doesn't
    }
    if ((pets1 === 'allergic' && pets2 !== 'no_pets') || (pets2 === 'allergic' && pets1 !== 'no_pets')) {
      return 0; // One is allergic, other has/wants pets
    }
    return 75; // Both want pets, but different types
  }

  private getSharingCompatibility(sharing1: string, sharing2: string): number {
    const sharingScale = { 'no': 0, 'sometimes': 50, 'yes': 100 };
    const sharing1Value = sharingScale[sharing1 as keyof typeof sharingScale] ?? 50;
    const sharing2Value = sharingScale[sharing2 as keyof typeof sharingScale] ?? 50;
    const sharingDiff = Math.abs(sharing1Value - sharing2Value);
    return Math.max(0, 100 - sharingDiff);
  }

  private getDietCompatibility(diet1: string, diet2: string): number {
    if (diet1 === diet2) {
      return 100;
    }
    if ((diet1 === 'vegan' && diet2 !== 'vegan') || (diet2 === 'vegan' && diet1 !== 'vegan')) {
      return 25; // Vegan compatibility is important
    }
    if ((diet1 === 'vegetarian' && diet2 === 'none') || (diet2 === 'vegetarian' && diet1 === 'none')) {
      return 75; // Vegetarian and none can coexist
    }
    return 50; // Neutral for other combinations
  }

  // Main matching function
  async findMatches(userId: number, limit: number = 10): Promise<MatchResult[]> {
    try {
      // Get the requesting user's data first
      const { data: requestingUser, error: userError } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, gender, age, major')
        .eq('user_id', userId)
        .single();

      console.log('[MATCHING] userId:', userId);
      if (userError || !requestingUser) {
        console.log('[MATCHING] Failed to fetch requesting user:', userError, requestingUser);
        throw new Error(`Failed to fetch requesting user: ${userError?.message}`);
      }

      // Get the requesting user's preferences
      const { data: requestingUserHousing, error: housingError } = await supabase
        .from('housing_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      console.log('[MATCHING] Housing query result:', requestingUserHousing, housingError);
      if (housingError || !requestingUserHousing) {
        throw new Error('You must complete the roommate questionnaire before you can find or generate matches.');
      }

      const { data: requestingUserLifestyle, error: lifestyleError } = await supabase
        .from('lifestyle_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      console.log('[MATCHING] Lifestyle query result:', requestingUserLifestyle, lifestyleError);
      if (lifestyleError || !requestingUserLifestyle) {
        throw new Error('You must complete the roommate questionnaire before you can find or generate matches.');
      }

      // Get all users who have BOTH housing and lifestyle preferences (completed questionnaire)
      const { data: usersWithPrefs, error: usersError } = await supabase
        .from('users')
        .select(`
          user_id, first_name, last_name, gender, age, major,
          housing_preferences!inner(*),
          lifestyle_preferences!inner(*)
        `)
        .neq('user_id', userId); // Exclude the requesting user

      if (usersError) {
        throw new Error(`Failed to fetch users with preferences: ${usersError.message}`);
      }

      if (!usersWithPrefs || usersWithPrefs.length === 0) {
        return []; // No users with completed questionnaires
      }

      const matches: MatchResult[] = [];

      // Calculate compatibility with users who have completed questionnaires
      for (const userData of usersWithPrefs) {
        const user = {
          user_id: userData.user_id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          gender: userData.gender,
          age: userData.age,
          major: userData.major
        };

        const userHousing = Array.isArray(userData.housing_preferences) 
          ? userData.housing_preferences[0] 
          : userData.housing_preferences;
        const userLifestyle = Array.isArray(userData.lifestyle_preferences) 
          ? userData.lifestyle_preferences[0] 
          : userData.lifestyle_preferences;

        // Calculate individual compatibility scores
        const housingScore = this.calculateHousingCompatibility(requestingUserHousing, userHousing);
        const lifestyleScore = this.calculateLifestyleCompatibility(requestingUserLifestyle, userLifestyle);
        const profileScore = this.calculateProfileCompatibility(requestingUser, user);

        // Debug logging (remove in production)
        // console.log(`Matching user ${user.user_id}:`, {
        //   housingScore,
        //   lifestyleScore,
        //   profileScore,
        //   userHousing: userHousing ? 'present' : 'missing',
        //   userLifestyle: userLifestyle ? 'present' : 'missing'
        // });

        // Calculate weighted overall score
        const overallScore = (
          housingScore * this.weights.housing +
          lifestyleScore * this.weights.lifestyle +
          profileScore * this.weights.profile
        );

        const matchResult: MatchResult = {
          user_id: user.user_id,
          score: Math.round(overallScore * 100) / 100,
          compatibility_details: {
            housing_score: Math.round(housingScore * 100) / 100,
            lifestyle_score: Math.round(lifestyleScore * 100) / 100,
            profile_score: Math.round(profileScore * 100) / 100,
            user_info: {
              first_name: user.first_name || '',
              last_name: user.last_name || '',
              age: user.age,
              gender: user.gender,
              major: user.major
            }
          }
        };

        matches.push(matchResult);
      }

      // Sort by score (highest first) and return top matches
      matches.sort((a, b) => b.score - a.score);
      return matches.slice(0, limit);

    } catch (error) {
      console.error('Error in findMatches:', error);
      throw error;
    }
  }

  // Save matches to database
  async saveMatches(userId: number, matches: MatchResult[]): Promise<void> {
    try {
      // Delete existing matches for this user
      await supabase
        .from('matches')
        .delete()
        .eq('user1_id', userId);

      // Insert new matches
      const matchRecords = matches.map(match => ({
        user1_id: userId,
        user2_id: match.user_id,
        compatibility_score: match.score
      }));

      if (matchRecords.length > 0) {
        const { error } = await supabase
          .from('matches')
          .insert(matchRecords);

        if (error) {
          throw new Error(`Failed to save matches: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Error saving matches:', error);
      throw error;
    }
  }
}

// Initialize matcher
const matcher = new RoommateMatcher();

// Get matches for the authenticated user
router.get('/matches', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const saveToDb = req.query.save === 'true';

    const matches = await matcher.findMatches(userId, limit);
    if (saveToDb) {
      await matcher.saveMatches(userId, matches);
    }
    res.json({
      matches,
      total: matches.length,
      user_id: userId
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    next(error);
  }
});

// Get saved matches from database
router.get('/matches/saved', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        match_id,
        user2_id,
        compatibility_score,
        created_at,
        last_updated,
        user2:users!matches_user2_id_fkey(
          user_id,
          first_name,
          last_name,
          gender,
          age,
          major
        )
      `)
      .eq('user1_id', userId)
      .order('compatibility_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch saved matches: ${error.message}`);
    }

    const formattedMatches = matches?.map(match => {
      const user2 = Array.isArray(match.user2) ? match.user2[0] : match.user2;
      return {
        match_id: match.match_id,
        user_id: match.user2_id,
        score: match.compatibility_score,
        created_at: match.created_at,
        last_updated: match.last_updated,
        user_info: {
          first_name: user2?.first_name || '',
          last_name: user2?.last_name || '',
          age: user2?.age,
          gender: user2?.gender,
          major: user2?.major
        }
      };
    }) || [];

    res.json({
      matches: formattedMatches,
      total: formattedMatches.length,
      user_id: userId
    });
  } catch (error) {
    console.error('Error fetching saved matches:', error);
    next(error);
  }
});

// Generate and save new matches
router.post('/matches/generate', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const limit = parseInt(req.body.limit) || 10;
      let matches: MatchResult[] = [];
    try {
        matches = await matcher.findMatches(userId, limit);
      if (!matches) {
        return res.status(500).json({ message: 'No matches found' });
      }
      await matcher.saveMatches(userId, matches);
      res.json({
        message: 'Matches generated and saved successfully',
        matches,
        total: matches.length,
        user_id: userId
      });
    } catch (err: any) {
      console.error('Error generating matches:', err);
      return res.status(500).json({ message: err.message || 'Internal server error' });
    }
  } catch (error) {
    console.error('Error generating matches:', error);
    next(error);
  }
});

// Get match statistics
router.get('/matches/stats', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get total users count
    const { count: totalUsers, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      throw new Error(`Failed to fetch users count: ${usersError.message}`);
    }

    // Get user's match count
    const { count: matchCount, error: matchesError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('user1_id', userId);

    if (matchesError) {
      throw new Error(`Failed to fetch matches count: ${matchesError.message}`);
    }

    // Get average compatibility score
    const { data: avgScoreData, error: avgError } = await supabase
      .from('matches')
      .select('compatibility_score')
      .eq('user1_id', userId);

    if (avgError) {
      throw new Error(`Failed to fetch average score: ${avgError.message}`);
    }

    const avgScore = avgScoreData && avgScoreData.length > 0 
      ? avgScoreData.reduce((sum, match) => sum + match.compatibility_score, 0) / avgScoreData.length
      : 0;

    res.json({
      total_users: totalUsers || 0,
      user_matches: matchCount || 0,
      average_compatibility: Math.round(avgScore * 100) / 100,
      user_id: userId
    });
  } catch (error) {
    console.error('Error fetching match statistics:', error);
    next(error);
  }
});

export { router as roommateRoutes };
