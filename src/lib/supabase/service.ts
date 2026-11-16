import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/site";

/** A database client with the site's private service key, for jobs
 *  that run with nobody signed in (the daily email run). Server only:
 *  the key lives in Vercel as SUPABASE_SERVICE_ROLE_KEY and must never
 *  reach the browser. Returns null when the key is not set. */
export function createServiceSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
