"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { genreChips, genresOf } from "@/lib/films";
import type { Film, RatingsRecord, SortKey } from "@/lib/types";
import { useSiteSearch } from "./SiteProvider";
import FilmCard from "./FilmCard";

/** The Now Streaming grid: genre filter chips (name only, no count),
 *  a sort control, and the film cards. Search comes from the header
 *  (shared site context). Genre, sort, and search compose. No Most
 *  viewed option: the site has no view data yet, so there is nothing
 *  real to sort by. The "Hide R rated films" preference (set on the
 *  profile page, kept in localStorage) filters the grid before any of
 *  that: chips and counts describe what is actually shown. */

const SORT_LABELS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "top-rated", label: "Top rated" },
  { key: "az", label: "A to Z" },
];

export default function FilmGrid({
  films,
  ratings,
}: {
  films: Film[];
  ratings: RatingsRecord;
}) {
  const { query, setQuery, hideRRated } = useSiteSearch();
  const [genre, setGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");

  // The R-rated preference applies first, so chips, counts, and the
  // grid all describe the same list.
  const baseFilms = useMemo(
    () =>
      hideRRated ? films.filter((film) => film.rating !== "R") : films,
    [films, hideRRated],
  );

  const chips = useMemo(() => genreChips(baseFilms), [baseFilms]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = baseFilms.filter((film) => {
      if (genre && !genresOf(film).includes(genre)) return false;
      if (q) {
        const hay = `${film.title} ${film.director} ${film.cast_text}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "newest") {
      list = [...list].reverse();
    } else if (sort === "top-rated") {
      list = [...list].sort((a, b) => {
        const ra = ratings[a.slug];
        const rb = ratings[b.slug];
        if (!ra && !rb) return baseFilms.indexOf(a) - baseFilms.indexOf(b);
        if (!ra) return 1;
        if (!rb) return -1;
        if (rb.average !== ra.average) return rb.average - ra.average;
        return rb.count - ra.count;
      });
    } else if (sort === "az") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [baseFilms, ratings, genre, sort, query]);

  const filtered = genre !== null || sort !== "newest" || query.trim() !== "";

  function reset() {
    setGenre(null);
    setSort("newest");
    setQuery("");
  }

  return (
    <section id="now-streaming" aria-label="Now streaming">
      <div className="section-head">
        <h2>Now Streaming</h2>
        <p className="now-count">
          {visible.length} film{visible.length === 1 ? "" : "s"} streaming now
        </p>
      </div>

      <div className="browse-bar">
        <div
          className="chips"
          role="group"
          aria-label="Filter by genre"
        >
          <button
            type="button"
            className="chip"
            aria-pressed={genre === null}
            onClick={() => setGenre(null)}
          >
            All {baseFilms.length}
          </button>
          {chips.map(({ genre: g }) => (
            <button
              key={g}
              type="button"
              className="chip"
              aria-pressed={genre === g}
              onClick={() => setGenre(genre === g ? null : g)}
            >
              {g}
            </button>
          ))}
        </div>
        <label className="sort-control">
          <span className="sr-only">Sort films</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort films"
          >
            {SORT_LABELS.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hideRRated ? (
        <p className="filter-note">
          R rated films are hidden.{" "}
          <Link href="/profile">Change this in your profile</Link>.
        </p>
      ) : null}

      {filtered ? (
        <p className="filter-note">
          Showing {visible.length} film{visible.length === 1 ? "" : "s"}
          {genre ? ` in ${genre}` : ""}
          {query.trim() ? ` matching “${query.trim()}”` : ""}.{" "}
          <button type="button" className="reset-filters" onClick={reset}>
            Reset filters
          </button>
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="empty show">
          No films match. Try a different genre, sort, or search.
        </p>
      ) : (
        <div className="grid">
          {visible.map((film) => (
            <FilmCard
              key={film.slug}
              film={film}
              rating={ratings[film.slug] ?? null}
            />
          ))}
        </div>
      )}
    </section>
  );
}
