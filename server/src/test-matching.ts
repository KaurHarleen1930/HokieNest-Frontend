#!/usr/bin/env ts-node

/**
 * Simple test runner for the roommate matching algorithm
 * Run with: npx ts-node src/test-matching.ts
 */

import { RoommateMatchingService, DEFAULT_MATCHING_WEIGHTS, RoommateProfile } from './services/matching';

// Test colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

function test(name: string, testFn: () => boolean | void) {
  try {
    const result = testFn();
    if (result === false) {
      log(colors.red, `❌ FAIL: ${name}`);
      return false;
    } else {
      log(colors.green, `✅ PASS: ${name}`);
      return true;
    }
  } catch (error) {
    log(colors.red, `❌ ERROR: ${name} - ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function runTests() {
  log(colors.bold, '\n🧪 Running Roommate Matching Algorithm Tests\n');
  
  const matchingService = new RoommateMatchingService();
  let passed = 0;
  let total = 0;

  // Test 1: Weight Validation
  total++;
  if (test('Weight validation with valid weights', () => {
    matchingService.updateWeights(DEFAULT_MATCHING_WEIGHTS);
    return true;
  })) passed++;

  total++;
  if (test('Weight validation with invalid weights', () => {
    try {
      matchingService.updateWeights({
        budget: 50,
        sleepSchedule: 50,
        cleanliness: 50,
        socialVibe: 0,
        moveInDate: 0,
        leaseLength: 0,
        distance: 0,
        quietHours: 0,
        chores: 0,
        guests: 0,
        workFromHome: 0,
        pets: 0,
        smoking: 0,
      });
      return false; // Should have thrown an error
    } catch (error) {
      // Reset to default weights after the test
      matchingService.updateWeights(DEFAULT_MATCHING_WEIGHTS);
      return error instanceof Error && error.message.includes('100%');
    }
  })) passed++;

  // Test 2: Budget Compatibility
  total++;
  if (test('Budget compatibility - identical ranges', () => {
    const score = (matchingService as any).calculateBudgetScore([800, 1200], [800, 1200]);
    return score === 100;
  })) passed++;

  total++;
  if (test('Budget compatibility - overlapping ranges', () => {
    const score = (matchingService as any).calculateBudgetScore([800, 1200], [1000, 1400]);
    return score > 0 && score < 100;
  })) passed++;

  total++;
  if (test('Budget compatibility - no overlap', () => {
    const score = (matchingService as any).calculateBudgetScore([800, 1200], [1500, 2000]);
    return score === 0;
  })) passed++;

  // Test 3: Sleep Schedule Compatibility
  total++;
  if (test('Sleep schedule - identical schedules', () => {
    const score = (matchingService as any).calculateSleepScheduleScore('Early bird', 'Early bird');
    return score === 100;
  })) passed++;

  total++;
  if (test('Sleep schedule - one flexible', () => {
    const score = (matchingService as any).calculateSleepScheduleScore('Early bird', 'Flexible');
    return score === 80;
  })) passed++;

  total++;
  if (test('Sleep schedule - opposite schedules', () => {
    const score = (matchingService as any).calculateSleepScheduleScore('Early bird', 'Night owl');
    return score === 20;
  })) passed++;

  // Test 4: Cleanliness Compatibility
  total++;
  if (test('Cleanliness - identical levels', () => {
    const score = (matchingService as any).calculateCleanlinessScore(3, 3);
    return score === 100;
  })) passed++;

  total++;
  if (test('Cleanliness - one level difference', () => {
    const score = (matchingService as any).calculateCleanlinessScore(3, 4);
    return score === 75;
  })) passed++;

  total++;
  if (test('Cleanliness - maximum difference', () => {
    const score = (matchingService as any).calculateCleanlinessScore(1, 5);
    return score === 0;
  })) passed++;

  // Test 5: Overall Compatibility Score
  total++;
  if (test('Overall compatibility - high compatibility profiles', () => {
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
    return score >= 0 && score <= 100 && score > 70;
  })) passed++;

  total++;
  if (test('Overall compatibility - low compatibility profiles', () => {
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
    return score >= 0 && score <= 100 && score < 50;
  })) passed++;

  // Test Results Summary
  log(colors.bold, '\n📊 Test Results Summary');
  log(colors.blue, `Total Tests: ${total}`);
  log(colors.green, `Passed: ${passed}`);
  log(colors.red, `Failed: ${total - passed}`);
  
  if (passed === total) {
    log(colors.green, '\n🎉 All tests passed! The matching algorithm is working correctly.');
  } else {
    log(colors.red, '\n❌ Some tests failed. Please check the implementation.');
  }

  // Show current default weights
  log(colors.bold, '\n⚖️  Current Default Weights:');
  const weights = matchingService.getWeights();
  Object.entries(weights).forEach(([key, value]) => {
    log(colors.blue, `  ${key}: ${value}%`);
  });
}

// Run the tests
runTests();
