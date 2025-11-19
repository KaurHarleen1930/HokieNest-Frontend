import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { Home, AlertCircle, Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [oauthVerified, setOauthVerified] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false); // ✅ NEW

  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Handle OAuth callback from Google verification
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    const userParam = urlParams.get("user");
    const errorParam = urlParams.get("error");

    if (tokenParam && userParam) {
      const signupData = localStorage.getItem("signupData");

      if (signupData) {
        const { email, password, name } = JSON.parse(signupData);
        completeSignupAfterOAuth(email, password, name);
        localStorage.removeItem("signupData");
      } else {
        try {
          const userData = JSON.parse(decodeURIComponent(userParam));
          if (userData?.email) setEmail(userData.email);
          if (userData?.name) setName(userData.name);
          setOauthVerified(true);
          toast.success("VT email verified. Set a password to finish signup.");
        } catch {
          /* ignore */
        }
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorParam) {
      if (errorParam === "vt_email_required") {
        setError("Only Virginia Tech (@vt.edu) email addresses are allowed");
      } else if (errorParam === "oauth_failed") {
        setError("Google authentication failed. Please try again.");
      }
      setIsLoading(false);
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

    if (!email.endsWith("@vt.edu")) {
      setError("Please use your Virginia Tech email address (@vt.edu)");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    if (!agreeTerms) {
      setError("You must agree to the Terms of Use & Code of Conduct");
      setIsLoading(false);
      return;
    }

    try {
      if (oauthVerified) {
        await completeSignupAfterOAuth(email, password, name);
      } else {
        localStorage.setItem(
          "signupData",
          JSON.stringify({ email, password, name })
        );
        await loginWithGoogle();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setIsLoading(false);
    }
  };

  const isEmailValid = email.endsWith("@vt.edu") && email.length > 7;
  const isPasswordValid = password.length >= 6;
  const isFormValid = name.trim() && isEmailValid && isPasswordValid;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-surface to-surface-2 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-2xl font-bold text-foreground hover:text-accent transition-colors"
          >
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
                ? "VT email verified via Google. Set a password to finish signup."
                : "Verify your VT.edu email with Google, then create your account"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
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

              {/* Email */}
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
                    <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
                  )}
                </div>
              </div>

              {/* Password */}
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
              </div>

              {/* ⚠️ Terms Checkbox (NEW) */}
              <div className="flex items-start gap-3 mt-4">
                <input
                  type="checkbox"
                  id="agreeTerms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <label htmlFor="agreeTerms" className="text-sm text-muted-foreground">
                  I agree to the{" "}
                  <Link
                    to="/terms"
                    className="text-accent underline hover:text-accent/80"
                  >
                    Terms of Use & Code of Conduct
                  </Link>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isFormValid || !agreeTerms}
                variant="accent"
              >
                {isLoading ? "Creating account..." : "Complete Sign Up"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-accent hover:underline font-medium"
                >
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
