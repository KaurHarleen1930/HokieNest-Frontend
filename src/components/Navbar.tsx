import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Home, LogOut, User, Shield, UserCircle, LayoutDashboard, Target, BarChart3, Settings, MessageCircle, Plus, Users, List, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { chatAPI } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [listingsMenuOpen, setListingsMenuOpen] = useState(false);

  // Load unread message count
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadUnreadCount = async () => {
      try {
        // Get all conversations and sum up unread counts
        const response = await chatAPI.getConversations();
        const totalUnread = response.conversations.reduce((sum: number, conv: any) => {
          return sum + (conv.unread_count || 0);
        }, 0);
        setUnreadMessageCount(totalUnread);
      } catch (error) {
        console.error('Failed to load unread message count:', error);
      }
    };

    loadUnreadCount();

    // Poll for updates every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Clear badge when messages page is visited
  useEffect(() => {
    if (location.pathname === '/messages') {
      // Mark all conversations as read when visiting messages page
      const markAllRead = async () => {
        try {
          const response = await chatAPI.getConversations();
          const unreadConvs = response.conversations.filter((conv: any) => conv.unread_count > 0);
          if (unreadConvs.length > 0) {
            await Promise.all(unreadConvs.map((conv: any) => chatAPI.markConversationAsRead(conv.id)));
            setUnreadMessageCount(0);
          }
        } catch (error) {
          console.error('Failed to mark conversations as read:', error);
        }
      };
      markAllRead();
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-[9998] w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary hover:text-accent transition-colors">
          <Home className="h-6 w-6 text-accent" />
          HokieNest
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            to="/properties"
            className="text-foreground hover:text-accent transition-colors font-medium"
          >
            Properties
          </Link>
          <DropdownMenu open={listingsMenuOpen} onOpenChange={setListingsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="group inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium text-foreground hover:text-accent hover:bg-accent/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 data-[state=open]:bg-accent/50 data-[state=open]:text-accent"
              >
                <List className="h-4 w-4" />
                <span>Listings</span>
                <ChevronDown className={`h-3.5 w-3.5 ml-0.5 transition-transform duration-200 ${listingsMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 shadow-lg z-[9999]">
              <DropdownMenuLabel className="px-2 py-1.5 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Browse & Manage
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  navigate('/vt-community');
                  setListingsMenuOpen(false);
                }}
                className="cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors duration-200">
                    <Users className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-sm font-semibold leading-snug">VT Listings</span>
                    <span className="text-xs text-muted-foreground leading-snug">View all student listings</span>
                  </div>
                </div>
              </DropdownMenuItem>
              {isAuthenticated && (
                <>
                  <DropdownMenuSeparator className="my-1.5" />
                  <DropdownMenuLabel className="px-2 py-1.5 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Your Listings
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => {
                      navigate('/post-listing');
                      setListingsMenuOpen(false);
                    }}
                    className="cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/10 group-hover:bg-accent/20 transition-colors duration-200">
                        <Plus className="h-3.5 w-3.5 text-accent" />
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-sm font-semibold leading-snug">Post New Listing</span>
                        <span className="text-xs text-muted-foreground leading-snug">Create a new property listing</span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      navigate('/post-listing?tab=my-listings');
                      setListingsMenuOpen(false);
                    }}
                    className="cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary/50 group-hover:bg-secondary/70 transition-colors duration-200">
                        <List className="h-3.5 w-3.5 text-foreground" />
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-sm font-semibold leading-snug">My Listings</span>
                        <span className="text-xs text-muted-foreground leading-snug">Manage your posted listings</span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {isAuthenticated && (
            <>
              <Link
                to="/roommate-questionnaire"
                className="text-foreground hover:text-accent transition-colors font-medium"
              >
                Questionnaire
              </Link>
              <Link
                to="/roommate-matching"
                className="text-foreground hover:text-accent transition-colors font-medium"
              >
                Find Roommates
              </Link>
              <Link
                to="/priority-dashboard"
                className="text-foreground hover:text-accent transition-colors font-medium"
              >
                Priorities
              </Link>
              <Link
                to="/messages"
                className="text-foreground hover:text-accent transition-colors font-medium relative"
              >
                Messages
                {unreadMessageCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs pointer-events-none"
                  >
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </Badge>
                )}
              </Link>
              <Link
                to="/dashboard"
                className="text-foreground hover:text-accent transition-colors font-medium"
              >
                Dashboard
              </Link>
              <Link
                to="/community"
                className="text-foreground hover:text-accent transition-colors font-medium"
              >
                Community
              </Link>
            </>
          )}
        </div>

        {/* Auth Section */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline-block">{user?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 z-[9999]">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <UserCircle className="h-4 w-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/properties')}>
                    <Home className="h-4 w-4 mr-2" />
                    Properties
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Listings</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate('/vt-community')}>
                    <Users className="h-4 w-4 mr-2" />
                    VT Listings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/post-listing')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Post New Listing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/post-listing?tab=my-listings')}>
                    <List className="h-4 w-4 mr-2" />
                    My Listings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/messages')}>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Messages
                    {unreadMessageCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                      >
                        {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/roommate-questionnaire')}>
                    <Target className="h-4 w-4 mr-2" />
                    Complete Questionnaire
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/priority-dashboard')}>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Housing Priorities
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/housing-priorities-demo')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Priority Demo
                  </DropdownMenuItem>
                  {user?.role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/admin')}>
                        <Shield className="h-4 w-4 mr-2" />
                        Admin Panel
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
              >
                Sign In
              </Button>
              <Button
                variant="accent"
                onClick={() => navigate('/signup')}
              >
                Sign Up
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}