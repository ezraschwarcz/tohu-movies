"use client";

import FilmCard from "./FilmCard";
import { useSiteSearch } from "./SiteProvider";
import type { Film, RatingsRecord } from "@/lib/types";

/** "More films to explore" row under a sparse watchlist: films from
 *  the catalog the user has not saved yet, most recent first. The
 *  server passes up to 12 candidates; this filters by the Hide R
 *  rated preference (client-side, from localStorage) and shows up to
 *  6. Renders nothing when the filter leaves nothing to show. */
export default function WatchlistSuggestions({
  films,
  ratings,
}: {
  films: Film[];
  ratings: RatingsRecord;
}) {
  const { hideRRated } = useSiteSearch();
  const visible = (
    hideRRated ? films.filter((film) => film.rating !== "R") : films
  ).slice(0, 6);
  if (visible.length === 0) return null;
  return (
    <section aria-label="More films to explore" className="suggest-row">
      <div className="section-head">
        <h2>More films to explore</h2>
      </div>
      <div className="grid">
        {visible.map((film) => (
          <FilmCard
            key={film.slug}
            film={film}
            rating={ratings[film.slug] ?? null}
          />
        ))}
      </div>
    </section>
  );
}
