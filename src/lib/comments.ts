import { createSupabaseClient } from "./supabase";
import { embeddedOne } from "./types";
import type { Comment } from "./types";

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
