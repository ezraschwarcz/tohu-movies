"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { formatRuntime, posterUrl } from "@/lib/films";
import { posterZoomFor } from "@/lib/posterZoom";
import { embeddedOne } from "@/lib/types";
import type { ContinueWatchingEntry, Film } from "@/lib/types";

/** Continue watching row on the home page, for signed-in users only.
 *  Shows the films they stopped partway through, with a progress bar
 *  and a Resume button. The player picks up at the saved position when
 *  the film page opens. Signed-out visitors see nothing here.
 *
 *  Each item is a wide horizontal card: the landscape poster on the
 *  left, title, progress, and Resume on the right. A single item is a
 *  substantial card, not a small thumbnail lost in empty space.
 *
 *  On mobile the row is a sideways swipe rail, two cards tall: cards
 *  flow into columns of two and the rail scrolls horizontally with
 *  snap, so even the full 10 entries take only two cards of vertical
 *  space before the next section. Also shown at the top of the
 *  Watchlist page (the "My Stuff" hub), the same place the big
 *  services put it. Capped at the 10 most recent entries. */

const MIN_SECONDS = 60;
const MAX_SHOWN = 6;

function formatPosition(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ContinueWatching() {
  const { loading, user } = useAuth();
  const [entries, setEntries] = useState<ContinueWatchingEntry[]>([]);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    const userId = user.id;
    async function load() {
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from("continue_watching")
        .select(
          "film_slug,position_seconds,duration_seconds,updated_at,films(*)",
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const rows = ((data ?? []) as unknown as ContinueWatchingEntry[])
        .map((r) => ({
          ...r,
          films: embeddedOne(r.films as unknown as Film | Film[] | null),
        }))
        .filter((r) => r.films !== null && r.duration_seconds > 0)
        // Only films actually in progress: at least a minute in, and
        // not all but finished. Opening a film for a few seconds no
        // longer adds it to the row.
        .filter(
          (r) =>
            r.position_seconds >= MIN_SECONDS &&
            r.position_seconds / r.duration_seconds < 0.95,
        )
        .slice(0, MAX_SHOWN);
      setEntries(rows);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || !user || entries.length === 0) {
    return null;
  }

  async function dismiss(slug: string) {
    // Remove it from the row now, and delete the saved position so
    // it does not come back on the next visit. The film can still be
    // restarted from its film page at any time.
    setEntries((prev) => prev.filter((e) => e.film_slug !== slug));
    if (!user) return;
    const supabase = getBrowserSupabase();
    await supabase
      .from("continue_watching")
      .delete()
      .eq("user_id", user.id)
      .eq("film_slug", slug);
  }

  return (
    <section className="continue-row" aria-label="Continue watching">
      <div className="section-head">
        <h2>Continue watching</h2>
      </div>
      <div className="cw-rail">
        {entries.map((entry) => {
          const film = entry.films!;
          const progress = Math.min(
            100,
            Math.round((entry.position_seconds / entry.duration_seconds) * 100),
          );
          const minutesLeft = Math.max(
            1,
            Math.round((entry.duration_seconds - entry.position_seconds) / 60),
          );
          return (
            <article key={entry.film_slug} className="cw-card">
              <Link
                href={`/films/${film.slug}`}
                className="cw-thumb"
                aria-label={`Resume ${film.title}, ${minutesLeft} minutes left`}
              >
                {/* Plain <img>, not next/image: the Mux still URL
                    carries query params, which the /_next/image
                    optimizer rejects. */}
                <img
                  src={posterUrl(film, 640)}
                  style={
                    {
                      "--poster-zoom": posterZoomFor(film.slug),
                    } as React.CSSProperties
                  }
                  alt=""
                  width={640}
                  height={360}
                  loading="lazy"
                />
                <span className="cw-shade" aria-hidden="true" />
                <span className="cw-title" aria-hidden="true">
                  {film.title}
                </span>
                <span
                  className="cw-progress"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${progress}% watched`}
                >
                  <span style={{ width: `${progress}%` }} />
                </span>
              </Link>
              <div className="cw-foot">
                <span className="cw-left">
                  {minutesLeft} min left · {formatPosition(entry.position_seconds)} of{" "}
                  {formatRuntime(film.runtime_minutes)}
                </span>
                <button
                  type="button"
                  className="cw-remove"
                  onClick={() => void dismiss(film.slug)}
                  aria-label={`Remove ${film.title} from Continue watching`}
                >
                  Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
