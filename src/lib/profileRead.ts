import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./types";

/** Read a signed-in user's profile row plus their admin status.
 *
 *  The admin flag is asked of the database's own is_admin() function
 *  (which answers only for the caller), never read as a column, so the
 *  is_admin column can be hidden from the public API (see
 *  supabase/migrations/20261115_privacy_hardening.sql). If that
 *  function is unavailable, this falls back to the column, which
 *  still works on a database where the hardening has not run yet. */
export async function readProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  // Both lookups go out together, so this costs one round trip.
  const [row, viaFunction] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,display_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("is_admin"),
  ]);
  if (row.error || !row.data) return null;
  const base = row.data as { id: string; display_name: string };

  let isAdmin = false;
  if (!viaFunction.error) {
    isAdmin = viaFunction.data === true;
  } else {
    const viaColumn = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();
    isAdmin =
      !viaColumn.error &&
      (viaColumn.data as { is_admin?: boolean } | null)?.is_admin === true;
  }
  return { ...base, is_admin: isAdmin };
}
