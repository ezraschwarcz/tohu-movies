"use client";

import { useEffect, useState } from "react";
import {
  EMAIL_PREF_LABELS,
  ensureEmailPrefs,
  type EmailPrefs as Prefs,
} from "@/lib/emailPrefs";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Email settings on the profile page: one switch per kind of email.
 *  Each change saves on its own. If the email preferences table is
 *  not set up yet, the section explains that instead of failing. */
export default function EmailPrefs({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [saving, setSaving] = useState<keyof Prefs | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = getBrowserSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const row = await ensureEmailPrefs(
        supabase,
        userId,
        (user?.user_metadata ?? {}) as Record<string, unknown>,
      );
      if (cancelled) return;
      if (!row) {
        setState("unavailable");
        return;
      }
      setPrefs({
        friday_pick: row.friday_pick,
        new_films: row.new_films,
        replies: row.replies,
        reminders: row.reminders,
      });
      setState("ready");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggle(key: keyof Prefs, value: boolean) {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setSaving(key);
    setNote(null);
    setError(null);
    const { error: err } = await getBrowserSupabase()
      .from("email_prefs")
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    setSaving(null);
    if (err) {
      setPrefs(previous);
      setError("That change could not be saved. Please try again.");
    } else {
      setNote("Saved.");
    }
  }

  return (
    <div className="email-prefs">
      <h3 className="profile-h3">Email</h3>
      {state === "loading" ? (
        <p className="form-note">Loading your email settings…</p>
      ) : state === "unavailable" ? (
        <p className="form-note">
          Email settings are not available yet. Sign-in and account emails
          are unaffected.
        </p>
      ) : (
        <>
          {EMAIL_PREF_LABELS.map(({ key, title, hint }) => (
            <label className="toggle-row" key={key}>
              <input
                type="checkbox"
                checked={prefs?.[key] ?? false}
                disabled={saving === key}
                onChange={(e) => void toggle(key, e.target.checked)}
              />
              <span>
                {title}
                <span className="toggle-hint">{hint}</span>
              </span>
            </label>
          ))}
          <p className="form-note">
            Account emails, like sign-in links and password resets, are
            always sent when you ask for them.
          </p>
          {note ? (
            <p className="form-note" role="status">
              {note}
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
