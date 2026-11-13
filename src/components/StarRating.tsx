"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";
import type { RatingSummary } from "@/lib/types";

/** Shared star rating, matching the live site: the average and count come
 *  from the Supabase ratings table (server snapshot), the visitor's own
 *  rating lives in localStorage, and rating writes upsert on
 *  (film_slug, voter_id) with an anonymous random voter id. Tapping the
 *  same star again removes the rating. A failed write falls back to the
 *  local rating only (no error shown).
 *
 *  Display rule (Nov 12, 2026): the rating COUNT is never shown (with
 *  about one rating per film it reads as empty, not popular). The
 *  numeric average is shown only once a film has 5 or more ratings;
 *  below that the label is "Rate this film", even if 1 to 4 ratings
 *  exist. */

const OWN_KEY = "tohu-ratings-v1";
const VOTER_KEY = "tohu-voter-id-v1";

function readOwnRatings(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(OWN_KEY) ?? "{}") as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
}

function readVoterId(): string {
  try {
    let id = window.localStorage.getItem(VOTER_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(VOTER_KEY, id);
    }
    return id;
  } catch {
    return `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function formatAverage(avg: number): string {
  return avg.toFixed(1);
}

export default function StarRating({
  filmSlug,
  initial,
  onDark = false,
}: {
  filmSlug: string;
  /** Server snapshot of the shared average and count (null if unrated). */
  initial: RatingSummary | null;
  onDark?: boolean;
}) {
  const [own, setOwn] = useState<number | null>(null);
  const [shown, setShown] = useState<RatingSummary | null>(initial);
  const [hover, setHover] = useState<number | null>(null);

  // Own rating is per-browser; read it on mount (client only).
  useEffect(() => {
    setOwn(readOwnRatings()[filmSlug] ?? null);
  }, [filmSlug]);

  const rate = useCallback(
    async (stars: number) => {
      const voterId = readVoterId();
      const supabase = getBrowserSupabase();
      const prevOwn = readOwnRatings()[filmSlug] ?? null;
      const prevShown = shown;

      // Optimistic update of the displayed average and count.
      const recompute = (
        base: RatingSummary | null,
        from: number | null,
        to: number | null,
      ): RatingSummary | null => {
        const count = base?.count ?? 0;
        const total = (base?.average ?? 0) * count;
        let nextCount = count;
        let nextTotal = total;
        if (from !== null) {
          nextCount -= 1;
          nextTotal -= from;
        }
        if (to !== null) {
          nextCount += 1;
          nextTotal += to;
        }
        if (nextCount <= 0) return null;
        return { average: nextTotal / nextCount, count: nextCount };
      };

      if (prevOwn === stars) {
        // Tapping the same star again clears the rating.
        const next = recompute(prevShown, prevOwn, null);
        setShown(next);
        setOwn(null);
        const ratings = readOwnRatings();
        delete ratings[filmSlug];
        try {
          window.localStorage.setItem(OWN_KEY, JSON.stringify(ratings));
        } catch {
          // ignore
        }
        const { error } = await supabase
          .from("ratings")
          .delete()
          .eq("film_slug", filmSlug)
          .eq("voter_id", voterId);
        if (error) setShown(prevShown);
        return;
      }

      const next = recompute(prevShown, prevOwn, stars);
      setShown(next);
      setOwn(stars);
      try {
        window.localStorage.setItem(
          OWN_KEY,
          JSON.stringify({ ...readOwnRatings(), [filmSlug]: stars }),
        );
      } catch {
        // ignore
      }
      const { error } = await supabase
        .from("ratings")
        .upsert(
          { film_slug: filmSlug, stars, voter_id: voterId },
          { onConflict: "film_slug,voter_id" },
        );
      if (error) setShown(prevShown);
    },
    [filmSlug, shown],
  );

  const filledUpTo = hover ?? own ?? 0;

  return (
    <div className={`stars${onDark ? " on-dark" : ""}`}>
      <span className="sr-only">Rate this film</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn${n <= filledUpTo ? " filled" : ""}`}
          aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
          aria-pressed={own === n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(null)}
          onClick={() => void rate(n)}
        >
          ★
        </button>
      ))}
      {shown && shown.count >= 5 ? (
        <span className="stars-avg">{formatAverage(shown.average)}</span>
      ) : (
        <span className="stars-label">Rate this film</span>
      )}
    </div>
  );
}
