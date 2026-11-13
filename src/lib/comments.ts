import { createSupabaseClient, getBrowserSupabase } from "./supabase";
import { embeddedOne } from "./types";
import type { Comment, ThreadComment } from "./types";

/** Approved comments for a film, newest first, with the commenter's
 *  display name joined from profiles. Readable by everyone (RLS allows
 *  approved comments for anon); pending and rejected comments never
 *  leave the database for non-admins. */
export async function getApprovedComments(
  filmSlug: string,
): Promise<Comment[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("comments")
    .select("id,film_slug,body,status,user_id,created_at,profiles(display_name)")
    .eq("film_slug", filmSlug)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Supabase comments query failed: ${error.message}`);
  }
  // Normalize the embedded profiles join (object or array) to one object.
  return ((data ?? []) as unknown as Comment[]).map((c) => ({
    ...c,
    profiles: embeddedOne(
      c.profiles as unknown as { display_name: string } | { display_name: string }[] | null,
    ),
  }));
}

/** Approved comments for a film, assembled into YouTube-style threads
 *  (Phase 5.2): top-level comments newest first, each with its replies
 *  oldest first, flattened to one level (a reply to a reply joins the
 *  same thread). Like counts, the current user's likes, commenter
 *  avatars, and the parent links themselves all come from separate
 *  TOLERANT queries: before the Phase 5.2 SQL runs, those tables and
 *  columns do not exist, the queries error, and every comment simply
 *  renders as a top-level comment with no likes and an initials
 *  avatar. The thread itself must never fail because of them. */
export async function getCommentThreads(
  filmSlug: string,
  currentUserId: string | null,
): Promise<{ threads: ThreadComment[]; totalApproved: number }> {
  const base = await getApprovedComments(filmSlug);
  const totalApproved = base.length;
  if (base.length === 0) {
    return { threads: [], totalApproved };
  }
  const supabase = createSupabaseClient();
  const ids = base.map((c) => c.id);

  // Parent links (comments.parent_id).
  const parentById = new Map<string, string | null>();
  try {
    const { data, error } = await supabase
      .from("comments")
      .select("id,parent_id")
      .eq("film_slug", filmSlug)
      .eq("status", "approved");
    if (!error && data) {
      for (const row of data as { id: string; parent_id: string | null }[]) {
        parentById.set(row.id, row.parent_id ?? null);
      }
    }
  } catch {
    // Column not there yet: everything is top-level.
  }

  // Like counts and the current user's own likes (comment_likes).
  const likeCountById = new Map<string, number>();
  const likedByMe = new Set<string>();
  try {
    const { data, error } = await supabase
      .from("comment_likes")
      .select("comment_id,user_id")
      .in("comment_id", ids);
    if (!error && data) {
      for (const row of data as { comment_id: string; user_id: string }[]) {
        likeCountById.set(
          row.comment_id,
          (likeCountById.get(row.comment_id) ?? 0) + 1,
        );
        if (currentUserId && row.user_id === currentUserId) {
          likedByMe.add(row.comment_id);
        }
      }
    }
  } catch {
    // Table not there yet: no likes anywhere.
  }

  // Commenter avatars (profiles.avatar_preset / avatar_url).
  const avatarByUser = new Map<
    string,
    { avatar_preset: string | null; avatar_url: string | null }
  >();
  try {
    const userIds = Array.from(new Set(base.map((c) => c.user_id)));
    const { data, error } = await supabase
      .from("profiles")
      .select("id,avatar_preset,avatar_url")
      .in("id", userIds);
    if (!error && data) {
      for (const row of data as {
        id: string;
        avatar_preset: string | null;
        avatar_url: string | null;
      }[]) {
        avatarByUser.set(row.id, {
          avatar_preset: row.avatar_preset ?? null,
          avatar_url: row.avatar_url ?? null,
        });
      }
    }
  } catch {
    // Columns not there yet: initials avatars everywhere.
  }

  const enriched: Comment[] = base.map((c) => {
    const avatar = avatarByUser.get(c.user_id);
    return {
      ...c,
      parent_id: parentById.get(c.id) ?? null,
      like_count: likeCountById.get(c.id) ?? 0,
      liked_by_me: likedByMe.has(c.id),
      avatar_preset: avatar?.avatar_preset ?? null,
      avatar_url: avatar?.avatar_url ?? null,
    };
  });

  // Assemble threads. A comment is top-level when it has no parent or
  // its parent is not in the approved set (e.g. still pending); any
  // other comment belongs to its top ancestor's thread.
  const byId = new Map(enriched.map((c) => [c.id, c]));
  function rootOf(comment: Comment): Comment {
    let current = comment;
    const seen = new Set<string>([current.id]);
    while (current.parent_id) {
      const parent = byId.get(current.parent_id);
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      current = parent;
    }
    return current;
  }

  const threads: ThreadComment[] = [];
  const threadByRootId = new Map<string, ThreadComment>();
  for (const c of enriched) {
    if (rootOf(c) === c) {
      const thread: ThreadComment = { ...c, replies: [] };
      threads.push(thread);
      threadByRootId.set(c.id, thread);
    }
  }
  for (const c of enriched) {
    const root = rootOf(c);
    if (root === c) continue;
    const thread = threadByRootId.get(root.id);
    if (thread) {
      thread.replies.push({ ...c, replies: [] });
    } else {
      // Defensive: the root was classified top-level above, so this
      // should not happen; keep the comment visible regardless.
      const thread2: ThreadComment = { ...c, replies: [] };
      threads.push(thread2);
      threadByRootId.set(c.id, thread2);
    }
  }
  // Top-level stays newest first (the base query's order); replies
  // read oldest first, like a conversation.
  for (const thread of threads) {
    thread.replies.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return { threads, totalApproved };
}

/** Like or un-like a comment (Phase 5.2). Runs in the browser with
 *  the user's session, so the comment_likes RLS policies (insert and
 *  delete only your own rows) apply. Throws an Error with the
 *  database message on failure (before the Phase 5.2 SQL runs, the
 *  table simply does not exist and this always throws). */
export async function toggleCommentLike(
  commentId: string,
  userId: string,
  currentlyLiked: boolean,
): Promise<void> {
  const supabase = getBrowserSupabase();
  if (currentlyLiked) {
    const { error } = await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("comment_likes")
      .insert({ comment_id: commentId, user_id: userId });
    if (error) throw new Error(error.message);
  }
}

/** Post a comment or a reply (Phase 5.2). The row is saved as pending
 *  (the database default and the insert policy both enforce it) and
 *  only appears once an admin approves it. A reply inserts parent_id
 *  and throws if that fails; a top-level comment inserts without the
 *  parent_id key, so it works before and after the Phase 5.2 SQL. */
export async function postComment(
  filmSlug: string,
  userId: string,
  body: string,
  parentId: string | null,
): Promise<Comment> {
  const supabase = getBrowserSupabase();
  const row: Record<string, unknown> = {
    film_slug: filmSlug,
    body,
    user_id: userId,
  };
  if (parentId) {
    row.parent_id = parentId;
  }
  const { data, error } = await supabase
    .from("comments")
    .insert(row)
    .select("id,film_slug,body,status,user_id,created_at")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return { ...(data as unknown as Comment), profiles: null };
}
