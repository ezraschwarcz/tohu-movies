export type Film = {
  slug: string;
  title: string;
  year: number;
  /** Comma-separated genre list, e.g. "Horror, Thriller, Fantasy". */
  genre: string;
  director: string;
  /** Comma-separated cast list. The database column is cast_text because
   *  `cast` is a reserved word in Postgres. */
  cast_text: string;
  /** "PG 13" | "R" | "PG" | "NR" | "TV PG" */
  rating: string;
  runtime_minutes: number;
  synopsis: string;
  warnings: string;
  playback_id: string;
  created_at: string;
};

export type RatingSummary = {
  average: number;
  count: number;
};

/** film slug -> shared average and count. A plain record (not a Map) so
 *  it stays serializable through Next.js caching. */
export type RatingsRecord = Record<string, RatingSummary>;

export type SortKey = "newest" | "top-rated" | "az";

/** PostgREST embeds a many-to-one relation as a single object, but the
 *  client types it as an array. Normalize either shape to one or null. */
export function embeddedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** A signed-in user's profile row. is_admin is only ever set by hand in
 *  the database; the app never lets a user change their own. */
export type Profile = {
  id: string;
  display_name: string;
  is_admin: boolean;
  /** Phase 5.2 avatar choice: a preset id (lib/avatars.ts) and/or an
   *  uploaded photo URL. Optional because the columns only exist once
   *  the Phase 5.2 SQL has run; readers tolerate them being absent. */
  avatar_preset?: string | null;
  avatar_url?: string | null;
};

/** One comment, with the commenter's display name joined from profiles.
 *  Only approved comments are readable by everyone; pending and rejected
 *  ones are visible to admins only (Phase 2 migration SQL). */
export type Comment = {
  id: string;
  film_slug: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  user_id: string;
  created_at: string;
  profiles: { display_name: string } | null;
  /** Phase 5.2 threading and likes, flattened onto the comment by
   *  lib/comments.ts (they come from separate tolerant queries, not
   *  the base select, so the thread still loads before the Phase 5.2
   *  SQL has run: parent_id null, like_count 0, liked_by_me false).
   *  avatar_* are the commenter's avatar, copied from their profile. */
  parent_id?: string | null;
  like_count?: number;
  liked_by_me?: boolean;
  avatar_preset?: string | null;
  avatar_url?: string | null;
};

/** A top-level comment with its replies (Phase 5.2). Replies are
 *  flattened to one level, YouTube-style: a reply to a reply belongs
 *  to the same thread, under the top-level ancestor. */
export type ThreadComment = Comment & { replies: ThreadComment[] };

/** One continue-watching row, with the film joined. Owner only. */
export type ContinueWatchingEntry = {
  film_slug: string;
  position_seconds: number;
  duration_seconds: number;
  updated_at: string;
  films: Film | null;
};
