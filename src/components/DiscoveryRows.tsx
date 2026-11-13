"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { genresOf } from "@/lib/films";
import { favoriteGenresFromMetadata } from "@/lib/profile";
import type { Film, RatingsRecord } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { useAgeGate } from "./AgeGate";
import FilmCard from "./FilmCard";
import { useSiteSearch } from "./SiteProvider";

/** Discovery rows above the full catalog grid (Netflix / Peacock
 *  style): a few short, themed rails instead of one long list, so
 *  choosing takes less effort. Hidden while a search query is active
 *  (the grid below is the search result then). Every row respects the
 *  Hide R rated preference. Ratings here use the real shared counts
 *  only; no row invents popularity it does not have. */

function Rail({
  id,
  title,
  films,
  ratings,
}: {
  id?: string;
  title: string;
  films: Film[];
  ratings: RatingsRecord;
}) {
  if (films.length === 0) return null;
  return (
    <section className="discovery-row" id={id} aria-label={title}>
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      <div className="discovery-rail">
        {films.map((film) => (
          <div className="discovery-item" key={film.slug}>
            <FilmCard film={film} rating={ratings[film.slug] ?? null} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DiscoveryRows({
  films,
  ratings,
}: {
  films: Film[];
  ratings: RatingsRecord;
}) {
  const { query, hideRRated } = useSiteSearch();
  const { user } = useAuth();
  const router = useRouter();
  const { ensureAllowed, modal } = useAgeGate();

  const base = useMemo(
    () => (hideRRated ? films.filter((f) => f.rating !== "R") : films),
    [films, hideRRated],
  );

  const trending = useMemo(
    () =>
      base
        .filter((f) => (ratings[f.slug]?.count ?? 0) >= 1)
        .sort((a, b) => {
          const ra = ratings[a.slug]!;
          const rb = ratings[b.slug]!;
          if (rb.count !== ra.count) return rb.count - ra.count;
          return rb.average - ra.average;
        })
        .slice(0, 10),
    [base, ratings],
  );

  const newest = useMemo(() => [...base].reverse().slice(0, 8), [base]);

  const topRated = useMemo(
    () =>
      base
        .filter((f) => (ratings[f.slug]?.count ?? 0) >= 2)
        .sort((a, b) => {
          const ra = ratings[a.slug]!;
          const rb = ratings[b.slug]!;
          if (rb.average !== ra.average) return rb.average - ra.average;
          return rb.count - ra.count;
        })
        .slice(0, 10),
    [base, ratings],
  );

  const favoriteGenres = favoriteGenresFromMetadata(
    user?.user_metadata as Record<string, unknown> | undefined,
  );

  const becauseRows = useMemo(
    () =>
      favoriteGenres.slice(0, 2).map((genre) => ({
        genre,
        films: base
          .filter((f) => genresOf(f).includes(genre))
          .sort((a, b) => {
            const ra = ratings[a.slug];
            const rb = ratings[b.slug];
            if (!ra && !rb) return 0;
            if (!ra) return 1;
            if (!rb) return -1;
            return rb.average - ra.average;
          })
          .slice(0, 10),
      })),
    [base, ratings, favoriteGenres],
  );

  if (query.trim() !== "") return null;
  if (base.length === 0) return null;

  function playSomething() {
    const pick = base[Math.floor(Math.random() * base.length)];
    if (!pick) return;
    ensureAllowed(pick, () => router.push(`/films/${pick.slug}`));
  }

  return (
    <div className="discovery">
      <div className="discovery-head">
        <button type="button" className="play-btn" onClick={playSomething}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Play something
        </button>
        <span className="discovery-hint">
          Not sure? We will pick a film for you.
        </span>
      </div>
      <Rail title="Trending on Tohu" films={trending} ratings={ratings} />
      <Rail
        id="new-on-tohu"
        title="New on Tohu"
        films={newest}
        ratings={ratings}
      />
      <Rail title="Top rated" films={topRated} ratings={ratings} />
      {becauseRows.map(({ genre, films: rowFilms }) => (
        <Rail
          key={genre}
          title={`Because you like ${genre}`}
          films={rowFilms}
          ratings={ratings}
        />
      ))}
      {modal}
    </div>
  );
}
