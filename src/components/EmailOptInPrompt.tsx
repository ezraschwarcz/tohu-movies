"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ensureEmailPrefs } from "@/lib/emailPrefs";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

/** A one-time invitation to get Tohu's optional emails, for signed-in
 *  members who are not getting either of them (everyone who joined
 *  before the sign-up form offered the choice, and anyone who skipped
 *  it). It is a small card in the corner, never a blocking pop-up.
 *
 *  Rules: shown only on the home and watchlist pages, a few seconds
 *  after arriving; nothing is pre-ticked, and nothing is turned on
 *  unless the member presses the button; whichever way they answer,
 *  the answer is recorded on their account and they are never asked
 *  again, on any device. */

const SHOW_ON = new Set(["/", "/watchlist"]);
const DELAY_MS = 4000;

export function EmailOptInCard({
  busy,
  onAccept,
  onDecline,
}: {
  busy: boolean;
  onAccept: (choice: { friday_pick: boolean; new_films: boolean }) => void;
  onDecline: () => void;
}) {
  const [fridayPick, setFridayPick] = useState(false);
  const [newFilms, setNewFilms] = useState(false);
  const none = !fridayPick && !newFilms;
  return (
    <aside className="optin-card" aria-labelledby="optin-card-title">
      <h2 id="optin-card-title">One great free film, every Friday</h2>
      <p>
        Want Tohu in your inbox? Pick what you&apos;d like. You can change
        it any time in your profile.
      </p>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={fridayPick}
          onChange={(e) => setFridayPick(e.target.checked)}
        />
        <span>
          The Friday Pick
          <span className="toggle-hint">One handpicked film a week.</span>
        </span>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={newFilms}
          onChange={(e) => setNewFilms(e.target.checked)}
        />
        <span>
          New film alerts
          <span className="toggle-hint">A note when films are added.</span>
        </span>
      </label>
      <div className="optin-card-actions">
        <button type="button" className="btn-ghost" onClick={onDecline} disabled={busy}>
          No thanks
        </button>
        <button
          type="button"
          className="play-btn"
          onClick={() => onAccept({ friday_pick: fridayPick, new_films: newFilms })}
          disabled={busy || none}
        >
          {busy ? "Saving…" : "Sign me up"}
        </button>
      </div>
    </aside>
  );
}

export default function EmailOptInPrompt() {
  const { loading, user } = useAuth();
  const pathname = usePathname();
  // The prompt belongs to the page and person it was shown for: moving
  // to another page or signing out hides it without an extra draw.
  const [shownFor, setShownFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const userId = user?.id ?? null;
  const showKey = `${userId}|${pathname}`;
  const show = shownFor === showKey;

  useEffect(() => {
    if (loading || !userId || !SHOW_ON.has(pathname)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const supabase = getBrowserSupabase();
      const {
        data: { user: current },
      } = await supabase.auth.getUser();
      const row = await ensureEmailPrefs(
        supabase,
        userId,
        (current?.user_metadata ?? {}) as Record<string, unknown>,
      );
      if (cancelled || !row) return;
      if (row.optin_asked_at || row.friday_pick || row.new_films) return;
      setShownFor(`${userId}|${pathname}`);
    }, DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, userId, pathname]);

  async function answer(choice: { friday_pick: boolean; new_films: boolean } | null) {
    if (!userId) return;
    setBusy(true);
    const now = new Date().toISOString();
    await getBrowserSupabase()
      .from("email_prefs")
      .update({
        ...(choice ?? {}),
        optin_asked_at: now,
        updated_at: now,
      })
      .eq("user_id", userId);
    setBusy(false);
    setShownFor(null);
  }

  if (!show) return null;
  return (
    <EmailOptInCard
      busy={busy}
      onAccept={(choice) => void answer(choice)}
      onDecline={() => void answer(null)}
    />
  );
}
