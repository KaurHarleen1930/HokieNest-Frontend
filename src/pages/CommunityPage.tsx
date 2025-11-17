import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import {
  Plus,
  Edit3,
  Trash2,
  Flag,
  Search,
  MessageSquare,
  Clock,
  User,
  ArrowUpDown,
  Loader2,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1/community`
  : "http://localhost:4000/api/v1/community";

// Choose emoji based on keywords
function getPostEmoji(title: string, content?: string) {
  const t = (title + " " + (content ?? "")).toLowerCase();

  if (/sell|selling|free|giveaway|for sale|price|discount/.test(t)) return "🛒";
  if (/lost|found|missing|dropped/.test(t)) return "🧩";
  if (/alert|warning|scam|danger/.test(t)) return "⚠️";
  if (/yard sale|garage sale|event|meetup|party/.test(t)) return "📢";
  if (/university|vt|class|exam|study|application|visa/.test(t)) return "🎓";
  if (/recommend|suggest|advice|tips|good|best/.test(t)) return "⭐";

  return "💬";
}

// Format “x minutes ago”
function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const postDate = new Date(date);
  const diff = Math.floor((now.getTime() - postDate.getTime()) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return postDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CommunityPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", content: "" });

  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  const [openFlagDialog, setOpenFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load posts
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(API_BASE_URL);
        if (!res.ok) throw new Error("Failed loading posts");
        setPosts(await res.json());
      } catch (e: any) {
        toast({ title: "Error loading posts", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Create new post
  const handleCreate = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(API_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to create post");

      const newPost = await res.json();
      setPosts([newPost, ...posts]);
      toast({ title: "Post created!" });

      setOpenDialog(false);
      setForm({ title: "", content: "" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Update existing post
  const handleUpdate = async () => {
    if (!selectedPost) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/${selectedPost.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to update post");

      const updated = await res.json();
      setPosts(posts.map((p) => (p.id === updated.id ? updated : p)));

      toast({ title: "Post updated!" });
      setOpenDialog(false);
    } catch (e: any) {
      toast({ title: "Error updating", variant: "destructive" });
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Delete failed");

      setPosts(posts.filter((p) => p.id !== id));
      toast({ title: "Post deleted" });
    } catch {
      toast({ title: "Error deleting", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // Flag
  const handleFlag = async () => {
    if (!selectedPost) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/${selectedPost.id}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: flagReason }),
      });

      if (!res.ok) throw new Error("Failed to submit flag");

      toast({ title: "Post flagged" });
      setOpenFlagDialog(false);
      setFlagReason("");
    } catch (e: any) {
      toast({ title: "Error flagging", variant: "destructive" });
    }
  };

  // Filter + sort posts
  const filteredPosts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = posts.filter(
      (p) => p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q)
    );

    list.sort((a, b) => {
      const A = new Date(a.created_at).getTime();
      const B = new Date(b.created_at).getTime();
      return sortBy === "newest" ? B - A : A - B;
    });

    return list;
  }, [posts, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-accent mb-3" />
            <h1 className="text-4xl font-bold mb-4">HokieNest Community Board</h1>
            <p className="text-muted-foreground text-lg">
              Sell items, share announcements, post alerts, ask questions —  
              a helpful space for Hokies settling into the community.
            </p>

            {isAuthenticated && (
              <Button
                variant="accent"
                size="lg"
                className="mt-6 gap-2"
                onClick={() => {
                  setSelectedPost(null);
                  setForm({ title: "", content: "" });
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

      {/* Body */}
      <div className="container mx-auto px-4 py-10">
        {/* Search bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading */}
        {loading && (
          <p className="text-center text-muted-foreground">Loading posts…</p>
        )}

        {/* No posts */}
        {!loading && filteredPosts.length === 0 && (
          <p className="text-center text-muted-foreground mt-12 text-lg">
            No posts found.
          </p>
        )}

        {/* Post LIST layout */}
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const emoji = getPostEmoji(post.title);
            const isOwner = isAuthenticated && post.author_id === user?.id;
            const authorInitials =
              post.author_name
                ?.split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase() || "U";

            return (
              <div
                key={post.id}
                className="p-4 rounded-lg border border-surface-3 bg-surface hover:bg-surface-2 transition-all"
              >
                {/* top row: emoji + title + flag/edit/delete */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{emoji}</span>
                    <div>
                      <p className="font-medium text-base leading-tight">
                        {post.title}
                      </p>

                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback>{authorInitials}</AvatarFallback>
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
                    </div>
                  </div>

                  {/* owner or flag buttons */}
                  <div className="flex gap-2">
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
                          <Edit3 className="h-3 w-3" /> Edit
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1"
                              disabled={deletingId === post.id}
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
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(post.id)}
                                className="bg-destructive"
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
                          className="gap-1"
                          onClick={() => {
                            setSelectedPost(post);
                            setOpenFlagDialog(true);
                          }}
                        >
                          <Flag className="h-3 w-3" />
                          Flag
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* post content preview */}
                <p className="text-sm text-foreground mt-3 line-clamp-3">
                  {post.content}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedPost ? "Edit Post" : "Create New Post"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={100}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Content</label>
              <Textarea
                rows={5}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                maxLength={1000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!form.title.trim() || !form.content.trim()}
              onClick={selectedPost ? handleUpdate : handleCreate}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Dialog */}
      <Dialog open={openFlagDialog} onOpenChange={setOpenFlagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Post</DialogTitle>
            <DialogDescription>
              Tell us why this post is inappropriate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Reason for flagging…"
              rows={4}
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpenFlagDialog(false);
                setFlagReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!flagReason.trim()}
              onClick={handleFlag}
            >
              Submit Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
