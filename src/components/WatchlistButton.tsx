"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Save a film to the signed-in user's watchlist (or remove it). Signed
 *  out, the button links to sign in. The watchlist table only ever holds
 *  the owner's own rows (RLS), so nothing here can touch another user's
 *  list. */

export default function WatchlistButton({
  filmSlug,
  filmTitle,
  compact = false,
}: {
  filmSlug: string;
  filmTitle: string;
  compact?: boolean;
}) {
  const { loading, user } = useAuth();
  const pathname = usePathname();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setSaved(null);
      return;
    }
    let cancelled = false;
    const userId = user.id;
    async function load() {
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from("watchlist")
        .select("film_slug")
        .eq("user_id", userId)
        .eq("film_slug", filmSlug)
        .maybeSingle();
      if (!cancelled) setSaved(data !== null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, filmSlug]);

  const toggle = useCallback(async () => {
    if (!user || saved === null) return;
    setBusy(true);
    const supabase = getBrowserSupabase();
    if (saved) {
      const { error } = await supabase
        .from("watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("film_slug", filmSlug);
      if (!error) setSaved(false);
    } else {
      const { error } = await supabase
        .from("watchlist")
        .insert({ user_id: user.id, film_slug: filmSlug });
      if (!error) setSaved(true);
    }
    setBusy(false);
  }, [user, saved, filmSlug]);

  if (loading) {
    return (
      <button
        type="button"
        className={`watchlist-btn${compact ? " compact" : ""}`}
        disabled
        aria-label="Loading watchlist"
      >
        …
      </button>
    );
  }

  if (!user) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className={`watchlist-btn${compact ? " compact" : ""}`}
        title="Sign in to save this film to your watchlist"
      >
        ＋ Watchlist
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`watchlist-btn${compact ? " compact" : ""}${saved ? " saved" : ""}`}
      aria-pressed={saved === true}
      aria-label={
        saved ? `Remove ${filmTitle} from your watchlist` : `Save ${filmTitle} to your watchlist`
      }
      disabled={busy || saved === null}
      onClick={() => void toggle()}
    >
      {saved ? "✓ In watchlist" : "＋ Watchlist"}
    </button>
  );
}
