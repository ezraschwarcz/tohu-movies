import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** Auth callback: the landing page for magic-link sign-ins and email
 *  confirmations. Supabase redirects here with a `code`, which is
 *  exchanged for a session (the session cookies are set on the redirect
 *  response), and the visitor is sent on to `next` (default /). A bad or
 *  expired link sends the visitor back to /login with an error. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription ?? error)}`,
    );
  }

  if (code) {
    const supabase = await createServerSupabase();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      // Only allow relative destinations (no open redirect).
      const redirectTo = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=signin-link`);
}
