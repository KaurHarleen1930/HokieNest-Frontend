import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { Home, AlertCircle, Eye, EyeOff, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  // Handle OAuth success/error redirects
  useEffect(() => {                                                                     
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const userParam = urlParams.get('user');
    const errorParam = urlParams.get('error');

    // Successful OAuth login redirect from backend
    if (tokenParam && userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem('auth_token', tokenParam);
        // Optionally we could call fetchCurrentUser, but navigate is fine since AuthProvider will pick up token
        navigate(from, { replace: true });
        // Clean up URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      } catch (e) {
        // fallthrough to error handling
      }
    }

    if (errorParam === 'vt_email_required') {
      setError('Only Virginia Tech (@vt.edu) email addresses are allowed');
    } else if (errorParam === 'oauth_failed') {
      setError('Google authentication failed. Please try again.');
    } else if (errorParam === 'no_user') {
      setError('Authentication failed. Please try again.');
    } else if (errorParam === 'account_suspended' || errorParam === 'account_suspended_or_invalid') {
      setError('Your account has been suspended. Please contact support for more information.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");
  setIsLoading(true);

  if (!email.endsWith('@vt.edu')) {
    setError("Please use your Virginia Tech email address (@vt.edu)");
    setIsLoading(false);
    return;
  }

  try {
    // Backend login
    await login(email, password);

    // 👇 Add Supabase login in parallel
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.warn("Supabase login skipped:", error.message);
    } else {
      console.log("✅ Supabase session established for:", data.user?.email);
    }

    navigate(from, { replace: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Login failed";
    setError(errorMessage);
    if (errorMessage.toLowerCase().includes('verify')) {
      setShowResendVerification(true);
    }
  } finally {
    setIsLoading(false);
  }
};

  const handleResendVerification = async () => {
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch('http://localhost:4000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Verification email sent!", {
          description: "Please check your VT email inbox.",
          icon: <Mail className="h-4 w-4" />,
        });
        setShowResendVerification(false);
      } else {
        toast.error(data.message || "Failed to send verification email");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-surface to-surface-2 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-foreground hover:text-accent transition-colors">
            <Home className="h-8 w-8 text-accent" />
            HokieNest
          </Link>
          <p className="text-muted mt-2">Sign in to your account</p>
        </div>


        {/* Login Form */}
        <Card className="bg-surface border-surface-3">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your Virginia Tech credentials to access HokieNest
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">VT Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@vt.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-surface-2 border-surface-3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="bg-surface-2 border-surface-3 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="space-y-2">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                  {showResendVerification && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerification}
                      disabled={isResending}
                      className="w-full"
                    >
                      {isResending ? "Sending..." : "Resend Verification Email"}
                    </Button>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !email || !password}
                variant="accent"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/forgot-password" className="text-sm text-accent hover:underline">
                Forgot your password?
              </Link>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted">
                Don't have an account?{" "}
                <Link to="/signup" className="text-accent hover:underline font-medium">
                  Sign up here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}