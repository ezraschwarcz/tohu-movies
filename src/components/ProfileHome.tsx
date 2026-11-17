import Link from "next/link";
import Avatar from "./Avatar";
import HistoryList, { type HistoryRow } from "./HistoryList";
import { coverArtFor } from "@/lib/posters";

/** The profile's front page: who you are, your numbers, and tabs for
 *  what you have watched and rated. Settings (name, photo, sign-in,
 *  emails, privacy) live in their own tab. */

export type ProfileSummary = {
  member_since: string;
  bio: string | null;
  watchlist: number;
  comments: number;
  rated: number;
  started: number;
  finished: number;
  minutes: number;
  history: HistoryRow[];
  ratings: {
    film_slug: string;
    title: string;
    year: number;
    poster_url: string | null;
    stars: number;
    updated_at: string;
  }[];
  recent_comments: {
    id: string;
    body: string;
    status: string;
    created_at: string;
    film_slug: string;
    film_title: string;
  }[];
};

export type ProfileTab = "overview" | "history" | "ratings" | "settings";

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "history", label: "History" },
  { id: "ratings", label: "Ratings" },
  { id: "settings", label: "Settings" },
];

function hours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = minutes / 60;
  return `${h >= 10 ? Math.round(h) : h.toFixed(1)} hr`;
}

export function ProfileHeader({
  userId,
  name,
  avatarPreset,
  avatarUrl,
  summary,
  tab,
}: {
  userId: string;
  name: string;
  avatarPreset: string | null;
  avatarUrl: string | null;
  summary: ProfileSummary | null;
  tab: ProfileTab;
}) {
  const since = summary?.member_since
    ? new Date(summary.member_since).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;
  const stats = summary
    ? [
        { label: "Films watched", value: String(summary.started), href: "/profile?tab=history" },
        { label: "Time watched", value: hours(summary.minutes), href: "/profile?tab=history" },
        { label: "Ratings", value: String(summary.rated), href: "/profile?tab=ratings" },
        { label: "Watchlist", value: String(summary.watchlist), href: "/watchlist" },
        { label: "Comments", value: String(summary.comments), href: `/u/${userId}` },
      ]
    : [];
  return (
    <header className="ph">
      <div className="ph-top">
        <Avatar preset={avatarPreset} url={avatarUrl} name={name || "You"} size={96} />
        <div className="ph-id">
          <h1 className="ph-name">{name || "Your profile"}</h1>
          {since ? <p className="ph-meta">Member since {since}</p> : null}
          {summary?.bio ? (
            <p className="ph-bio">{summary.bio}</p>
          ) : (
            <p className="ph-meta">
              <Link href="/profile?view=name">Add a short bio</Link>
            </p>
          )}
          <p className="ph-actions">
            <Link className="btn-ghost" href="/profile?view=name">
              Edit profile
            </Link>
            <Link className="btn-ghost" href="/profile?view=avatar">
              Change photo
            </Link>
            <Link className="btn-ghost" href={`/u/${userId}`}>
              Public profile
            </Link>
          </p>
        </div>
      </div>
      {stats.length > 0 ? (
        <div className="ph-stats">
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="ph-stat">
              <span className="ph-stat-value">{s.value}</span>
              <span className="ph-stat-label">{s.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <nav className="cr-tabs ph-tabs" aria-label="Profile sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "overview" ? "/profile" : `/profile?tab=${t.id}`}
            className={`cr-tab${tab === t.id ? " on" : ""}`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="ph-stars" aria-label={`${value} out of 5 stars`}>
      {"★".repeat(value)}
      <span>{"★".repeat(5 - value)}</span>
    </span>
  );
}

export function ProfileBody({
  tab,
  summary,
}: {
  tab: Exclude<ProfileTab, "settings">;
  summary: ProfileSummary | null;
}) {
  if (!summary) {
    return (
      <p className="form-note">
        Your history and ratings will appear here once the profile database
        update has been run (supabase/migrations/20261120_profile.sql).
      </p>
    );
  }

  if (tab === "history") {
    return <HistoryList rows={summary.history} />;
  }

  if (tab === "ratings") {
    return summary.ratings.length === 0 ? (
      <p className="empty show">
        You have not rated a film yet. Tap the stars on any film page.
      </p>
    ) : (
      <ul className="ph-rated">
        {summary.ratings.map((r) => {
          const art = coverArtFor({ slug: r.film_slug, poster_url: r.poster_url });
          return (
            <li key={r.film_slug}>
              <Link href={`/films/${r.film_slug}`}>
                {art ? (
                  <img src={art} alt="" loading="lazy" />
                ) : (
                  <span className="ph-noart" />
                )}
                <span className="ph-rated-title">{r.title}</span>
              </Link>
              <Stars value={r.stars} />
            </li>
          );
        })}
      </ul>
    );
  }

  const unfinished = summary.history.filter(
    (h) => h.duration_seconds > 0 && h.position_seconds / h.duration_seconds < 0.9,
  );
  return (
    <div className="ph-overview">
      <section>
        <h2 className="member-h2">Pick up where you left off</h2>
        {unfinished.length === 0 ? (
          <p className="empty show">
            Nothing in progress. <Link href="/browse">Find something to watch</Link>.
          </p>
        ) : (
          <HistoryList rows={unfinished.slice(0, 4)} compact />
        )}
      </section>
      <section>
        <h2 className="member-h2">Your latest ratings</h2>
        {summary.ratings.length === 0 ? (
          <p className="empty show">Rate a film and it shows here.</p>
        ) : (
          <ul className="ph-latest">
            {summary.ratings.slice(0, 5).map((r) => (
              <li key={r.film_slug}>
                <Link href={`/films/${r.film_slug}`}>{r.title}</Link>
                <Stars value={r.stars} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="member-h2">Your latest comments</h2>
        {summary.recent_comments.length === 0 ? (
          <p className="empty show">You have not commented yet.</p>
        ) : (
          <ul className="member-comments">
            {summary.recent_comments.map((c) => (
              <li key={c.id}>
                <p className="member-comment-head">
                  <span>
                    On <Link href={`/films/${c.film_slug}`}>{c.film_title}</Link>
                  </span>
                  <span>
                    {c.status === "approved"
                      ? "Published"
                      : c.status === "pending"
                        ? "Waiting for review"
                        : "Not published"}
                  </span>
                </p>
                <p className="comment-body">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
