import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
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
import NotificationsPage from "./pages/NotificationsPage";
import Conversation from "./pages/Conversation";
import 'leaflet/dist/leaflet.css';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
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
              <Route path="/properties/:id" element={<PropertyDetail />} />
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
              <Route path="/notifications" element={
  <ProtectedRoute>
    <NotificationsPage />
  </ProtectedRoute>
} />
              <Route path="/conversation/:conversationId" element={
  <ProtectedRoute>
    <Conversation />
  </ProtectedRoute>
} />
{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ChatbotWidget />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
