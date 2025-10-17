import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, AlertCircle, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState("");
    const [resetLink, setResetLink] = useState("");

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
            const response = await fetch('http://localhost:4000/api/v1/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setIsSubmitted(true);

                if (data.resetLink) {
                    // Email service unavailable, show reset link
                    toast.success("Reset link generated!", {
                        description: "Email service unavailable. Use the link below.",
                        icon: <Mail className="h-4 w-4" />,
                    });

                    // Store the reset link for display
                    setResetLink(data.resetLink);
                } else {
                    // Normal email sent
                    toast.success("Password reset link sent!", {
                        description: "Check your VT.edu email for instructions.",
                        icon: <Mail className="h-4 w-4" />,
                    });
                }
            } else {
                setError(data.message || 'Failed to send reset link');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-surface to-surface-2 p-4">
                <div className="w-full max-w-md space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-foreground hover:text-accent transition-colors">
                            <Home className="h-8 w-8 text-accent" />
                            HokieNest
                        </Link>
                    </div>

                    {/* Success Card */}
                    <Card className="bg-surface border-surface-3">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <Mail className="h-6 w-6 text-green-600" />
                            </div>
                            <CardTitle className="text-green-800">Check Your Email</CardTitle>
                            <CardDescription>
                                We've sent a password reset link to {email}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {resetLink ? (
                                <div className="space-y-4">
                                    <div className="text-center text-sm text-muted">
                                        <p><strong>Email service is currently unavailable.</strong></p>
                                        <p>Use the link below to reset your password:</p>
                                    </div>
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-xs text-blue-600 mb-2">Reset Link (expires in 15 minutes):</p>
                                        <p className="text-sm font-mono break-all text-blue-800">{resetLink}</p>
                                    </div>
                                    <div className="text-center">
                                        <Button asChild className="w-full">
                                            <a href={resetLink} target="_blank" rel="noopener noreferrer">
                                                Open Reset Page
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-sm text-muted">
                                    <p>Click the link in your email to reset your password.</p>
                                    <p className="mt-2"><strong>The link will expire in 15 minutes.</strong></p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setIsSubmitted(false);
                                        setEmail("");
                                    }}
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Try Different Email
                                </Button>

                                <Button asChild variant="ghost" className="w-full">
                                    <Link to="/login">
                                        Back to Sign In
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-surface to-surface-2 p-4">
            <div className="w-full max-w-md space-y-6">
                {/* Header */}
                <div className="text-center">
                    <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-foreground hover:text-accent transition-colors">
                        <Home className="h-8 w-8 text-accent" />
                        HokieNest
                    </Link>
                    <p className="text-muted mt-2">Reset your password</p>
                </div>

                {/* Forgot Password Form */}
                <Card className="bg-surface border-surface-3">
                    <CardHeader>
                        <CardTitle>Forgot Password</CardTitle>
                        <CardDescription>
                            Enter your VT.edu email address and we'll send you a link to reset your password
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
                                <p className="text-xs text-muted">
                                    Must be a valid @vt.edu email address
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
                                disabled={isLoading || !email}
                                variant="accent"
                            >
                                {isLoading ? "Sending..." : "Send Reset Link"}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-muted">
                                Remember your password?{" "}
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
