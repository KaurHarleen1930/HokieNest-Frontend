import { Route } from "react-router-dom";
import HousingPrioritiesDemo from "../pages/HousingPrioritiesDemo";
import PriorityBasedMatching from "../pages/PriorityBasedMatching";
import PriorityMatchingDemo from "../pages/PriorityMatchingDemo";
import EnhancedRoommateMatching from "../pages/EnhancedRoommateMatching";
import WeightedMatchingDemo from "../pages/WeightedMatchingDemo";

// Additional routes for priority-based matching system
// These can be added to the main App.tsx without disturbing existing routes
export const PriorityRoutes = () => (
    <>
        <Route path="/housing-priorities-demo" element={<HousingPrioritiesDemo />} />
        <Route path="/priority-based-matching" element={<PriorityBasedMatching />} />
        <Route path="/priority-matching-demo" element={<PriorityMatchingDemo />} />
        <Route path="/enhanced-roommate-matching" element={<EnhancedRoommateMatching />} />
        <Route path="/weighted-matching-demo" element={<WeightedMatchingDemo />} />
    </>
);

// Instructions for adding to App.tsx:
// 1. Import: import { PriorityRoutes } from "./routes/PriorityRoutes";
// 2. Add inside Routes component: <PriorityRoutes />
