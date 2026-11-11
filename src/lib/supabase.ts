import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./site";

/** Server-side client (Server Components, generateStaticParams,
 *  generateMetadata). Uses only the public anon key; there is no auth in
 *  Phase 1, so no cookies or session handling here. */
export function createSupabaseClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/** Browser client singleton, for client components that write (star
 *  ratings). Also anon-key only. */
let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}
