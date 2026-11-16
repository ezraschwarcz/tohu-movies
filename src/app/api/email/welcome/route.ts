import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail, type EmailFilm } from "@/lib/email/templates";
import { ensureEmailPrefs } from "@/lib/emailPrefs";
import { getFilms, getViewCounts } from "@/lib/films";
import { officialPosterFor } from "@/lib/posters";
import { SITE_URL } from "@/lib/site";
import { createServerSupabase } from "@/lib/supabase/server";

/** Sends the welcome email, once, to the signed-in member who calls
 *  it. The address comes from their own session, so nobody can use
 *  this to email anyone else. Only accounts created in the last seven
 *  days qualify: members who joined before this feature existed are
 *  marked as welcomed without being emailed. Called by the site right
 *  after sign-in; safe to call repeatedly. */
export const dynamic = "force-dynamic";

const NEW_MEMBER_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ status: "signed-out" }, { status: 401 });
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const prefs = await ensureEmailPrefs(supabase, user.id, metadata);
  if (!prefs) {
    // Email preferences table not set up yet.
    return NextResponse.json({ status: "unavailable" });
  }
  if (prefs.welcomed_at) {
    return NextResponse.json({ status: "already" });
  }

  // Email not switched on yet (no sending key in Vercel): leave the
  // member unwelcomed, so the email goes out once it is.
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ status: "skipped" });
  }

  // Claim it first, so two tabs opening at once cannot both send.
  const claim = await supabase
    .from("email_prefs")
    .update({ welcomed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("welcomed_at", null)
    .select("user_id");
  if (claim.error || (claim.data ?? []).length === 0) {
    return NextResponse.json({ status: "already" });
  }

  const createdAt = user.created_at ? Date.parse(user.created_at) : 0;
  if (!createdAt || Date.now() - createdAt > NEW_MEMBER_MS) {
    return NextResponse.json({ status: "not-new" });
  }

  let picks: EmailFilm[] = [];
  try {
    const [films, views] = await Promise.all([getFilms(), getViewCounts()]);
    const ranked = [...films].sort(
      (a, b) => (views[b.slug] ?? 0) - (views[a.slug] ?? 0),
    );
    picks = ranked.slice(0, 3).map((f) => {
      const art = officialPosterFor(f.slug);
      return {
        slug: f.slug,
        title: f.title,
        year: f.year,
        poster: art ? `${SITE_URL}${art}` : null,
      };
    });
  } catch {
    // The email still goes out, without the film picks.
  }

  const name =
    (typeof metadata.display_name === "string" && metadata.display_name) || "";
  const message = welcomeEmail({
    name,
    films: picks,
    preferencesUrl: `${SITE_URL}/profile?view=preferences`,
  });
  const result = await sendEmail({ to: user.email, ...message });
  if (!result.ok && !result.skipped) {
    // Let a later sign-in try again.
    await supabase
      .from("email_prefs")
      .update({ welcomed_at: null })
      .eq("user_id", user.id);
    return NextResponse.json({ status: "failed" }, { status: 502 });
  }
  return NextResponse.json({ status: result.ok ? "sent" : "skipped" });
}
