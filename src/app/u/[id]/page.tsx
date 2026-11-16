import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import { createSupabaseClient } from "@/lib/supabase";

/** A member's public profile: name, picture, bio, the month they
 *  joined, and their approved comments. Nothing private: no email, no
 *  watchlist, no viewing history. Banned members have no public page.
 *  Kept out of search results; it exists for members, not for Google. */
export const revalidate = 60;

type PublicProfile = {
  id: string;
  display_name: string;
  avatar_preset: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  comment_count: number;
  comments: {
    id: string;
    body: string;
    created_at: string;
    film_slug: string;
    film_title: string;
  }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string): Promise<PublicProfile | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await createSupabaseClient().rpc("public_profile", {
    p_id: id,
  });
  if (error || !data) return null;
  return data as PublicProfile;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await load(id);
  return {
    title: profile ? `${profile.display_name} — Tohu Movies` : "Member — Tohu Movies",
    robots: { index: false, follow: true },
  };
}

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await load(id);
  if (!profile) notFound();

  return (
    <div className="wrap member-wrap">
      <header className="member-head">
        <Avatar
          preset={profile.avatar_preset}
          url={profile.avatar_url}
          name={profile.display_name}
          size={96}
        />
        <div>
          <h1 className="member-name">{profile.display_name}</h1>
          <p className="member-meta">
            Member since {monthYear(profile.created_at)} ·{" "}
            {profile.comment_count} comment
            {profile.comment_count === 1 ? "" : "s"}
          </p>
          {profile.bio ? <p className="member-bio">{profile.bio}</p> : null}
        </div>
      </header>

      <section aria-label="Comments">
        <h2 className="member-h2">Recent comments</h2>
        {profile.comments.length === 0 ? (
          <p className="empty show">No comments yet.</p>
        ) : (
          <ul className="member-comments">
            {profile.comments.map((c) => (
              <li key={c.id}>
                <p className="member-comment-head">
                  On <Link href={`/films/${c.film_slug}`}>{c.film_title}</Link>
                  <time dateTime={c.created_at}>{shortDate(c.created_at)}</time>
                </p>
                <p className="comment-body">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="auth-foot">
        <Link href="/">← Back to films</Link>
      </p>
    </div>
  );
}
