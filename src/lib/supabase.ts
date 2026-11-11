import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./site";
import { getBrowserSupabase as getSsrBrowserSupabase } from "./supabase/client";

/** Server-side client (Server Components, generateStaticParams,
 *  generateMetadata). Uses only the public anon key; there is no auth in
 *  this client, so no cookies or session handling here. Public data reads
 *  (films, ratings, approved comments) use this client. */
export function createSupabaseClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/** Browser client singleton, for client components that write (star
 *  ratings) or sign in. Cookie-based (via @supabase/ssr) since Phase 2,
 *  so the session is shared with the server; the proxy refreshes it.
 *  Anon-key only. */
export function getBrowserSupabase(): SupabaseClient {
  return getSsrBrowserSupabase();
}
