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
  /** Re-read the profile row (after the user edits their display name
   *  on the profile page, so the header updates at once). */
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  user: null,
  profile: null,
  isAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => {},
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
    const base = (data ?? null) as Profile | null;
    setProfile(base);
    if (!base) return;
    // Avatar columns arrive with the Phase 5.2 SQL; until then this
    // select errors and the profile simply has no avatar fields (the
    // UI falls back to initials). Tolerant on purpose: never let an
    // avatar read break sign-in state.
    let columnsRead = false;
    try {
      const { data: avatarData, error: avatarError } = await supabase
        .from("profiles")
        .select("avatar_preset,avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (!avatarError && avatarData) {
        columnsRead = true;
        const row = avatarData as {
          avatar_preset?: string | null;
          avatar_url?: string | null;
        };
        setProfile((prev) =>
          prev && prev.id === userId
            ? {
                ...prev,
                avatar_preset: row.avatar_preset ?? null,
                avatar_url: row.avatar_url ?? null,
              }
            : prev,
        );
      }
    } catch {
      // Columns not there yet; metadata fallback below.
    }
    if (columnsRead) return;
    // Pre-SQL fallback: an avatar chosen on the profile page before
    // the columns existed was saved into auth user metadata instead.
    // Reflect it so the header and composer still show the choice.
    // (Once the columns exist they win outright, even when null: a
    // cleared avatar must stay cleared.)
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const md = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
      const metaPreset =
        typeof md.avatar_preset === "string" ? md.avatar_preset : null;
      const metaUrl =
        typeof md.avatar_url === "string" ? md.avatar_url : null;
      if (metaPreset || metaUrl) {
        setProfile((prev) =>
          prev && prev.id === userId
            ? { ...prev, avatar_preset: metaPreset, avatar_url: metaUrl }
            : prev,
        );
      }
    } catch {
      // No metadata avatar; initials fallback applies.
    }
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

  const refreshProfile = useCallback(async () => {
    const supabase = getBrowserSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      profile,
      isAdmin: profile?.is_admin === true,
      signOut,
      refreshProfile,
    }),
    [loading, user, profile, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
