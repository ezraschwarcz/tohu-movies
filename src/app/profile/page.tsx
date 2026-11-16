import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase, getServerAuth } from "@/lib/supabase/server";
import {
  favoriteGenresFromMetadata,
  passwordSetFromMetadata,
} from "@/lib/profile";
import { genreChips, getFilms } from "@/lib/films";
import ProfileForm from "@/components/ProfileForm";
import {
  ProfileBody,
  ProfileHeader,
  type ProfileSummary,
  type ProfileTab,
} from "@/components/ProfileHome";

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

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const query = await searchParams;
  const { userId, email, profile, isAdmin, userMetadata } =
    await getServerAuth();

  if (!userId) {
    redirect("/login?next=/profile");
  }

  const supabase = await createServerSupabase();
  // ?view=... (links from the account menu and emails) always opens
  // Settings; otherwise ?tab=... picks the tab, Overview by default.
  const tab: ProfileTab = query.view
    ? "settings"
    : query.tab === "history" || query.tab === "ratings" || query.tab === "settings"
      ? query.tab
      : "overview";
  const summaryResult = await supabase.rpc("my_profile_summary");
  const summary = summaryResult.error
    ? null
    : (summaryResult.data as ProfileSummary | null);

  const [{ count }, films] = await Promise.all([
    supabase
      .from("watchlist")
      .select("film_slug", { count: "exact", head: true })
      .eq("user_id", userId),
    getFilms(),
  ]);
  const allGenres = genreChips(films).map(({ genre }) => genre);
  const metadataName =
    typeof userMetadata.display_name === "string"
      ? userMetadata.display_name
      : "";

  const avatarPreset =
    profile?.avatar_preset ??
    (typeof userMetadata.avatar_preset === "string" ? userMetadata.avatar_preset : null);
  const avatarUrl =
    profile?.avatar_url ??
    (typeof userMetadata.avatar_url === "string" ? userMetadata.avatar_url : null);

  return (
    <div className="wrap ph-wrap">
      <ProfileHeader
        userId={userId}
        name={profile?.display_name ?? metadataName}
        avatarPreset={avatarPreset}
        avatarUrl={avatarUrl}
        summary={summary}
        tab={tab}
      />
      {tab === "settings" ? (
        <ProfileForm
          userId={userId}
          email={email ?? ""}
          displayName={profile?.display_name ?? metadataName}
          watchlistCount={count ?? 0}
          isAdmin={isAdmin}
          initialPasswordSet={passwordSetFromMetadata(userMetadata)}
          initialGenres={favoriteGenresFromMetadata(userMetadata)}
          allGenres={allGenres}
          initialAvatarPreset={
            typeof userMetadata.avatar_preset === "string"
              ? userMetadata.avatar_preset
              : null
          }
          initialAvatarUrl={
            typeof userMetadata.avatar_url === "string"
              ? userMetadata.avatar_url
              : null
          }
        />
      ) : (
        <ProfileBody tab={tab} summary={summary} />
      )}
    </div>
  );
}
