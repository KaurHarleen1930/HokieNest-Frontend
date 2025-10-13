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
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate VT email
    if (!email.endsWith('@vt.edu')) {
      setError("Please use your Virginia Tech email address (@vt.edu)");
      setIsLoading(false);
      return;
    }

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);

      // Show resend button if email is not verified
      if (errorMessage.toLowerCase().includes('verify')) {
        setShowResendVerification(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const demoAccounts = [
    { type: "Student", email: "jdoe@vt.edu", password: "password" },
    { type: "Staff", email: "staff@vt.edu", password: "password" },
    { type: "Admin", email: "admin@vt.edu", password: "password" },
  ];

  const fillDemo = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
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

        {/* Demo Accounts */}
        <Card className="bg-surface-2 border-surface-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Demo Accounts</CardTitle>
            <CardDescription>Use these credentials to test the application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {demoAccounts.map((account) => (
              <div key={account.type} className="flex items-center justify-between p-2 rounded-md bg-surface border border-surface-3">
                <div className="flex items-center gap-2">
                  <Badge variant="muted" className="text-xs">{account.type}</Badge>
                  <span className="text-sm text-muted">{account.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => fillDemo(account.email, account.password)}
                >
                  Use
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

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