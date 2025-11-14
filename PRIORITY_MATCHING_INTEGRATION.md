# Priority-Based Roommate Matching Integration

This document explains how to integrate the new priority-based roommate matching system into the existing HokieNest application without disturbing the current mohammad-2 branch code.

## New Files Added

### Frontend Files
- `src/pages/HousingPrioritiesDemo.tsx` - Interactive demo for setting housing priorities
- `src/pages/PriorityBasedMatching.tsx` - Real roommate matching using housing priorities
- `src/pages/PriorityMatchingDemo.tsx` - Landing page for the priority matching system
- `src/routes/PriorityRoutes.tsx` - Route definitions for new pages

### Backend Files
- `server/src/routes/roommate-matching.ts` - API endpoint for real roommate matching

## Integration Steps

### 1. Add Routes to App.tsx
Add these imports and routes to your existing App.tsx:

```tsx
// Add this import
import { PriorityRoutes } from "./routes/PriorityRoutes";

// Add this inside your Routes component
<PriorityRoutes />
```

### 2. Add Navigation Links (Optional)
To add navigation to the new features, you can add these links to your Navbar:

```tsx
// Add to your existing navigation
<Link to="/priority-matching-demo" className="text-foreground hover:text-accent transition-colors font-medium">
  Priority Matching
</Link>
```

### 3. Start Backend Server
Make sure your backend server is running to use the real roommate matching API:

```bash
cd server
npm run dev
```

## Available Routes

- `/housing-priorities-demo` - Interactive housing priorities configuration
- `/priority-based-matching` - Real roommate matches based on priorities
- `/priority-matching-demo` - Landing page explaining the system

## Features

### Housing Priorities Demo
- Interactive sliders for setting budget, commute, safety, and roommate priorities
- Real-time validation ensuring priorities total 100%
- Visual feedback with progress bars and color-coded indicators
- Saves priorities to database via API

### Priority-Based Matching
- Fetches real users from database who have completed questionnaires
- Calculates compatibility scores based on lifestyle preferences
- Applies housing priorities to rank matches
- Shows detailed score breakdowns for transparency

### API Integration
- New endpoint: `GET /api/v1/roommate-matching/matches`
- Requires authentication
- Returns ranked roommate matches based on user's housing priorities
- Includes compatibility scores and detailed breakdowns

## How It Works

1. **User sets priorities** in the Housing Priorities Demo
2. **System saves priorities** to the database
3. **Priority-Based Matching** fetches real potential roommates
4. **Algorithm calculates** compatibility and applies priority weights
5. **Results are ranked** by priority-weighted scores
6. **Users see** personalized matches with detailed explanations

## Database Requirements

The system expects these tables to exist:
- `users` - User profiles
- `housing_preferences` - Housing-related preferences
- `lifestyle_preferences` - Lifestyle-related preferences  
- `housing_priorities` - Weighted housing priorities

## Benefits

- ✅ **Non-disruptive** - Doesn't modify existing code
- ✅ **Real data** - Uses actual user profiles and preferences
- ✅ **Priority-based** - Ranks matches by user's specific needs
- ✅ **Transparent** - Shows exactly why someone is a good match
- ✅ **Personalized** - Each user gets different rankings based on their priorities

## Testing

1. Complete the roommate questionnaire with housing priorities
2. Visit `/priority-matching-demo` to explore the system
3. Use `/housing-priorities-demo` to configure priorities
4. View `/priority-based-matching` to see real matches

The system will show real roommate matches ranked by your housing priorities, providing a much more personalized and intelligent matching experience!

