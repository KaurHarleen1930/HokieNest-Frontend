import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Search, Home as HomeIcon, Users, Shield, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-8">
            <div className="inline-flex items-center gap-3 bg-surface border border-border rounded-full px-6 py-3 mb-8">
              <HomeIcon className="h-5 w-5 text-accent" />
              <span className="text-sm font-semibold text-primary">Virginia Tech Housing Platform</span>
            </div>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-primary mb-6 leading-tight">
              Find Your Perfect
              <span className="text-accent"> Hokie Home</span>
            </h1>
            
            <p className="text-xl text-muted mb-10 leading-relaxed max-w-2xl mx-auto">
              Discover student-friendly housing near Virginia Tech campus. 
              Connect with verified landlords and find your ideal living space.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="hero"
                onClick={() => navigate('/properties')}
                className="gap-2"
              >
                <Search className="h-5 w-5" />
                Browse Properties
              </Button>
              
              {!isAuthenticated && (
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate('/signup')}
                >
                  Join HokieNest
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full bg-accent/5 blur-3xl"></div>
          <div className="absolute bottom-1/4 left-1/4 h-64 w-64 rounded-full bg-primary/5 blur-3xl"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-surface">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-primary mb-4">
              Why Choose HokieNest?
            </h2>
            <p className="text-muted text-lg max-w-2xl mx-auto">
              Built specifically for the Virginia Tech community with features that matter to students.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mb-4">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-primary mb-3">VT Community</h3>
              <p className="text-muted">
                Exclusively for Virginia Tech students and staff. Connect with verified members of the Hokie community.
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10 text-accent mb-4">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-primary mb-3">Smart Search</h3>
              <p className="text-muted">
                Filter by price, bedrooms, international-friendly options, and more to find exactly what you need.
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10 text-accent mb-4">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-primary mb-3">Verified Listings</h3>
              <p className="text-muted">
                All properties are verified and international student-friendly options are clearly marked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Roommate Matching CTA Section */}
      <section className="py-20 bg-surface">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="mb-6">
              <span className="text-5xl">🎯</span>
            </div>
            <h2 className="text-3xl font-bold text-primary mb-4">
              Let's find your ideal roommate!
            </h2>
            <p className="text-muted text-lg mb-8 leading-relaxed">
              We'll ask a few quick questions about your lifestyle and housing preferences. 
              This helps us match you with compatible roommates who share your values.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate('/roommate-questionnaire')}
                className="gap-2"
              >
                Start Questionnaire
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate(isAuthenticated ? '/dashboard' : '/properties')}
              >
                Skip for now → {isAuthenticated ? 'Go to Dashboard' : 'Browse Properties'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Post Listing CTA Section */}
      {isAuthenticated && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div className="mb-6">
                <span className="text-5xl">🏠</span>
              </div>
              <h2 className="text-3xl font-bold text-primary mb-4">
                Have a property to share?
              </h2>
              <p className="text-muted text-lg mb-8 leading-relaxed">
                List your property and help fellow Hokies find their perfect living space. 
                Whether it's a whole apartment, private room, or shared space, we make it easy to reach the VT community.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  variant="accent"
                  onClick={() => navigate('/post-listing')}
                  className="gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Post Your Listing
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate('/properties')}
                >
                  Browse Listings →
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-primary mb-4">
              Ready to Find Your Home?
            </h2>
            <p className="text-muted text-lg mb-8">
              Join thousands of Hokies who have found their perfect housing through HokieNest.
            </p>
            <Button 
              size="lg" 
              variant="accent"
              onClick={() => navigate('/properties')}
              className="gap-2"
            >
              <Search className="h-5 w-5" />
              Start Your Search
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}