import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Plus, Edit3, Trash2, Flag, Search, MessageSquare, Clock, User, ArrowUpDown, Loader2 } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1/community`
  : "http://localhost:4000/api/v1/community";

// Helper function to format relative time
function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const postDate = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - postDate.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return postDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: postDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

// Skeleton loader component
function PostCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="h-5 bg-muted rounded w-3/4 mb-2" />
        <div className="h-4 bg-muted rounded w-1/4" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
        </div>
        <div className="h-8 bg-muted rounded w-24 mt-4" />
      </CardContent>
    </Card>
  );
}

export default function CommunityPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", content: "" });
  const [flagReason, setFlagReason] = useState("");
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openFlagDialog, setOpenFlagDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 🔹 Fetch posts
  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}`);
        if (!res.ok) throw new Error("Failed to load posts");
        const data = await res.json();
        setPosts(data);
      } catch (error: any) {
        toast({
          title: "Error loading posts",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [toast]);

  // 🔹 Create a post
  const handleCreate = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to create post");
      const newPost = await res.json();

      setPosts([newPost, ...posts]);
      toast({ title: "Post created successfully!" });
      setOpenDialog(false);
      setForm({ title: "", content: "" });
    } catch (error: any) {
      toast({
        title: "Error creating post",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // 🔹 Update post
  const handleUpdate = async () => {
    if (!selectedPost) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/${selectedPost.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to update post");
      const updated = await res.json();

      setPosts(posts.map((p) => (p.id === updated.id ? updated : p)));
      toast({ title: "Post updated successfully!" });
      setOpenDialog(false);
    } catch (error: any) {
      toast({
        title: "Error updating post",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // 🔹 Delete post
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to delete post");
      setPosts(posts.filter((p) => p.id !== id));
      toast({ title: "Post deleted successfully" });
    } catch (error: any) {
      toast({
        title: "Error deleting post",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Filter and sort posts
  const filteredAndSortedPosts = useMemo(() => {
    let filtered = posts;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title?.toLowerCase().includes(query) ||
          post.content?.toLowerCase().includes(query)
      );
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

    return sorted;
  }, [posts, searchQuery, sortBy]);

  // 🔹 Flag post
  const handleFlag = async () => {
    if (!selectedPost) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/${selectedPost.id}/flag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: flagReason }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to flag post");
      }

      toast({
        title: "Post flagged",
        description: "Thank you for reporting this post.",
      });
      setOpenFlagDialog(false);
      setFlagReason("");
    } catch (error: any) {
      toast({
        title: "Error flagging post",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <MessageSquare className="h-10 w-10 text-accent" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Community Board
              </h1>
            </div>
            <p className="text-lg text-muted-foreground mb-6">
              Connect with the VT community. Share updates, ask questions, and stay connected.
            </p>
            {isAuthenticated && (
              <Button
                variant="accent"
                size="lg"
                className="gap-2"
                onClick={() => {
                  setForm({ title: "", content: "" });
                  setSelectedPost(null);
                  setOpenDialog(true);
                }}
              >
                <Plus className="h-5 w-5" />
                New Post
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Search and Filter Bar */}
        {posts.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: "newest" | "oldest") => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          /* Empty State */
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">No Posts Yet</CardTitle>
              <CardDescription className="text-center">
                Be the first to start a discussion!
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              {isAuthenticated ? (
                <Button
                  variant="accent"
                  onClick={() => {
                    setForm({ title: "", content: "" });
                    setSelectedPost(null);
                    setOpenDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Post
                </Button>
              ) : (
                <p className="text-muted-foreground">
                  Please sign in to create a post.
                </p>
              )}
            </CardContent>
          </Card>
        ) : filteredAndSortedPosts.length === 0 ? (
          /* No Search Results */
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">No Results Found</CardTitle>
              <CardDescription className="text-center">
                Try adjusting your search query.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
              >
                Clear Search
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Posts Grid */
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {filteredAndSortedPosts.length} {filteredAndSortedPosts.length === 1 ? "post" : "posts"}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedPosts.map((post) => {
                const isOwner = isAuthenticated && post.author_id === user?.id;
                const authorInitials = post.author_name
                  ?.split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "U";

                return (
                  <Card
                    key={post.id}
                    className="group hover:shadow-lg transition-all duration-300 border-surface-3 bg-surface"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg font-semibold line-clamp-2 group-hover:text-accent transition-colors">
                          {post.title}
                        </CardTitle>
                        {isOwner && (
                          <Badge variant="secondary" className="shrink-0">
                            Your Post
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {authorInitials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {post.author_name || "Anonymous"}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(post.created_at)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-foreground line-clamp-4 leading-relaxed">
                        {post.content}
                      </p>
                      <Separator />
                      <div className="flex justify-end gap-2">
                        {isOwner ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPost(post);
                                setForm({ title: post.title, content: post.content });
                                setOpenDialog(true);
                              }}
                              className="gap-1"
                            >
                              <Edit3 className="h-3 w-3" />
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={deletingId === post.id}
                                  className="gap-1"
                                >
                                  {deletingId === post.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Post?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{post.title}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(post.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        ) : (
                          isAuthenticated && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPost(post);
                                setOpenFlagDialog(true);
                              }}
                              className="gap-1"
                            >
                              <Flag className="h-3 w-3" />
                              Flag
                            </Button>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedPost ? "Edit Post" : "Create New Post"}
            </DialogTitle>
            <DialogDescription>
              {selectedPost
                ? "Update your post below. Changes will be visible immediately."
                : "Share your thoughts, ask questions, or connect with the community."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="Enter post title..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={100}
                className="bg-surface"
              />
              <p className="text-xs text-muted-foreground text-right">
                {form.title.length}/100
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                placeholder="Write your post content..."
                rows={6}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                maxLength={1000}
                className="bg-surface resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {form.content.length}/1000
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpenDialog(false);
                setForm({ title: "", content: "" });
                setSelectedPost(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={selectedPost ? handleUpdate : handleCreate}
              disabled={!form.title.trim() || !form.content.trim()}
            >
              {selectedPost ? "Update Post" : "Create Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Dialog */}
      <Dialog open={openFlagDialog} onOpenChange={setOpenFlagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Flag Post
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for flagging this post. Our moderation team will review it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPost && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">{selectedPost.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {selectedPost.content}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for flagging</label>
              <Textarea
                placeholder="Please describe why you're flagging this post..."
                rows={4}
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                maxLength={500}
                className="bg-surface resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {flagReason.length}/500
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpenFlagDialog(false);
                setFlagReason("");
                setSelectedPost(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleFlag}
              disabled={!flagReason.trim()}
            >
              Submit Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}