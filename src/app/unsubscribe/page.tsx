import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";

/** One-click unsubscribe, reached from the link at the foot of an
 *  email. Works without signing in: the link carries the member's
 *  private token, and the database turns off that kind of email. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
};

const KIND_LABELS: Record<string, string> = {
  friday_pick: "the Friday Pick",
  new_films: "new film alerts",
  replies: "reply and like emails",
  reminders: "reminder emails",
  all: "all optional emails",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; k?: string }>;
}) {
  const { t, k } = await searchParams;
  let done: string | null = null;
  if (t && UUID.test(t)) {
    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.rpc("unsubscribe_email", {
        p_token: t,
        p_kind: k ?? "all",
      });
      if (!error && typeof data === "string") done = data;
    } catch {
      // falls through to the "could not" message
    }
  }

  return (
    <div className="wrap">
      <div className="not-found">
        {done ? (
          <>
            <h1>You&apos;re unsubscribed</h1>
            <p>
              You won&apos;t get {KIND_LABELS[done] ?? "those emails"} from Tohu
              Movies any more. Account emails, like sign-in links, still
              arrive when you ask for them.
            </p>
          </>
        ) : (
          <>
            <h1>That link didn&apos;t work</h1>
            <p>
              The unsubscribe link may be incomplete. You can change every
              email setting from your profile.
            </p>
          </>
        )}
        <p className="error-actions">
          <Link href="/profile?view=preferences" className="btn-ghost">
            Email settings
          </Link>
          <Link href="/" className="play-btn">
            Back to films
          </Link>
        </p>
      </div>
    </div>
  );
}
