"use client";

import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

/** Signed-in state for the whole app (header, film pages, player).
 *  The session lives in cookies (via @supabase/ssr), so the server sees
 *  the same session the browser does. The profile row (display name and
 *  is_admin) is read from the profiles table once a session exists.
 *  Anonymous visitors get user null; nothing here requires a sign-in. */

type AuthContextValue = {
  /** True while the initial session check is running. */
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  user: null,
  profile: null,
  isAdmin: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const router = useRouter();

  const loadProfile = useCallback(async (userId: string) => {
    const supabase = getBrowserSupabase();
    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,is_admin")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data ?? null) as Profile | null);
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
      }
      if (!cancelled) setLoading(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
    );

    void init();
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    const supabase = getBrowserSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.refresh();
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      profile,
      isAdmin: profile?.is_admin === true,
      signOut,
    }),
    [loading, user, profile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
