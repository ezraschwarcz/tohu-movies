"use client";

import { useMemo, useState } from "react";
import { genreChips, genresOf } from "@/lib/films";
import type { Film, RatingsRecord, SortKey } from "@/lib/types";
import { useSiteSearch } from "./SiteProvider";
import FilmCard from "./FilmCard";

/** The Now Streaming grid: genre filter chips with counts, a sort control,
 *  and the film cards. Search comes from the header (shared site context).
 *  Genre, sort, and search compose. No Most viewed option: the site has no
 *  view data yet, so there is nothing real to sort by. */

const SORT_LABELS: { key: SortKey; label: string }[] = [
  { key: "default", label: "Default order" },
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
  const { query, setQuery } = useSiteSearch();
  const [genre, setGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("default");

  const chips = useMemo(() => genreChips(films), [films]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = films.filter((film) => {
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
        if (!ra && !rb) return films.indexOf(a) - films.indexOf(b);
        if (!ra) return 1;
        if (!rb) return -1;
        if (rb.average !== ra.average) return rb.average - ra.average;
        return rb.count - ra.count;
      });
    } else if (sort === "az") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [films, ratings, genre, sort, query]);

  const filtered = genre !== null || sort !== "default" || query.trim() !== "";

  function reset() {
    setGenre(null);
    setSort("default");
    setQuery("");
  }

  return (
    <section id="now-streaming" aria-label="Now streaming">
      <div className="section-head">
        <h2>Now Streaming</h2>
        <p className="now-count">
          {visible.length} of {films.length} films streaming now
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
            All {films.length}
          </button>
          {chips.map(({ genre: g, count }) => (
            <button
              key={g}
              type="button"
              className="chip"
              aria-pressed={genre === g}
              onClick={() => setGenre(genre === g ? null : g)}
            >
              {g} {count}
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
