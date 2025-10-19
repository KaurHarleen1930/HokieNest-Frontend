import { RoommateMatchingService, DEFAULT_MATCHING_WEIGHTS, RoommateProfile } from '../matching';

describe('RoommateMatchingService', () => {
  let matchingService: RoommateMatchingService;

  beforeEach(() => {
    matchingService = new RoommateMatchingService();
  });

  describe('Weight Validation', () => {
    test('should accept valid weights that sum to 100', () => {
      const validWeights = {
        budget: 20,
        sleepSchedule: 15,
        cleanliness: 15,
        socialVibe: 12,
        moveInDate: 8,
        leaseLength: 8,
        distance: 5,
        quietHours: 5,
        chores: 4,
        guests: 3,
        workFromHome: 2,
        pets: 2,
        smoking: 1,
      };
      
      expect(() => {
        matchingService.updateWeights(validWeights);
      }).not.toThrow();
    });

    test('should reject weights that do not sum to 100', () => {
      const invalidWeights = {
        budget: 30,
        sleepSchedule: 20,
        cleanliness: 20,
        socialVibe: 15,
        moveInDate: 10,
        leaseLength: 10,
        distance: 5,
        quietHours: 5,
        chores: 4,
        guests: 3,
        workFromHome: 2,
        pets: 2,
        smoking: 1,
      };
      
      expect(() => {
        matchingService.updateWeights(invalidWeights);
      }).toThrow('Matching weights must sum to 100%');
    });
  });

  describe('Budget Compatibility Calculation', () => {
    const mockProfile1: RoommateProfile = {
      id: '1',
      name: 'User 1',
      email: 'user1@test.com',
      age: 20,
      gender: 'Other',
      major: 'Computer Science',
      compatibilityScore: 0,
      preferences: {
        budgetRange: [800, 1200],
        sleepSchedule: 'Flexible',
        socialVibe: 'Balanced',
        cleanlinessLevel: 3,
        moveInDate: '',
        leaseLength: [],
        maxDistance: '',
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        choresPreference: '',
        guestsFrequency: '',
        workFromHomeDays: 3,
        hasPets: [],
        comfortableWithPets: false,
        petAllergies: [],
        smokingPolicy: [],
      }
    };

    test('should calculate 100% compatibility for identical budget ranges', () => {
      const profile2 = {
        ...mockProfile1,
        id: '2',
        email: 'user2@test.com',
        preferences: {
          ...mockProfile1.preferences,
          budgetRange: [800, 1200] as [number, number]
        }
      };

      // Access private method for testing
      const score = (matchingService as any).calculateBudgetScore(
        mockProfile1.preferences.budgetRange,
        profile2.preferences.budgetRange
      );
      
      expect(score).toBe(100);
    });

    test('should calculate partial compatibility for overlapping ranges', () => {
      const profile2 = {
        ...mockProfile1,
        id: '2',
        email: 'user2@test.com',
        preferences: {
          ...mockProfile1.preferences,
          budgetRange: [1000, 1400] as [number, number]
        }
      };

      const score = (matchingService as any).calculateBudgetScore(
        mockProfile1.preferences.budgetRange,
        profile2.preferences.budgetRange
      );
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    test('should calculate 0% compatibility for non-overlapping ranges', () => {
      const profile2 = {
        ...mockProfile1,
        id: '2',
        email: 'user2@test.com',
        preferences: {
          ...mockProfile1.preferences,
          budgetRange: [1500, 2000] as [number, number]
        }
      };

      const score = (matchingService as any).calculateBudgetScore(
        mockProfile1.preferences.budgetRange,
        profile2.preferences.budgetRange
      );
      
      expect(score).toBe(0);
    });
  });

  describe('Sleep Schedule Compatibility', () => {
    test('should calculate 100% compatibility for identical sleep schedules', () => {
      const score = (matchingService as any).calculateSleepScheduleScore('Early bird', 'Early bird');
      expect(score).toBe(100);
    });

    test('should calculate 80% compatibility when one is flexible', () => {
      const score = (matchingService as any).calculateSleepScheduleScore('Early bird', 'Flexible');
      expect(score).toBe(80);
    });

    test('should calculate 20% compatibility for opposite schedules', () => {
      const score = (matchingService as any).calculateSleepScheduleScore('Early bird', 'Night owl');
      expect(score).toBe(20);
    });
  });

  describe('Cleanliness Compatibility', () => {
    test('should calculate 100% compatibility for identical cleanliness levels', () => {
      const score = (matchingService as any).calculateCleanlinessScore(3, 3);
      expect(score).toBe(100);
    });

    test('should calculate 75% compatibility for one level difference', () => {
      const score = (matchingService as any).calculateCleanlinessScore(3, 4);
      expect(score).toBe(75);
    });

    test('should calculate 0% compatibility for maximum difference', () => {
      const score = (matchingService as any).calculateCleanlinessScore(1, 5);
      expect(score).toBe(0);
    });
  });

  describe('Social Vibe Compatibility', () => {
    test('should calculate 100% compatibility for identical social vibes', () => {
      const score = (matchingService as any).calculateSocialVibeScore(
        'Quiet – mostly keep to myself',
        'Quiet – mostly keep to myself'
      );
      expect(score).toBe(100);
    });

    test('should calculate 75% compatibility when one is balanced', () => {
      const score = (matchingService as any).calculateSocialVibeScore(
        'Quiet – mostly keep to myself',
        'Balanced – sometimes socialize, sometimes recharge'
      );
      expect(score).toBe(75);
    });

    test('should calculate 30% compatibility for opposite vibes', () => {
      const score = (matchingService as any).calculateSocialVibeScore(
        'Quiet – mostly keep to myself',
        'Lively – I enjoy a busy, social household'
      );
      expect(score).toBe(30);
    });
  });

  describe('Overall Compatibility Score', () => {
    test('should calculate a realistic overall score', () => {
      const profile1: RoommateProfile = {
        id: '1',
        name: 'User 1',
        email: 'user1@test.com',
        age: 20,
        gender: 'Other',
        major: 'Computer Science',
        compatibilityScore: 0,
        preferences: {
          budgetRange: [800, 1200],
          sleepSchedule: 'Early bird',
          socialVibe: 'Balanced – sometimes socialize, sometimes recharge',
          cleanlinessLevel: 3,
          moveInDate: '2024-08-01',
          leaseLength: ['Full academic year'],
          maxDistance: 'Within 10 minutes',
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          choresPreference: 'Okay to rotate chores',
          guestsFrequency: 'Occasionally (1–2 times per month)',
          workFromHomeDays: 3,
          hasPets: ['No'],
          comfortableWithPets: true,
          petAllergies: [],
          smokingPolicy: ['No smoking, vaping, or alcohol'],
        }
      };

      const profile2: RoommateProfile = {
        id: '2',
        name: 'User 2',
        email: 'user2@test.com',
        age: 21,
        gender: 'Other',
        major: 'Engineering',
        compatibilityScore: 0,
        preferences: {
          budgetRange: [900, 1300],
          sleepSchedule: 'Early bird',
          socialVibe: 'Balanced – sometimes socialize, sometimes recharge',
          cleanlinessLevel: 4,
          moveInDate: '2024-08-01',
          leaseLength: ['Full academic year'],
          maxDistance: 'Within 10 minutes',
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          choresPreference: 'Okay to rotate chores',
          guestsFrequency: 'Occasionally (1–2 times per month)',
          workFromHomeDays: 2,
          hasPets: ['No'],
          comfortableWithPets: true,
          petAllergies: [],
          smokingPolicy: ['No smoking, vaping, or alcohol'],
        }
      };

      const score = (matchingService as any).calculateCompatibilityScore(profile1, profile2);
      
      // Should be a reasonable percentage between 0 and 100
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      
      // With mostly matching preferences, should be a high score
      expect(score).toBeGreaterThan(70);
    });

    test('should calculate lower scores for incompatible profiles', () => {
      const profile1: RoommateProfile = {
        id: '1',
        name: 'User 1',
        email: 'user1@test.com',
        age: 20,
        gender: 'Other',
        major: 'Computer Science',
        compatibilityScore: 0,
        preferences: {
          budgetRange: [800, 1200],
          sleepSchedule: 'Early bird',
          socialVibe: 'Quiet – mostly keep to myself',
          cleanlinessLevel: 5,
          moveInDate: '2024-08-01',
          leaseLength: ['Full academic year'],
          maxDistance: 'Within 5 minutes',
          quietHoursStart: '20:00',
          quietHoursEnd: '06:00',
          choresPreference: 'Prefer separate chores',
          guestsFrequency: 'Rarely (once a month or less)',
          workFromHomeDays: 5,
          hasPets: ['No'],
          comfortableWithPets: false,
          petAllergies: ['Cats', 'Dogs'],
          smokingPolicy: ['No smoking, vaping, or alcohol'],
        }
      };

      const profile2: RoommateProfile = {
        id: '2',
        name: 'User 2',
        email: 'user2@test.com',
        age: 21,
        gender: 'Other',
        major: 'Engineering',
        compatibilityScore: 0,
        preferences: {
          budgetRange: [1500, 2000],
          sleepSchedule: 'Night owl',
          socialVibe: 'Lively – I enjoy a busy, social household',
          cleanlinessLevel: 1,
          moveInDate: '2024-12-01',
          leaseLength: ['One semester'],
          maxDistance: 'Up to 30 minutes',
          quietHoursStart: '01:00',
          quietHoursEnd: '10:00',
          choresPreference: 'Prefer to hire a cleaner',
          guestsFrequency: 'Often (2+ times per week)',
          workFromHomeDays: 1,
          hasPets: ['Yes — Dog', 'Yes — Cat'],
          comfortableWithPets: true,
          petAllergies: [],
          smokingPolicy: ['No restrictions'],
        }
      };

      const score = (matchingService as any).calculateCompatibilityScore(profile1, profile2);
      
      // Should be a reasonable percentage between 0 and 100
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      
      // With mostly incompatible preferences, should be a low score
      expect(score).toBeLessThan(50);
    });
  });

  describe('Default Weights', () => {
    test('should have default weights that sum to 100', () => {
      const weights = matchingService.getWeights();
      const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
      expect(total).toBe(100);
    });

    test('should have reasonable default weight distribution', () => {
      const weights = matchingService.getWeights();
      
      // Budget should be the highest weight (most important)
      expect(weights.budget).toBe(20);
      expect(weights.budget).toBeGreaterThan(weights.sleepSchedule);
      
      // Sleep schedule and cleanliness should be high priority
      expect(weights.sleepSchedule).toBe(15);
      expect(weights.cleanliness).toBe(15);
      
      // Social vibe should be important
      expect(weights.socialVibe).toBe(12);
      
      // Smoking should be the lowest weight
      expect(weights.smoking).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty arrays gracefully', () => {
      const score = (matchingService as any).calculateLeaseLengthScore([], []);
      expect(score).toBe(50); // Should return neutral score
    });

    test('should handle missing dates gracefully', () => {
      const score = (matchingService as any).calculateMoveInDateScore('', '');
      expect(score).toBe(50); // Should return neutral score
    });

    test('should handle extreme cleanliness differences', () => {
      const score = (matchingService as any).calculateCleanlinessScore(1, 1);
      expect(score).toBe(100);
      
      const score2 = (matchingService as any).calculateCleanlinessScore(5, 5);
      expect(score2).toBe(100);
    });
  });
});
