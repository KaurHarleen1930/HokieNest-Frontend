import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ThemePreferencesProvider } from "@/lib/theme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navbar } from "@/components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import ListingsDebug from "./pages/ListingsDebug";
import RoommateQuestionnaire from "./pages/RoommateQuestionnaire";
import RoommateProfile from "./pages/RoommateProfile";
import RoommateMatching from "./pages/RoommateMatching";
import PriorityRankingPage from "./pages/PriorityRankingPage";
import PriorityDashboard from "./pages/PriorityDashboard";
import HousingPrioritiesDemo from "./pages/HousingPrioritiesDemo";
import ChatbotWidget from "./components/ChatbotWidget";
import Messages from "./pages/Messages";
import Conversation from "./pages/Conversation";
import 'leaflet/dist/leaflet.css';
import PropertyDetailsWithAmenities from '@/components/Property/PropertyDetailsWithAmenities';
import CommunityPage from "@/pages/CommunityPage";
import { supabase } from "@/lib/supabase";

supabase.auth.getSession().then(({ data }) => {
  console.log("🔑 Restored session:", data.session);
});

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <ThemePreferencesProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
                <Navbar />
                <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/roommate-questionnaire" element={
                <ProtectedRoute>
                  <RoommateQuestionnaire />
                </ProtectedRoute>
              } />
              <Route path="/roommate-profile" element={<RoommateProfile />} />
              <Route path="/roommate-matching" element={
                <ProtectedRoute>
                  <RoommateMatching />
                </ProtectedRoute>
              } />
              <Route path="/priority-ranking" element={
                <ProtectedRoute>
                  <PriorityRankingPage />
                </ProtectedRoute>
              } />
              <Route path="/priority-dashboard" element={
                <ProtectedRoute>
                  <PriorityDashboard />
                </ProtectedRoute>
              } />
              <Route path="/housing-priorities-demo" element={
                <ProtectedRoute>
                  <HousingPrioritiesDemo />
                </ProtectedRoute>
              } />
              <Route path="/properties" element={<Properties />} />
              <Route path="/__debug/listings" element={<ListingsDebug />} /> {/* 👈 add this */}
              <Route 
        path="/properties/:id"         element={<PropertyDetail />}       />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute requiredRole="admin">
                  <Admin />
                </ProtectedRoute>
              } />
              <Route path="/messages" element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              } />
              <Route path="/conversation/:conversationId" element={
               <ProtectedRoute>
               <Conversation />
              </ProtectedRoute>
              } />

{/* 👇 New Community Page Route */}
<Route path="/community" element={<CommunityPage />} />

{/* ⚠️ Keep NotFound LAST */}
<Route path="*" element={<NotFound />} />
{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
                </Routes>
                <ChatbotWidget />
              </div>
            </BrowserRouter>
          </ThemePreferencesProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
