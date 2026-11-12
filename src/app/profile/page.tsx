import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase, getServerAuth } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

export const metadata: Metadata = {
  title: "Your profile — Tohu Movies",
  description: "Your Tohu Movies profile: display name, preferences, watchlist, and passkeys.",
  robots: { index: false, follow: true },
};

/** Profile page. Protected: signed-out visitors are sent to /login.
 *  This page is dynamic: it reads the session from the request's
 *  cookies. The watchlist count is read on the server; the rated films
 *  and passkeys are read in the browser (ratings are anonymous per
 *  device, and passkeys are managed through the auth client). */
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { userId, email, profile } = await getServerAuth();

  if (!userId) {
    redirect("/login?next=/profile");
  }

  const supabase = await createServerSupabase();
  const { count } = await supabase
    .from("watchlist")
    .select("film_slug", { count: "exact", head: true })
    .eq("user_id", userId);

  return (
    <ProfileForm
      userId={userId}
      email={email ?? ""}
      displayName={profile?.display_name ?? ""}
      watchlistCount={count ?? 0}
    />
  );
}
