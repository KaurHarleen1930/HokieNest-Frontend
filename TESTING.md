# Testing Guide for HokieNest Frontend

This document provides an overview of the comprehensive test suite created for the main features of the HokieNest application.

## Test Setup

The project uses **Vitest** as the test runner with the following testing libraries:
- `@testing-library/react` - React component testing
- `@testing-library/jest-dom` - Custom Jest matchers
- `jsdom` - DOM environment for tests
- `vitest` - Fast test runner

## Test Commands

```bash
# Run tests in watch mode (development)
npm test

# Run all tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Coverage

The test suite covers the following main features:

### 1. Housing Priorities System (`HousingPriorities.test.tsx`)

**Location**: `src/components/__tests__/HousingPriorities.test.tsx`

**Features Tested**:
- ✅ Component rendering and initialization
- ✅ Loading existing priorities from API
- ✅ Priority updates with proportional adjustment
- ✅ Validation ensuring 100% total
- ✅ Save functionality with success/error handling
- ✅ Reset to default values
- ✅ Read-only mode behavior
- ✅ Error handling for API failures

**Key Test Cases**:
```typescript
- Renders component with correct title and description
- Loads existing priorities on mount
- Updates priorities when slider values change
- Enforces 100% total by adjusting other values proportionally
- Shows error when priorities do not total 100%
- Saves priorities successfully
- Shows error when save fails
- Disables interactions when in read-only mode
```

### 2. Housing Score Calculation (`HousingScore.test.tsx`)

**Location**: `src/components/__tests__/HousingScore.test.tsx`

**Features Tested**:
- ✅ Score calculation and display
- ✅ Individual category scoring (Budget, Commute, Safety, Roommates)
- ✅ Priority weighting system
- ✅ Overall rating classification
- ✅ Progress bar rendering
- ✅ Missing data handling
- ✅ Edge case handling

**Key Test Cases**:
```typescript
- Displays total score correctly
- Shows priority weights for each category
- Displays progress bars for each category
- Shows correct overall rating badge
- Handles missing property data gracefully
- Calculates scores for different price ranges and distances
```

### 3. API Functions (`api.test.ts`)

**Location**: `src/lib/__tests__/api.test.ts`

**Features Tested**:
- ✅ Housing priorities CRUD operations
- ✅ Property listings API
- ✅ Map API functions
- ✅ User management API (admin)
- ✅ Error handling and network failures
- ✅ Authentication token handling

**Key Test Cases**:
```typescript
- Preferences API (save, get, delete housing priorities)
- Listings API (get all, get by ID, with filters)
- Map API (markers, nearby properties)
- Users API (get all, suspend user)
- Error handling for network issues
- Proper authentication header handling
```

### 4. Authentication & Authorization (`auth.test.tsx`)

**Location**: `src/lib/__tests__/auth.test.tsx`

**Features Tested**:
- ✅ AuthProvider context functionality
- ✅ Login/signup flows
- ✅ Token management
- ✅ Protected route access control
- ✅ Role-based authorization
- ✅ OAuth callback handling

**Key Test Cases**:
```typescript
- Provides authentication context
- Handles login/signup successfully and with errors
- Manages token storage and retrieval
- Handles OAuth callback with token
- Shows loading states and error handling
- ProtectedRoute blocks unauthorized access
- Role-based access control (admin, student, staff)
```

### 5. Property Map Components (`PropertyMap.test.tsx`)

**Location**: `src/components/__tests__/PropertyMap.test.tsx`

**Features Tested**:
- ✅ Map container rendering
- ✅ Property marker handling
- ✅ Interactive features
- ✅ Filter integration
- ✅ Campus selection
- ✅ Error boundary behavior

**Key Test Cases**:
```typescript
- Renders map container correctly
- Handles properties prop variations
- Manages empty states and missing data
- Integrates with filter system
- Handles campus selection
```

### 6. Property Filtering (`Properties.test.tsx`)

**Location**: `src/pages/__tests__/Properties.test.tsx`

**Features Tested**:
- ✅ Property listing display
- ✅ Price range filtering
- ✅ Bed/bath filtering
- ✅ International friendly flag
- ✅ View mode switching (grid/map)
- ✅ Sorting functionality
- ✅ Loading and error states

**Key Test Cases**:
```typescript
- Displays all properties by default
- Filters properties by price range
- Handles API errors gracefully
- Toggles between grid and map view
- Filters by international friendly flag
- Sorts properties correctly
- Handles empty results
```

### 7. Roommate Questionnaire (`RoommateQuestionnaire.test.tsx`)

**Location**: `src/pages/__tests__/RoommateQuestionnaire.test.tsx`

**Features Tested**:
- ✅ Multi-step questionnaire flow
- ✅ Progress tracking
- ✅ Form validation
- ✅ Local storage persistence
- ✅ API integration
- ✅ Navigation between steps

**Key Test Cases**:
```typescript
- Renders questionnaire with progress indicator
- Shows loading state initially
- Redirects if user already has preferences
- Loads saved preferences from localStorage
- Allows navigation between steps
- Validates required fields before proceeding
- Handles restart parameter in URL
- Shows completion step
```

## Test Utilities and Mocks

### Common Mocks Used

1. **API Mocking**:
   ```typescript
   vi.mock('@/lib/api', () => ({
     preferencesAPI: {
       getHousingPriorities: vi.fn(),
       saveHousingPriorities: vi.fn(),
     },
   }));
   ```

2. **Authentication Mocking**:
   ```typescript
   vi.mock('@/lib/auth', () => ({
     useAuth: vi.fn(),
   }));
   ```

3. **LocalStorage Mocking**:
   ```typescript
   global.localStorage = {
     getItem: vi.fn(),
     setItem: vi.fn(),
     removeItem: vi.fn(),
     clear: vi.fn(),
   };
   ```

4. **Fetch Mocking**:
   ```typescript
   global.fetch = vi.fn();
   ```

## Running Specific Tests

```bash
# Run tests for a specific component
npm test HousingPriorities

# Run tests for a specific file
npm test api.test.ts

# Run tests with pattern matching
npm test -- --grep "authentication"

# Run tests in a specific directory
npm test src/components/__tests__/
```

## Test Configuration

The test configuration is in `vitest.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

## Best Practices Implemented

1. **Mock External Dependencies**: All API calls, localStorage, and external libraries are properly mocked
2. **Async Testing**: Proper use of `waitFor` for async operations
3. **Error Scenarios**: Tests cover both success and failure cases
4. **User Interactions**: Tests simulate real user interactions with fireEvent
5. **Accessibility**: Tests verify that important UI elements are accessible
6. **Edge Cases**: Tests handle missing data, invalid inputs, and error conditions

## Coverage Goals

The test suite aims to achieve:
- **Unit Test Coverage**: > 80% for core business logic
- **Component Coverage**: > 70% for UI components
- **API Coverage**: > 90% for critical API functions
- **Integration Coverage**: Key user flows tested end-to-end

## Future Test Improvements

1. **E2E Tests**: Add Playwright tests for complete user journeys
2. **Visual Regression**: Add screenshot testing for UI consistency
3. **Performance Tests**: Test component rendering performance
4. **Accessibility Tests**: Automated a11y testing integration

## Debugging Tests

```bash
# Run tests in debug mode
npm test -- --reporter=verbose

# Run single test file with detailed output
npm test PropertyMap.test.tsx -- --reporter=verbose

# Run with coverage and show uncovered lines
npm run test:coverage -- --reporter=verbose
```

This comprehensive test suite ensures the reliability and maintainability of the HokieNest application's core features.

