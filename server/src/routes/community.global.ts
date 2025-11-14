import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * GET /api/v1/community
 * Returns all community posts
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    console.error("Error fetching posts:", error.message);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

/**
 * POST /api/v1/community
 * Create a new post
 */
router.post("/", authenticateToken as any, async (req: any, res: Response) => {
  try {
    const { title, content } = req.body;
    const appUserId: number | undefined = req.user?.id;

    if (!title || !content)
      return res.status(400).json({ message: "Title and content are required" });
    if (!appUserId)
      return res.status(401).json({ message: "User not authenticated" });

    // 1️⃣ Get backend user email to verify VT domain
    const { data: appUser, error: appUserErr } = await supabase
      .from("users")
      .select("email")
      .eq("user_id", appUserId)
      .single();

    if (appUserErr || !appUser?.email) {
      console.error("Could not resolve backend user email:", appUserErr || appUser);
      return res.status(400).json({ message: "Could not resolve user email" });
    }

    // 2️⃣ Ensure VT domain
    if (!appUser.email.endsWith("@vt.edu")) {
      return res.status(403).json({
        message: "Only Virginia Tech users can create community posts",
      });
    }

    // 3️⃣ Insert post using backend user_id directly
    const { data, error } = await supabase
      .from("community_posts")
      .insert([{ title, content, author_id: appUserId }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    console.error("Error creating post:", error?.message || error);
    res.status(500).json({ message: "Failed to create post" });
  }
});

/**
 * PUT /api/v1/community/:id
 * Update a post (must be owner)
 */
router.put("/:id", authenticateToken as any, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const appUserId = req.user?.id;

    if (!appUserId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Check if post exists and user is the author
    const { data: post } = await supabase
      .from("community_posts")
      .select("author_id")
      .eq("id", id)
      .single();

    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.author_id !== appUserId)
      return res.status(403).json({ message: "Not your post" });

    // Update the post
    const { data, error } = await supabase
      .from("community_posts")
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error("Error updating post:", error.message);
    res.status(500).json({ message: "Failed to update post" });
  }
});

/**
 * DELETE /api/v1/community/:id
 * Delete a post (must be owner)
 */
router.delete("/:id", authenticateToken as any, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const appUserId = req.user?.id;

    if (!appUserId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Check if post exists and user is the author
    const { data: post } = await supabase
      .from("community_posts")
      .select("author_id")
      .eq("id", id)
      .single();

    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.author_id !== appUserId)
      return res.status(403).json({ message: "Not your post" });

    // Delete the post
    const { error } = await supabase
      .from("community_posts")
      .delete()
      .eq("id", id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting post:", error.message);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

/**
 * POST /api/v1/community/:id/flag
 * Flag a post for moderation
 */
router.post("/:id/flag", authenticateToken as any, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const appUserId = req.user?.id;

    if (!reason) return res.status(400).json({ message: "Reason required" });
    if (!appUserId) return res.status(401).json({ message: "User not authenticated" });

    // Check if user has already flagged this post
    const { data: existingFlag } = await supabase
      .from("post_flags")
      .select("id")
      .eq("post_id", id)
      .eq("user_id", appUserId)
      .maybeSingle();

    if (existingFlag) {
      return res.status(400).json({ message: "You have already reported this post" });
    }

    // Insert flag using backend user_id directly
    const { data, error } = await supabase
      .from("post_flags")
      .insert([{ post_id: id, user_id: appUserId, reason }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    console.error("Error flagging post:", error.message);
    res.status(500).json({ message: "Failed to flag post" });
  }
});

export { router as communityRoutesGlobal };
