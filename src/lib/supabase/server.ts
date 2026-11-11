import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../site";
import type { Profile } from "../types";

/** Server-side client with the request's session (Server Components,
 *  Route Handlers, Server Actions). Cookie-based (via @supabase/ssr):
 *  RLS policies apply per signed-in user, and anonymous reads behave
 *  exactly like the public anon client. Anon-key only. */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll is called from a Server Component, where setting
          // cookies is not allowed; the proxy refreshes the session
          // instead, so this is safe to ignore.
        }
      },
    },
  });
}

export type ServerAuth = {
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  isAdmin: boolean;
};

/** The signed-in user (if any) plus their profile row, for server code.
 *  Never throws on a missing session: an anonymous visitor gets nulls. */
export async function getServerAuth(): Promise<ServerAuth> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { userId: null, email: null, profile: null, isAdmin: false };
  }
  const { data } = await supabase
    .from("profiles")
    .select("id,display_name,is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const profile = (data ?? null) as Profile | null;
  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    isAdmin: profile?.is_admin === true,
  };
}
