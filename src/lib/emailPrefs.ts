import type { SupabaseClient } from "@supabase/supabase-js";

/** Which emails a member wants. Optional emails (Friday Pick, new
 *  films) start off; activity emails (replies, reminders) start on. */
export type EmailPrefs = {
  friday_pick: boolean;
  new_films: boolean;
  replies: boolean;
  reminders: boolean;
};

export type EmailPrefsRow = EmailPrefs & {
  user_id: string;
  unsub_token: string;
  welcomed_at: string | null;
  optin_asked_at: string | null;
};

export const EMAIL_PREF_LABELS: {
  key: keyof EmailPrefs;
  title: string;
  hint: string;
}[] = [
  {
    key: "friday_pick",
    title: "The Friday Pick",
    hint: "One handpicked film in your inbox every Friday.",
  },
  {
    key: "new_films",
    title: "New film alerts",
    hint: "A note when films are added. Never more than one email a day.",
  },
  {
    key: "replies",
    title: "Replies and likes",
    hint: "When someone replies to or likes your comment, or your comment goes live.",
  },
  {
    key: "reminders",
    title: "Reminders",
    hint: "A nudge to finish a film you started, and what's new if you've been away.",
  },
];

const COLUMNS =
  "user_id,friday_pick,new_films,replies,reminders,unsub_token,welcomed_at,optin_asked_at";

/** The member's row, created on first use. The choices ticked at
 *  sign-up (kept in the account's metadata as `email_optin`) seed the
 *  new row. Returns null if the table is not there yet (the email
 *  preferences SQL has not run) or anything else goes wrong: callers
 *  treat that as "email settings unavailable", never as an error. */
export async function ensureEmailPrefs(
  supabase: SupabaseClient,
  userId: string,
  metadata?: Record<string, unknown>,
): Promise<EmailPrefsRow | null> {
  try {
    const existing = await supabase
      .from("email_prefs")
      .select(COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.error) return null;
    if (existing.data) return existing.data as EmailPrefsRow;

    const optin = (metadata?.email_optin ?? {}) as Partial<EmailPrefs>;
    const created = await supabase
      .from("email_prefs")
      .insert({
        user_id: userId,
        friday_pick: optin.friday_pick === true,
        new_films: optin.new_films === true,
        replies: true,
        reminders: true,
      })
      .select(COLUMNS)
      .maybeSingle();
    if (created.error || !created.data) return null;
    return created.data as EmailPrefsRow;
  } catch {
    return null;
  }
}
