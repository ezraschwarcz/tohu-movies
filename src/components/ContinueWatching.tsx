"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { formatRuntime, posterUrl } from "@/lib/films";
import { embeddedOne } from "@/lib/types";
import type { ContinueWatchingEntry, Film } from "@/lib/types";

/** Continue watching row on the home page, for signed-in users only.
 *  Shows the films they stopped partway through, with a progress bar
 *  and a Resume button. The player picks up at the saved position when
 *  the film page opens. Signed-out visitors see nothing here.
 *
 *  Each item is a wide horizontal card: the landscape poster on the
 *  left, title, progress, and Resume on the right. A single item is a
 *  substantial card, not a small thumbnail lost in empty space. */

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
        .limit(10);
      if (cancelled) return;
      const rows = ((data ?? []) as unknown as ContinueWatchingEntry[])
        .map((r) => ({
          ...r,
          films: embeddedOne(r.films as unknown as Film | Film[] | null),
        }))
        .filter((r) => r.films !== null && r.duration_seconds > 0);
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

  return (
    <section className="continue-row" aria-label="Continue watching">
      <div className="section-head">
        <h2>Continue watching</h2>
      </div>
      <div className="continue-grid">
        {entries.map((entry) => {
          const film = entry.films!;
          const progress = Math.min(
            100,
            Math.round((entry.position_seconds / entry.duration_seconds) * 100),
          );
          return (
            <article key={entry.film_slug} className="continue-card">
              <Link
                href={`/films/${film.slug}`}
                className="continue-thumb"
                aria-label={`Resume ${film.title}`}
              >
                {/* Plain <img>, not next/image: the Mux still URL
                    carries ?width=...&time=... query params, which the
                    /_next/image optimizer rejects with HTTP 400. Mux
                    already sizes the still, so the optimizer adds
                    nothing. */}
                <img
                  src={posterUrl(film, 800)}
                  alt={`Still from ${film.title}`}
                  width={800}
                  height={450}
                  loading="lazy"
                  sizes="(max-width: 640px) 40vw, 220px"
                />
              </Link>
              <div className="continue-body">
                <h3>
                  <Link href={`/films/${film.slug}`}>{film.title}</Link>
                </h3>
                <p className="continue-meta">
                  {formatPosition(entry.position_seconds)} of{" "}
                  {formatRuntime(film.runtime_minutes)} · {progress}% watched
                </p>
                <div
                  className="continue-progress"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${progress}% watched`}
                >
                  <span
                    className="continue-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <Link
                  href={`/films/${film.slug}`}
                  className="watchlist-btn saved"
                >
                  Resume
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
