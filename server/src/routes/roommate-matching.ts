import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { RoommateMatchingService, MatchingWeights } from '../services/matching';

const router = Router();

interface HousingPriorities {
    budget: number;
    commute: number;
    safety: number;
    roommates: number;
}

interface UserProfile {
    user_id: number;
    email: string;
    first_name: string;
    last_name: string;
    gender?: string;
    age?: number;
    major?: string;
}

interface HousingPreferences {
    budget_min: number;
    budget_max: number;
    move_in_date: string;
    max_distance: string;
    quiet_hours_start: string;
    quiet_hours_end: string;
}

interface LifestylePreferences {
    cleanliness_level: number;
    noise_tolerance: string;
    sleep_schedule: string;
    cooking_habits: string;
    diet: string;
    pets: string;
    sharing_items: string;
    chores_preference: string;
    guests_frequency: string;
    work_from_home_days: number;
    comfortable_with_pets: boolean;
    pet_allergies: string[];
    smoking_policy: string[];
}

interface RoommateMatch {
    user: UserProfile;
    housing: HousingPreferences | null;
    lifestyle: LifestylePreferences | null;
    priorities: HousingPriorities | null;
    compatibilityScore: number;
    priorityScore: number;
    scoreBreakdown: {
        budget: number;
        commute: number;
        safety: number;
        roommates: number;
    };
}

// Calculate compatibility score based on lifestyle preferences
function calculateLifestyleCompatibility(
    user1: LifestylePreferences | null,
    user2: LifestylePreferences | null
): number {
    if (!user1 || !user2) return 50; // Default score if missing data

    let score = 0;
    let factors = 0;

    // Cleanliness level compatibility (1-5 scale)
    if (user1.cleanliness_level && user2.cleanliness_level) {
        const diff = Math.abs(user1.cleanliness_level - user2.cleanliness_level);
        score += Math.max(0, 100 - (diff * 20)); // 20 points per level difference
        factors++;
    }

    // Sleep schedule compatibility
    if (user1.sleep_schedule && user2.sleep_schedule) {
        if (user1.sleep_schedule === user2.sleep_schedule) {
            score += 100;
        } else if (
            (user1.sleep_schedule === 'flexible' || user2.sleep_schedule === 'flexible') ||
            (user1.sleep_schedule === 'early' && user2.sleep_schedule === 'late') ||
            (user1.sleep_schedule === 'late' && user2.sleep_schedule === 'early')
        ) {
            score += 60; // Partial compatibility
        } else {
            score += 20; // Low compatibility
        }
        factors++;
    }

    // Noise tolerance compatibility
    if (user1.noise_tolerance && user2.noise_tolerance) {
        if (user1.noise_tolerance === user2.noise_tolerance) {
            score += 100;
        } else if (
            (user1.noise_tolerance === 'moderate' || user2.noise_tolerance === 'moderate')
        ) {
            score += 70; // Moderate can work with others
        } else {
            score += 30; // Quiet vs loud is challenging
        }
        factors++;
    }

    // Pet compatibility
    if (user1.pets && user2.pets) {
        if (user1.pets === user2.pets) {
            score += 100;
        } else if (user1.comfortable_with_pets && user2.comfortable_with_pets) {
            score += 80; // Both comfortable with pets
        } else if (!user1.comfortable_with_pets && !user2.comfortable_with_pets) {
            score += 100; // Both don't want pets
        } else {
            score += 20; // Mismatch
        }
        factors++;
    }

    // Work from home compatibility
    if (user1.work_from_home_days !== undefined && user2.work_from_home_days !== undefined) {
        const diff = Math.abs(user1.work_from_home_days - user2.work_from_home_days);
        score += Math.max(0, 100 - (diff * 10)); // 10 points per day difference
        factors++;
    }

    return factors > 0 ? Math.round(score / factors) : 50;
}

// Calculate priority-based score
function calculatePriorityScore(
    userPriorities: HousingPriorities,
    potentialRoommate: {
        housing: HousingPreferences | null;
        lifestyle: LifestylePreferences | null;
    }
): { score: number; breakdown: any } {
    if (!userPriorities || !potentialRoommate.housing || !potentialRoommate.lifestyle) {
        return { score: 50, breakdown: { budget: 12, commute: 10, safety: 10, roommates: 8 } };
    }

    // Calculate individual scores (0-100 scale)
    const budgetScore = Math.max(0, 100 - Math.abs(potentialRoommate.housing.budget_min - 1000) / 10);
    const commuteScore = Math.max(0, 100 - (parseFloat(potentialRoommate.housing.max_distance) * 5));
    const safetyScore = potentialRoommate.lifestyle.cleanliness_level * 20; // Convert 1-5 to 20-100
    const roommateScore = calculateLifestyleCompatibility(potentialRoommate.lifestyle, potentialRoommate.lifestyle);

    // Calculate weighted score
    const weightedScore =
        (budgetScore * userPriorities.budget / 100) +
        (commuteScore * userPriorities.commute / 100) +
        (safetyScore * userPriorities.safety / 100) +
        (roommateScore * userPriorities.roommates / 100);

    return {
        score: Math.round(weightedScore),
        breakdown: {
            budget: Math.round(budgetScore * userPriorities.budget / 100),
            commute: Math.round(commuteScore * userPriorities.commute / 100),
            safety: Math.round(safetyScore * userPriorities.safety / 100),
            roommates: Math.round(roommateScore * userPriorities.roommates / 100)
        }
    };
}

