import { supabase } from '../lib/supabase';

export interface RoommateProfile {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: string;
  major: string;
  compatibilityScore: number;
  preferences: {
    budgetRange: [number, number];
    sleepSchedule: string;
    socialVibe: string;
    cleanlinessLevel: number;
    moveInDate: string;
    leaseLength: string[];
    maxDistance: string;
    quietHoursStart: string;
    quietHoursEnd: string;
    choresPreference: string;
    guestsFrequency: string;
    workFromHomeDays: number;
    hasPets: string[];
    comfortableWithPets: boolean;
    petAllergies: string[];
    smokingPolicy: string[];
  };
}

export interface MatchingWeights {
  budget: number;
  sleepSchedule: number;
  cleanliness: number;
  socialVibe: number;
  moveInDate: number;
  leaseLength: number;
  distance: number;
  quietHours: number;
  chores: number;
  guests: number;
  workFromHome: number;
  pets: number;
  smoking: number;
}

// Default matching weights - easily configurable
export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  budget: 20,           // 20% - Very important for compatibility
  sleepSchedule: 15,    // 15% - Important for daily routine
  cleanliness: 15,      // 15% - Important for household harmony
  socialVibe: 12,       // 12% - Important for social compatibility
  moveInDate: 8,        // 8% - Important for timing
  leaseLength: 8,       // 8% - Important for commitment alignment
  distance: 5,          // 5% - Moderate importance
  quietHours: 5,        // 5% - Moderate importance
  chores: 4,           // 4% - Lower importance
  guests: 3,           // 3% - Lower importance
  workFromHome: 2,      // 2% - Lower importance
  pets: 2,             // 2% - Lower importance
  smoking: 1,          // 1% - Lowest importance
};

export class RoommateMatchingService {
  private weights: MatchingWeights;

  constructor(weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS) {
    this.weights = weights;
    this.validateWeights();
  }

  private validateWeights(): void {
    const total = Object.values(this.weights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(`Matching weights must sum to 100%, got ${total}%`);
    }
  }

  updateWeights(newWeights: Partial<MatchingWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
    this.validateWeights();
  }

  getWeights(): MatchingWeights {
    return { ...this.weights };
  }

