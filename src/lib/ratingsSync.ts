import type { SupabaseClient } from "@supabase/supabase-js";

/** Ties this device's star ratings to the signed-in account, and
 *  brings the account's ratings onto this device, so a member sees
 *  their stars wherever they sign in. Runs once per session. Quietly
 *  does nothing before the profile database update has been run. */
const OWN_KEY = "tohu-ratings-v1";
const VOTER_KEY = "tohu-voter-id-v1";
export const RATINGS_SYNCED_EVENT = "tohu-ratings-synced";

export async function syncAccountRatings(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  try {
    const flag = `tohu-ratings-synced-${userId}`;
    if (window.sessionStorage.getItem(flag)) return;
    window.sessionStorage.setItem(flag, "1");
    let voter = window.localStorage.getItem(VOTER_KEY);
    if (!voter) {
      voter = crypto.randomUUID();
      window.localStorage.setItem(VOTER_KEY, voter);
    }
    const claim = await supabase.rpc("claim_my_ratings", { p_voter: voter });
    if (claim.error) return;
    const mine = await supabase.rpc("my_film_ratings", { p_voter: voter });
    if (mine.error || !Array.isArray(mine.data)) return;
    const local: Record<string, number> = {};
    for (const row of mine.data as { film_slug: string; stars: number }[]) {
      local[row.film_slug] = row.stars;
    }
    window.localStorage.setItem(OWN_KEY, JSON.stringify(local));
    window.dispatchEvent(new Event(RATINGS_SYNCED_EVENT));
  } catch {
    // Storage blocked or offline: ratings simply stay per-device.
  }
}
