import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Plus, Edit3, Trash2, Flag } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1/community`
  : "http://localhost:4000/api/v1/community";

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
    if (!confirm("Are you sure you want to delete this post?")) return;
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
      toast({ title: "Post deleted." });
    } catch (error: any) {
      toast({
        title: "Error deleting post",
        description: error.message,
        variant: "destructive",
      });
    }
  };

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

      if (!res.ok) throw new Error("Failed to flag post");
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

  if (loading) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        Loading community posts...
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Community Board</h1>
        {isAuthenticated && (
          <Button
            onClick={() => {
              setForm({ title: "", content: "" });
              setSelectedPost(null);
              setOpenDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> New Post
          </Button>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No posts yet. Be the first to start a discussion!
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Card
              key={post.id}
              className="hover:shadow-lg transition-shadow duration-300"
            >
              <CardHeader>
                <CardTitle className="text-lg">{post.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {new Date(post.created_at).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{post.content}</p>

                <div className="flex justify-end gap-2">
                  {isAuthenticated && post.author_id === user?.id && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPost(post);
                          setForm({ title: post.title, content: post.content });
                          setOpenDialog(true);
                        }}
                      >
                        <Edit3 className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(post.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </>
                  )}

                  {isAuthenticated && post.author_id !== user?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPost(post);
                        setOpenFlagDialog(true);
                      }}
                    >
                      <Flag className="h-4 w-4 mr-1" /> Flag
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPost ? "Edit Post" : "Create New Post"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Post title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Textarea
              placeholder="Write your post..."
              rows={5}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          <DialogFooter className="pt-4">
            <Button
              onClick={selectedPost ? handleUpdate : handleCreate}
              disabled={!form.title.trim() || !form.content.trim()}
            >
              {selectedPost ? "Update" : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Dialog */}
      <Dialog open={openFlagDialog} onOpenChange={setOpenFlagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Post</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Please provide a reason for flagging this post.
          </p>
          <Textarea
            placeholder="Reason for flagging..."
            rows={3}
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
          />
          <DialogFooter className="pt-4">
            <Button onClick={handleFlag} disabled={!flagReason.trim()}>
              Submit Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}