// Get roommate matches using the new priority-based matching service
router.get('/matches', authenticateToken as any, async (req: any, res: Response, next: NextFunction) => {
    try {
        const currentUserId = req.user?.id;
        if (!currentUserId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        console.log(`Finding roommate matches for user ${currentUserId} with limit 20`);

        // Get user's custom priority weights
        const { data: userWeights, error: weightsError } = await supabase
            .from('user_priority_weights')
            .select('*')
            .eq('user_id', currentUserId)
            .single();

        let matchingWeights: MatchingWeights;

        if (weightsError || !userWeights) {
            // Use default weights if no custom weights found
            console.log('No custom weights found, using default weights');
            matchingWeights = {
                budget: 7.69,
                sleepSchedule: 7.69,
                cleanliness: 7.69,
                socialVibe: 7.69,
                moveInDate: 7.69,
                leaseLength: 7.69,
                distance: 7.69,
                quietHours: 7.69,
                chores: 7.69,
                guests: 7.69,
                workFromHome: 7.69,
                pets: 7.69,
                smoking: 7.72
            };
        } else {
            // Map user priority weights to matching weights
            console.log('Using custom weights:', userWeights);

            // Calculate the total weight to ensure it sums to 100%
            const totalWeight = userWeights.budget_weight + userWeights.location_weight +
                userWeights.lifestyle_weight + userWeights.pets_weight +
                userWeights.timing_weight + userWeights.work_weight;

            // Reserve 5% for smoking and distribute the rest proportionally
            const availableWeight = 95.0; // 100% - 5% for smoking
            const scaleFactor = availableWeight / totalWeight;

            matchingWeights = {
                budget: userWeights.budget_weight * scaleFactor,
                sleepSchedule: (userWeights.lifestyle_weight * scaleFactor) / 3, // Split lifestyle weight across 3 factors
                cleanliness: (userWeights.lifestyle_weight * scaleFactor) / 3,
                socialVibe: (userWeights.lifestyle_weight * scaleFactor) / 3,
                moveInDate: (userWeights.timing_weight * scaleFactor) / 2, // Split timing weight across 2 factors
                leaseLength: (userWeights.timing_weight * scaleFactor) / 2,
                distance: userWeights.location_weight * scaleFactor,
                quietHours: (userWeights.work_weight * scaleFactor) / 4, // Split work weight across 4 factors
                chores: (userWeights.work_weight * scaleFactor) / 4,
                guests: (userWeights.work_weight * scaleFactor) / 4,
                workFromHome: (userWeights.work_weight * scaleFactor) / 4,
                pets: userWeights.pets_weight * scaleFactor,
                smoking: 5.0 // Fixed 5% weight for smoking
            };
        }

        // Debug: Log the final weights
        const totalWeight = Object.values(matchingWeights).reduce((sum, weight) => sum + weight, 0);
        console.log('Final matching weights:', matchingWeights);
        console.log('Total weight:', totalWeight);

        // Create matching service with custom weights
        const matchingService = new RoommateMatchingService(matchingWeights);

        // Find matches using the service
        const matches = await matchingService.findMatches(currentUserId, 20);

        // Transform matches to include additional info for frontend
        const transformedMatches = matches.map(match => {
            const nameParts = (match.name || 'Unknown User').split(' ');
            return {
                user: {
                    user_id: parseInt(match.id) || 0,
                    email: match.email || '',
                    first_name: nameParts[0] || 'Unknown',
                    last_name: nameParts.slice(1).join(' ') || '',
                    gender: match.gender || 'Not specified',
                    age: match.age || 0,
                    major: match.major || 'Not specified'
                },
                housing: {
                    budget_min: match.preferences.budgetRange[0],
                    budget_max: match.preferences.budgetRange[1],
                    move_in_date: match.preferences.moveInDate,
                    max_distance: match.preferences.maxDistance,
                    quiet_hours_start: match.preferences.quietHoursStart,
                    quiet_hours_end: match.preferences.quietHoursEnd
                },
                lifestyle: {
                    cleanliness_level: match.preferences.cleanlinessLevel,
                    noise_tolerance: match.preferences.socialVibe,
                    sleep_schedule: match.preferences.sleepSchedule,
                    pets: match.preferences.hasPets.join(','),
                    comfortable_with_pets: match.preferences.comfortableWithPets,
                    work_from_home_days: match.preferences.workFromHomeDays
                },
                compatibilityScore: match.compatibilityScore,
                priorityScore: match.compatibilityScore, // Same as compatibility score in new system
                scoreBreakdown: {
                    budget: Math.round(match.compatibilityScore * (matchingWeights.budget / 100)),
                    location: Math.round(match.compatibilityScore * (matchingWeights.distance / 100)),
                    lifestyle: Math.round(match.compatibilityScore * ((matchingWeights.sleepSchedule + matchingWeights.cleanliness + matchingWeights.socialVibe) / 100)),
                    pets: Math.round(match.compatibilityScore * (matchingWeights.pets / 100)),
                    timing: Math.round(match.compatibilityScore * ((matchingWeights.moveInDate + matchingWeights.leaseLength) / 100)),
                    work: Math.round(match.compatibilityScore * ((matchingWeights.workFromHome + matchingWeights.quietHours + matchingWeights.chores + matchingWeights.guests) / 100))
                }
            };
        });

        console.log(`Found ${transformedMatches.length} matches for user ${currentUserId}`);
        res.json(transformedMatches);
    } catch (error) {
        console.error('Roommate matching error:', error);
        next(error);
    }
});

export { router as roommateMatchingRoutes };

