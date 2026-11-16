import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { needsWelcome, placeholderName, safeNext } from "@/lib/onboarding";

/** Where links in Tohu emails land (confirm, sign-in link, password
 *  reset). Two kinds of link are understood:
 *
 *  - `token_hash` + `type`: works in ANY browser or device, because the
 *    proof is in the link itself. This is the kind the email templates
 *    should use.
 *  - `code`: the older kind. It only works in the same browser that
 *    asked for the email, so a link opened from a mail app often
 *    failed. Still accepted so emails already sent keep working.
 *
 *  A brand-new member goes to /welcome once to pick a name and photo.
 *  A failed or expired link sends the visitor back to /login. */
const OTP_TYPES: EmailOtpType[] = [
  "email",
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email_change",
];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription ?? error)}`,
    );
  }

  const supabase = await createServerSupabase();
  let ok = false;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    ok = !verifyError;
  } else if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    ok = !exchangeError;
  }

  if (!ok) {
    return NextResponse.redirect(`${origin}/login?error=signin-link`);
  }

  // Password resets go straight to the new-password page.
  const dest = type === "recovery" ? "/auth/reset-password" : next;
  if (!dest.startsWith("/auth/")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && needsWelcome(user)) {
      // A new Google account arrives with no display name of ours. If
      // the database filled one in from the email address, replace it
      // with the first name from Google (or a neutral placeholder), so
      // no part of an email address ever shows on a public comment.
      if (user.app_metadata?.provider === "google" && user.email) {
        const local = user.email.split("@")[0].toLowerCase();
        const { data: row } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        const current = (
          (row as { display_name?: string } | null)?.display_name ?? ""
        ).trim();
        if (!current || current.toLowerCase() === local || current.includes("@")) {
          const full = String(
            user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
          ).trim();
          const name = (full.split(/\s+/)[0] || placeholderName()).slice(0, 60);
          await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
        }
      }
      return NextResponse.redirect(
        `${origin}/welcome?next=${encodeURIComponent(dest)}`,
      );
    }
  }
  return NextResponse.redirect(`${origin}${dest}`);
}
