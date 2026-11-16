import type { Metadata } from "next";
import { redirect } from "next/navigation";
import WelcomeForm from "@/components/WelcomeForm";
import { getServerAuth } from "@/lib/supabase/server";
import { isPlaceholderName, safeNext } from "@/lib/onboarding";

/** The one-time step after a new member's first sign-in: pick a name
 *  and photo, choose emails, and turn on Face ID / fingerprint for
 *  next time. Everything here is optional and can be skipped. */
export const metadata: Metadata = {
  title: "Welcome — Tohu Movies",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const { userId, profile } = await getServerAuth();
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const current = profile?.display_name ?? "";
  return (
    <WelcomeForm
      userId={userId}
      next={next}
      initialName={isPlaceholderName(current) ? "" : current}
    />
  );
}