  async findMatches(userId: string, limit: number = 20): Promise<RoommateProfile[]> {
    try {
      // Get current user's preferences
      const currentUser = await this.getUserProfile(userId);
      if (!currentUser) {
        throw new Error('User profile not found');
      }

      // Get all other users with complete profiles
      const allUsers = await this.getAllUserProfiles(userId);
      
      // Calculate compatibility scores
      const matches = allUsers
        .map(user => ({
          ...user,
          compatibilityScore: this.calculateCompatibilityScore(currentUser, user)
        }))
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, limit);

      return matches;
    } catch (error) {
      console.error('Error finding matches:', error);
      throw error;
    }
  }

  private async getUserProfile(userId: string): Promise<RoommateProfile | null> {
    try {
      // Get user basic info
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('user_id, email, first_name, last_name, gender, age, major')
        .eq('user_id', userId)
        .single();

      if (userError || !user) {
        return null;
      }

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

      if (!housing || !lifestyle) {
        return null;
      }

      return this.mapToRoommateProfile(user, housing, lifestyle);
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  private async getAllUserProfiles(excludeUserId: string): Promise<RoommateProfile[]> {
    try {
      // Get all users with complete profiles (both housing and lifestyle preferences)
      const { data: users, error: usersError } = await supabase
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
        .neq('user_id', excludeUserId);

      if (usersError || !users) {
        return [];
      }

      return users.map(user => this.mapToRoommateProfile(
        user,
        user.housing_preferences,
        user.lifestyle_preferences
      ));
    } catch (error) {
      console.error('Error getting all user profiles:', error);
      return [];
    }
  }

  private mapToRoommateProfile(
    user: any,
    housing: any,
    lifestyle: any
  ): RoommateProfile {
    return {
      id: user.user_id.toString(),
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      age: user.age || 0,
      gender: user.gender || 'Not specified',
      major: user.major || 'Not specified',
      compatibilityScore: 0, // Will be calculated later
      preferences: {
        budgetRange: [housing.budget_min || 0, housing.budget_max || 0],
        sleepSchedule: this.mapSleepSchedule(lifestyle.sleep_schedule),
        socialVibe: this.mapSocialVibe(lifestyle.noise_tolerance),
        cleanlinessLevel: lifestyle.cleanliness_level || 3,
        moveInDate: housing.move_in_date || '',
        leaseLength: housing.lease_length || [],
        maxDistance: housing.max_distance || '',
        quietHoursStart: housing.quiet_hours_start || '22:00',
        quietHoursEnd: housing.quiet_hours_end || '07:00',
        choresPreference: lifestyle.chores_preference || '',
        guestsFrequency: lifestyle.guests_frequency || '',
        workFromHomeDays: lifestyle.work_from_home_days || 0,
        hasPets: this.mapPets(lifestyle.pets),
        comfortableWithPets: lifestyle.comfortable_with_pets || false,
        petAllergies: lifestyle.pet_allergies || [],
        smokingPolicy: lifestyle.smoking_policy || [],
      }
    };
  }

  private mapSleepSchedule(sleepSchedule: string): string {
    switch (sleepSchedule) {
      case 'early': return 'Early bird';
      case 'late': return 'Night owl';
      case 'flexible': return 'Flexible';
      default: return 'Flexible';
    }
  }

  private mapSocialVibe(noiseTolerance: string): string {
    switch (noiseTolerance) {
      case 'quiet': return 'Quiet – mostly keep to myself';
      case 'moderate': return 'Balanced – sometimes socialize, sometimes recharge';
      case 'loud': return 'Lively – I enjoy a busy, social household';
      default: return 'Balanced – sometimes socialize, sometimes recharge';
    }
  }

  private mapPets(pets: string): string[] {
    switch (pets) {
      case 'has_pets': return ['Yes — Dog', 'Yes — Cat']; // Simplified
      case 'no_pets': return ['No'];
      case 'allergic': return ['No'];
      default: return ['No'];
    }
  }

  private calculateCompatibilityScore(user1: RoommateProfile, user2: RoommateProfile): number {
    let totalScore = 0;

    // Budget compatibility (overlap percentage)
    totalScore += this.calculateBudgetScore(user1.preferences.budgetRange, user2.preferences.budgetRange) * (this.weights.budget / 100);

    // Sleep schedule compatibility
    totalScore += this.calculateSleepScheduleScore(user1.preferences.sleepSchedule, user2.preferences.sleepSchedule) * (this.weights.sleepSchedule / 100);

    // Cleanliness compatibility
    totalScore += this.calculateCleanlinessScore(user1.preferences.cleanlinessLevel, user2.preferences.cleanlinessLevel) * (this.weights.cleanliness / 100);

    // Social vibe compatibility
    totalScore += this.calculateSocialVibeScore(user1.preferences.socialVibe, user2.preferences.socialVibe) * (this.weights.socialVibe / 100);

    // Move-in date compatibility
    totalScore += this.calculateMoveInDateScore(user1.preferences.moveInDate, user2.preferences.moveInDate) * (this.weights.moveInDate / 100);

    // Lease length compatibility
    totalScore += this.calculateLeaseLengthScore(user1.preferences.leaseLength, user2.preferences.leaseLength) * (this.weights.leaseLength / 100);

    // Distance compatibility
    totalScore += this.calculateDistanceScore(user1.preferences.maxDistance, user2.preferences.maxDistance) * (this.weights.distance / 100);

    // Quiet hours compatibility
    totalScore += this.calculateQuietHoursScore(
      user1.preferences.quietHoursStart,
      user1.preferences.quietHoursEnd,
      user2.preferences.quietHoursStart,
      user2.preferences.quietHoursEnd
    ) * (this.weights.quietHours / 100);

    // Chores compatibility
    totalScore += this.calculateChoresScore(user1.preferences.choresPreference, user2.preferences.choresPreference) * (this.weights.chores / 100);

    // Guests compatibility
    totalScore += this.calculateGuestsScore(user1.preferences.guestsFrequency, user2.preferences.guestsFrequency) * (this.weights.guests / 100);

    // Work from home compatibility
    totalScore += this.calculateWorkFromHomeScore(user1.preferences.workFromHomeDays, user2.preferences.workFromHomeDays) * (this.weights.workFromHome / 100);

    // Pets compatibility
    totalScore += this.calculatePetsScore(
      user1.preferences.hasPets,
      user1.preferences.comfortableWithPets,
      user1.preferences.petAllergies,
      user2.preferences.hasPets,
      user2.preferences.comfortableWithPets,
      user2.preferences.petAllergies
    ) * (this.weights.pets / 100);

    // Smoking compatibility
    totalScore += this.calculateSmokingScore(user1.preferences.smokingPolicy, user2.preferences.smokingPolicy) * (this.weights.smoking / 100);

    return Math.round(totalScore);
  }

  private calculateBudgetScore(range1: [number, number], range2: [number, number]): number {
    const [min1, max1] = range1;
    const [min2, max2] = range2;
    
    const overlapMin = Math.max(min1, min2);
    const overlapMax = Math.min(max1, max2);
    
    if (overlapMin > overlapMax) {
      return 0; // No overlap
    }
    
    const overlapSize = overlapMax - overlapMin;
    const totalRange = Math.max(max1, max2) - Math.min(min1, min2);
    
    return Math.min(100, (overlapSize / totalRange) * 100);
  }

  private calculateSleepScheduleScore(schedule1: string, schedule2: string): number {
    if (schedule1 === schedule2) {
      return 100;
    }
    
    // Both flexible = 80%
    if (schedule1 === 'Flexible' || schedule2 === 'Flexible') {
      return 80;
    }
    
    // Early bird vs Night owl = 20%
    if ((schedule1 === 'Early bird' && schedule2 === 'Night owl') ||
        (schedule1 === 'Night owl' && schedule2 === 'Early bird')) {
      return 20;
    }
    
    return 50; // Default
  }

  private calculateCleanlinessScore(level1: number, level2: number): number {
    const diff = Math.abs(level1 - level2);
    return Math.max(0, 100 - (diff * 25)); // 25 points per level difference
  }

  private calculateSocialVibeScore(vibe1: string, vibe2: string): number {
    if (vibe1 === vibe2) {
      return 100;
    }
    
    const isQuiet = (vibe: string) => vibe.includes('Quiet');
    const isBalanced = (vibe: string) => vibe.includes('Balanced');
    const isLively = (vibe: string) => vibe.includes('Lively');
    
    if ((isQuiet(vibe1) && isQuiet(vibe2)) ||
        (isBalanced(vibe1) && isBalanced(vibe2)) ||
        (isLively(vibe1) && isLively(vibe2))) {
      return 100;
    }
    
    // Balanced is compatible with both quiet and lively
    if ((isBalanced(vibe1) && (isQuiet(vibe2) || isLively(vibe2))) ||
        (isBalanced(vibe2) && (isQuiet(vibe1) || isLively(vibe1)))) {
      return 75;
    }
    
    // Quiet vs Lively = 30%
    if ((isQuiet(vibe1) && isLively(vibe2)) || (isLively(vibe1) && isQuiet(vibe2))) {
      return 30;
    }
    
    return 50; // Default
  }

  private calculateMoveInDateScore(date1: string, date2: string): number {
    if (!date1 || !date2) {
      return 50; // Neutral if not specified
    }
    
    const dateObj1 = new Date(date1);
    const dateObj2 = new Date(date2);
    
    const diffMonths = Math.abs((dateObj1.getFullYear() - dateObj2.getFullYear()) * 12 + 
                               (dateObj1.getMonth() - dateObj2.getMonth()));
    
    if (diffMonths === 0) {
      return 100;
    } else if (diffMonths <= 1) {
      return 80;
    } else if (diffMonths <= 3) {
      return 60;
    } else if (diffMonths <= 6) {
      return 40;
    } else {
      return 20;
    }
  }

  private calculateLeaseLengthScore(length1: string[], length2: string[]): number {
    if (length1.length === 0 || length2.length === 0) {
      return 50; // Neutral if not specified
    }
    
    const overlap = length1.filter(item => length2.includes(item));
    return (overlap.length / Math.max(length1.length, length2.length)) * 100;
  }

  private calculateDistanceScore(distance1: string, distance2: string): number {
    if (distance1 === distance2) {
      return 100;
    }
    
    const parseDistance = (dist: string) => {
      if (dist.includes('5 minutes')) return 1;
      if (dist.includes('10 minutes')) return 2;
      if (dist.includes('15 minutes')) return 3;
      if (dist.includes('30 minutes')) return 4;
      return 2; // Default
    };
    
    const diff = Math.abs(parseDistance(distance1) - parseDistance(distance2));
    return Math.max(0, 100 - (diff * 25));
  }

  private calculateQuietHoursScore(start1: string, end1: string, start2: string, end2: string): number {
    const parseTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const start1Min = parseTime(start1);
    const end1Min = parseTime(end1);
    const start2Min = parseTime(start2);
    const end2Min = parseTime(end2);
    
    // Calculate overlap
    const overlapStart = Math.max(start1Min, start2Min);
    const overlapEnd = Math.min(end1Min, end2Min);
    
    if (overlapStart >= overlapEnd) {
      return 0; // No overlap
    }
    
    const overlapDuration = overlapEnd - overlapStart;
    const totalDuration = Math.max(end1Min - start1Min, end2Min - start2Min);
    
    return (overlapDuration / totalDuration) * 100;
  }

  private calculateChoresScore(chores1: string, chores2: string): number {
    if (chores1 === chores2) {
      return 100;
    }
    
    if (!chores1 || !chores2) {
      return 50; // Neutral if not specified
    }
    
    return 60; // Default compatibility
  }

  private calculateGuestsScore(guests1: string, guests2: string): number {
    if (guests1 === guests2) {
      return 100;
    }
    
    if (!guests1 || !guests2) {
      return 50; // Neutral if not specified
    }
    
    const parseFrequency = (freq: string) => {
      if (freq.includes('Rarely')) return 1;
      if (freq.includes('Occasionally')) return 2;
      if (freq.includes('Regularly')) return 3;
      if (freq.includes('Often')) return 4;
      return 2; // Default
    };
    
    const diff = Math.abs(parseFrequency(guests1) - parseFrequency(guests2));
    return Math.max(0, 100 - (diff * 25));
  }

  private calculateWorkFromHomeScore(days1: number, days2: number): number {
    const diff = Math.abs(days1 - days2);
    return Math.max(0, 100 - (diff * 15)); // 15 points per day difference
  }

  private calculatePetsScore(
    pets1: string[], comfortable1: boolean, allergies1: string[],
    pets2: string[], comfortable2: boolean, allergies2: string[]
  ): number {
    const hasPets1 = pets1.some(pet => pet !== 'No');
    const hasPets2 = pets2.some(pet => pet !== 'No');
    
    // If both have pets, check for allergies
    if (hasPets1 && hasPets2) {
      const hasAllergies = allergies1.length > 0 || allergies2.length > 0;
      return hasAllergies ? 30 : 90;
    }
    
    // If one has pets and other is comfortable
    if ((hasPets1 && comfortable2) || (hasPets2 && comfortable1)) {
      return 80;
    }
    
    // If one has pets and other is not comfortable
    if ((hasPets1 && !comfortable2) || (hasPets2 && !comfortable1)) {
      return 10;
    }
    
    // Neither has pets
    return 100;
  }

  private calculateSmokingScore(policy1: string[], policy2: string[]): number {
    if (policy1.length === 0 || policy2.length === 0) {
      return 50; // Neutral if not specified
    }
    
    const overlap = policy1.filter(item => policy2.includes(item));
    return (overlap.length / Math.max(policy1.length, policy2.length)) * 100;
  }
}

// Export singleton instance
export const roommateMatchingService = new RoommateMatchingService();
