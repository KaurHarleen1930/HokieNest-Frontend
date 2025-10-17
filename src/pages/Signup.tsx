import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { Home, AlertCircle, Eye, EyeOff, CheckCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [oauthVerified, setOauthVerified] = useState(false);

  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Handle OAuth callback from Google verification
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const userParam = urlParams.get('user');
    const errorParam = urlParams.get('error');

    if (tokenParam && userParam) {
      // User completed Google OAuth successfully
      // Case 1: Came from our signup form with saved data → auto-complete
      const signupData = localStorage.getItem('signupData');
      if (signupData) {
        const { email, password, name } = JSON.parse(signupData);
        completeSignupAfterOAuth(email, password, name);
        localStorage.removeItem('signupData');
      } else {
        // Case 2: No saved data (e.g., direct OAuth) → prefill and ask for password
        try {
          const userData = JSON.parse(decodeURIComponent(userParam));
          if (userData?.email) setEmail(userData.email);
          if (userData?.name) setName(userData.name);
          setOauthVerified(true);
          toast.success("VT email verified. Set a password to finish signup.");
        } catch (e) {
          // ignore
        }
      }

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorParam) {
      if (errorParam === 'vt_email_required') {
        setError('Only Virginia Tech (@vt.edu) email addresses are allowed');
      } else if (errorParam === 'oauth_failed') {
        setError('Google authentication failed. Please try again.');
      }
      setIsLoading(false);
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const completeSignupAfterOAuth = async (email: string, password: string, name: string) => {
    try {
      const result = await signup(email, password, name);
      toast.success("Account created successfully!");
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

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

    // Validate password
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    try {
      if (oauthVerified) {
        // We already verified via Google; complete signup directly
        await completeSignupAfterOAuth(email, password, name);
      } else {
        // Store form data temporarily in localStorage for after OAuth
        localStorage.setItem('signupData', JSON.stringify({
          email,
          password,
          name
        }));

        // Trigger Google OAuth to verify VT.edu email
        await loginWithGoogle();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setIsLoading(false);
    }
  };

  const isEmailValid = email.endsWith('@vt.edu') && email.length > 7;
  const isPasswordValid = password.length >= 6;
  const isFormValid = name.trim() && isEmailValid && isPasswordValid;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-surface to-surface-2 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-foreground hover:text-accent transition-colors">
            <Home className="h-8 w-8 text-accent" />
            HokieNest
          </Link>
          <p className="text-muted mt-2">Create your account</p>
        </div>

        {/* Signup Form */}
        <Card className="bg-surface border-surface-3">
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
              <CardDescription>
              {oauthVerified
                ? 'VT email verified via Google. Set a password to finish signup.'
                : 'Verify your VT.edu email with Google, then create your account'}
              </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-surface-2 border-surface-3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">VT Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@vt.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="bg-surface-2 border-surface-3 pr-10"
                  />
                  {isEmailValid && (
                    <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-success" />
                  )}
                </div>
                <p className="text-xs text-muted">
                  Must be a valid @vt.edu email address
                </p>
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
                    className="bg-surface-2 border-surface-3 pr-20"
                  />
                  <div className="absolute right-0 top-0 h-full flex items-center">
                    {isPasswordValid && (
                      <CheckCircle className="h-4 w-4 text-success mr-2" />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted">
                  Must be at least 6 characters long
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isFormValid}
                variant="accent"
              >
                {isLoading ? "Creating account..." : "Complete Sign Up"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted">
                Already have an account?{" "}
                <Link to="/login" className="text-accent hover:underline font-medium">
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}