import { supabase } from '../lib/supabase';

export interface UserPriorityWeights {
    budget: number;
    location: number;
    lifestyle: number;
    pets: number;
    timing: number;
    work: number;
}

export interface PriorityBasedMatch {
    user: any;
    housing: any;
    lifestyle: any;
    compatibilityScore: number;
    priorityScore: number;
    scoreBreakdown: {
        budget: number;
        location: number;
        lifestyle: number;
        pets: number;
        timing: number;
        work: number;
    };
    dealBreakers: string[];
    strengths: string[];
}

export class PriorityBasedMatchingService {

    async findMatches(userId: string, limit: number = 20): Promise<PriorityBasedMatch[]> {
        try {
            // Get current user's priorities and preferences
            const currentUser = await this.getCurrentUserData(userId);
            if (!currentUser) {
                throw new Error('User profile not found');
            }

            // Get all other users with complete profiles
            const allUsers = await this.getAllUserProfiles(userId);

            // Calculate priority-based matches
            const matches = allUsers
                .map(user => this.calculatePriorityMatch(currentUser, user))
                .filter(match => match.priorityScore > 30) // Filter out very low matches
                .sort((a, b) => b.priorityScore - a.priorityScore)
                .slice(0, limit);

            return matches;
        } catch (error) {
            console.error('Error finding priority-based matches:', error);
            throw error;
        }
    }

