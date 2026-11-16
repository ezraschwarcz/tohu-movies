"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { coverArtFor } from "@/lib/posters";

export type HistoryRow = {
  film_slug: string;
  title: string;
  year: number;
  playback_id: string;
  poster_url: string | null;
  position_seconds: number;
  duration_seconds: number;
  updated_at: string;
};

function when(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Films a member has watched, newest first, with how far they got.
 *  Each can be removed, or the whole history cleared. */
export default function HistoryList({
  rows,
  compact = false,
}: {
  rows: HistoryRow[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [gone, setGone] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const shown = rows.filter((r) => !gone.includes(r.film_slug));

  async function remove(slug: string | null) {
    if (slug === null && !window.confirm("Clear your whole viewing history? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    const { error } = await getBrowserSupabase().rpc("clear_my_history", {
      p_slug: slug,
    });
    setBusy(false);
    if (error) return;
    setGone((g) => (slug === null ? rows.map((r) => r.film_slug) : [...g, slug]));
    router.refresh();
  }

  if (shown.length === 0) {
    return (
      <p className="empty show">
        Nothing here yet. Films you watch while signed in are listed here.
      </p>
    );
  }

  return (
    <div className="ph-history-wrap">
      <ul className="ph-history">
        {shown.map((r) => {
          const pct =
            r.duration_seconds > 0
              ? Math.min(100, Math.round((r.position_seconds / r.duration_seconds) * 100))
              : 0;
          const finished = pct >= 90;
          const art = coverArtFor({ slug: r.film_slug, poster_url: r.poster_url });
          return (
            <li key={r.film_slug}>
              <Link href={`/films/${r.film_slug}`} className="ph-history-art">
                {art ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={art} alt="" loading="lazy" />
                ) : (
                  <span className="ph-noart" />
                )}
              </Link>
              <div className="ph-history-main">
                <Link href={`/films/${r.film_slug}`} className="ph-history-title">
                  {r.title} <span>({r.year})</span>
                </Link>
                <span className="ph-history-meta">
                  {when(r.updated_at)} · {finished ? "Finished" : `${pct}% watched`}
                </span>
                <span className="ph-bar" aria-hidden="true">
                  <span style={{ width: `${finished ? 100 : pct}%` }} />
                </span>
              </div>
              {compact ? null : (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => void remove(r.film_slug)}
                  disabled={busy}
                  aria-label={`Remove ${r.title} from your history`}
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {compact ? null : (
        <button type="button" className="btn-ghost" onClick={() => void remove(null)} disabled={busy}>
          Clear all history
        </button>
      )}
    </div>
  );
}
