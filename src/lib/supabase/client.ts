import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../site";

/** Browser client singleton, for client components that sign in, write
 *  (comments, watchlist, continue watching, ratings), or read the
 *  session. Cookie-based (via @supabase/ssr), so the session is shared
 *  with the server: the proxy refreshes it, and server components read
 *  it from the same cookies. Anon-key only; never the service_role key. */
let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}