    private async getCurrentUserData(userId: string) {
        try {
            // Get user basic info
            const { data: user } = await supabase
                .from('users')
                .select('user_id, email, first_name, last_name, gender, age, major')
                .eq('user_id', userId)
                .single();

            // Get housing preferences
            const { data: housing } = await supabase
                .from('housing_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            // Get lifestyle preferences
            const { data: lifestyle } = await supabase
                .from('lifestyle_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            // Get user's priority weights (if they exist)
            const { data: priorities } = await supabase
                .from('user_priority_weights')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!user || !housing || !lifestyle) {
                return null;
            }

            return {
                user,
                housing,
                lifestyle,
                priorities: priorities || this.getDefaultPriorities()
            };
        } catch (error) {
            console.error('Error getting current user data:', error);
            return null;
        }
    }

    private async getAllUserProfiles(excludeUserId: string) {
        try {
            const { data: users } = await supabase
                .from('users')
                .select(`
          user_id,
          email,
          first_name,
          last_name,
          gender,
          age,
          major,
          housing_preferences!inner(*),
          lifestyle_preferences!inner(*)
        `)
                .neq('user_id', excludeUserId)
                .eq('is_admin', false);

            return users || [];
        } catch (error) {
            console.error('Error getting all user profiles:', error);
            return [];
        }
    }

    private getDefaultPriorities(): UserPriorityWeights {
        // Equal distribution when no priorities are set
        return {
            budget: 16.67,    // Equal weight (100% / 6 factors)
            location: 16.67,  // Equal weight
            lifestyle: 16.67, // Equal weight
            pets: 16.67,      // Equal weight
            timing: 16.66,    // Slightly lower to make total exactly 100%
            work: 16.66       // Slightly lower to make total exactly 100%
        };
    }

    private calculatePriorityMatch(currentUser: any, potentialRoommate: any): PriorityBasedMatch {
        const weights = currentUser.priorities;
        const dealBreakers: string[] = [];
        const strengths: string[] = [];

        // Calculate individual scores
        const budgetScore = this.calculateBudgetScore(currentUser.housing, potentialRoommate.housing_preferences);
        const locationScore = this.calculateLocationScore(currentUser.housing, potentialRoommate.housing_preferences);
        const lifestyleScore = this.calculateLifestyleScore(currentUser.lifestyle, potentialRoommate.lifestyle_preferences);
        const petsScore = this.calculatePetsScore(currentUser.lifestyle, potentialRoommate.lifestyle_preferences, weights.pets, dealBreakers);
        const timingScore = this.calculateTimingScore(currentUser.housing, potentialRoommate.housing_preferences);
        const workScore = this.calculateWorkScore(currentUser.lifestyle, potentialRoommate.lifestyle_preferences);

        // Calculate weighted total score
        const weightedScore =
            (budgetScore * weights.budget / 100) +
            (locationScore * weights.location / 100) +
            (lifestyleScore * weights.lifestyle / 100) +
            (petsScore * weights.pets / 100) +
            (timingScore * weights.timing / 100) +
            (workScore * weights.work / 100);

        // Identify strengths
        if (budgetScore >= 80) strengths.push('Budget compatibility');
        if (locationScore >= 80) strengths.push('Location preferences');
        if (lifestyleScore >= 80) strengths.push('Lifestyle match');
        if (petsScore >= 80) strengths.push('Pet compatibility');
        if (timingScore >= 80) strengths.push('Timing alignment');
        if (workScore >= 80) strengths.push('Work style match');

        return {
            user: potentialRoommate,
            housing: potentialRoommate.housing_preferences,
            lifestyle: potentialRoommate.lifestyle_preferences,
            compatibilityScore: Math.round((budgetScore + locationScore + lifestyleScore + petsScore + timingScore + workScore) / 6),
            priorityScore: Math.round(weightedScore),
            scoreBreakdown: {
                budget: Math.round(budgetScore * weights.budget / 100),
                location: Math.round(locationScore * weights.location / 100),
                lifestyle: Math.round(lifestyleScore * weights.lifestyle / 100),
                pets: Math.round(petsScore * weights.pets / 100),
                timing: Math.round(timingScore * weights.timing / 100),
                work: Math.round(workScore * weights.work / 100)
            },
            dealBreakers,
            strengths
        };
    }

    private calculateBudgetScore(user1Housing: any, user2Housing: any): number {
        if (!user1Housing || !user2Housing) return 50;

        const [min1, max1] = [user1Housing.budget_min || 0, user1Housing.budget_max || 0];
        const [min2, max2] = [user2Housing.budget_min || 0, user2Housing.budget_max || 0];

        const overlapMin = Math.max(min1, min2);
        const overlapMax = Math.min(max1, max2);

        if (overlapMin > overlapMax) return 0; // No overlap

        const overlapSize = overlapMax - overlapMin;
        const totalRange = Math.max(max1, max2) - Math.min(min1, min2);

        return Math.min(100, (overlapSize / totalRange) * 100);
    }

    private calculateLocationScore(user1Housing: any, user2Housing: any): number {
        if (!user1Housing || !user2Housing) return 50;

        const distance1 = user1Housing.max_distance || '15 minutes';
        const distance2 = user2Housing.max_distance || '15 minutes';

        if (distance1 === distance2) return 100;

        const parseDistance = (dist: string) => {
            if (dist.includes('5 minutes')) return 1;
            if (dist.includes('10 minutes')) return 2;
            if (dist.includes('15 minutes')) return 3;
            if (dist.includes('30 minutes')) return 4;
            return 3;
        };

        const diff = Math.abs(parseDistance(distance1) - parseDistance(distance2));
        return Math.max(0, 100 - (diff * 25));
    }

    private calculateLifestyleScore(user1Lifestyle: any, user2Lifestyle: any): number {
        if (!user1Lifestyle || !user2Lifestyle) return 50;

        let score = 0;
        let factors = 0;

        // Cleanliness compatibility
        if (user1Lifestyle.cleanliness_level && user2Lifestyle.cleanliness_level) {
            const diff = Math.abs(user1Lifestyle.cleanliness_level - user2Lifestyle.cleanliness_level);
            score += Math.max(0, 100 - (diff * 20));
            factors++;
        }

        // Sleep schedule compatibility
        if (user1Lifestyle.sleep_schedule && user2Lifestyle.sleep_schedule) {
            if (user1Lifestyle.sleep_schedule === user2Lifestyle.sleep_schedule) {
                score += 100;
            } else if (user1Lifestyle.sleep_schedule === 'flexible' || user2Lifestyle.sleep_schedule === 'flexible') {
                score += 80;
            } else {
                score += 20;
            }
            factors++;
        }

        // Noise tolerance compatibility
        if (user1Lifestyle.noise_tolerance && user2Lifestyle.noise_tolerance) {
            if (user1Lifestyle.noise_tolerance === user2Lifestyle.noise_tolerance) {
                score += 100;
            } else if (user1Lifestyle.noise_tolerance === 'moderate' || user2Lifestyle.noise_tolerance === 'moderate') {
                score += 70;
            } else {
                score += 30;
            }
            factors++;
        }

        return factors > 0 ? Math.round(score / factors) : 50;
    }

    private calculatePetsScore(user1Lifestyle: any, user2Lifestyle: any, petsWeight: number, dealBreakers: string[]): number {
        if (!user1Lifestyle || !user2Lifestyle) return 50;

        const hasPets1 = user1Lifestyle.pets === 'has_pets';
        const hasPets2 = user2Lifestyle.pets === 'has_pets';
        const comfortable1 = user1Lifestyle.comfortable_with_pets;
        const comfortable2 = user2Lifestyle.comfortable_with_pets;

        // DEAL BREAKER: High priority + incompatible pets
        if (petsWeight >= 15) { // High priority threshold
            if ((hasPets1 && !comfortable2) || (hasPets2 && !comfortable1)) {
                dealBreakers.push('Pet incompatibility (high priority)');
                return 0; // Complete deal breaker for high priority
            }
        }

        // Standard pet compatibility logic
        if (hasPets1 && hasPets2) {
            const hasAllergies = (user1Lifestyle.pet_allergies?.length > 0) || (user2Lifestyle.pet_allergies?.length > 0);
            return hasAllergies ? 30 : 90;
        }

        if ((hasPets1 && comfortable2) || (hasPets2 && comfortable1)) {
            return 80;
        }

        if ((hasPets1 && !comfortable2) || (hasPets2 && !comfortable1)) {
            return petsWeight >= 10 ? 5 : 10; // Lower score for higher priority
        }

        return 100; // Neither has pets
    }

    private calculateTimingScore(user1Housing: any, user2Housing: any): number {
        if (!user1Housing || !user2Housing) return 50;

        const date1 = user1Housing.move_in_date;
        const date2 = user2Housing.move_in_date;

        if (!date1 || !date2) return 50;

        const dateObj1 = new Date(date1);
        const dateObj2 = new Date(date2);

        const diffMonths = Math.abs((dateObj1.getFullYear() - dateObj2.getFullYear()) * 12 +
            (dateObj1.getMonth() - dateObj2.getMonth()));

        if (diffMonths === 0) return 100;
        if (diffMonths <= 1) return 80;
        if (diffMonths <= 3) return 60;
        if (diffMonths <= 6) return 40;
        return 20;
    }

    private calculateWorkScore(user1Lifestyle: any, user2Lifestyle: any): number {
        if (!user1Lifestyle || !user2Lifestyle) return 50;

        const wfh1 = user1Lifestyle.work_from_home_days || 0;
        const wfh2 = user2Lifestyle.work_from_home_days || 0;

        const diff = Math.abs(wfh1 - wfh2);
        return Math.max(0, 100 - (diff * 15));
    }
}

// Export singleton instance
export const priorityBasedMatchingService = new PriorityBasedMatchingService();
