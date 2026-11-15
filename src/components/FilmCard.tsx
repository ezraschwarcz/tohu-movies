"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRuntime, genresOf, posterUrl } from "@/lib/films";
import { posterZoomFor } from "@/lib/posterZoom";
import type { Film, RatingSummary } from "@/lib/types";
import { useAgeGate } from "./AgeGate";
import WatchlistButton from "./WatchlistButton";

/** One film card (redesign v2.1): a designed 2:3 poster built from
 *  three parts, so nothing is ever cropped badly: a color field set by
 *  the film's main genre, the film's still shown whole in its true
 *  16:9 shape, and the title set large beneath it with the year and
 *  genres. Every film, including ones added later, gets a poster in
 *  the same family automatically.
 *  Rating a film happens on the film page; the card only shows the
 *  shared average when there is one. The Watchlist button sits on the
 *  poster corner (shown on hover or focus; always shown on touch
 *  screens). Clicking an R rated film runs the age gate first. An
 *  optional rank draws the Top 10 numeral.
 *  Plain <img>, not next/image: the Mux still URL carries query
 *  params, which the /_next/image optimizer rejects. */

/** Poster color field by main genre: deep, muted tones of similar
 *  lightness so a row of posters reads as one set. */
const GENRE_TONES: Record<string, string> = {
  Horror: "#3d1b18",
  Thriller: "#232847",
  Mystery: "#232847",
  Crime: "#2a2433",
  Comedy: "#3d2e12",
  Drama: "#14303a",
  Romance: "#3d2238",
  Documentary: "#26381f",
  Biography: "#26381f",
  Family: "#1b3833",
  Animation: "#1b3833",
  Adventure: "#1b3833",
  Action: "#42301a",
  War: "#33301f",
  "Sci-Fi": "#1c2c44",
  Sport: "#42301a",
  Musical: "#3a2440",
  Music: "#3a2440",
  Fantasy: "#2b2547",
};

function toneFor(film: Film): string {
  for (const g of genresOf(film)) {
    const tone = GENRE_TONES[g];
    if (tone) return tone;
  }
  return "#221f1a";
}

/** Title size step from the longest word, so one long word (for
 *  example "Zombeavers") never crowds or overflows the poster. */
function titleSize(title: string): "lg" | "md" | "sm" {
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length));
  if (longest >= 10 || title.length > 24) return "sm";
  if (longest >= 7 || title.length > 14) return "md";
  return "lg";
}

export default function FilmCard({
  film,
  rating,
  rank,
}: {
  film: Film;
  rating: RatingSummary | null;
  rank?: number;
}) {
  const router = useRouter();
  const { ensureAllowed, modal } = useAgeGate();

  function open(e: React.MouseEvent) {
    e.preventDefault();
    ensureAllowed(film, () => router.push(`/films/${film.slug}`));
  }

  return (
    <article className="card">
      <div className="poster-wrap">
        <Link
          href={`/films/${film.slug}`}
          className="poster"
          style={{ "--tone": toneFor(film) } as React.CSSProperties}
          onClick={open}
          aria-label={`Watch ${film.title}`}
        >
          <span className="poster-top" aria-hidden="true">
            {rank ? <span className="poster-rank">{rank}</span> : null}
            <span className="poster-brand">Tohu</span>
          </span>
          <span className="poster-still">
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
            <span className="play-ic" aria-hidden="true">
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </span>
          <span className="poster-text" aria-hidden="true">
            <span className={`poster-title size-${titleSize(film.title)}`}>
              {film.title}
            </span>
            <span className="poster-sub">
              {film.year} · {genresOf(film).join(" · ")}
            </span>
          </span>
        </Link>
        <WatchlistButton filmSlug={film.slug} filmTitle={film.title} compact />
      </div>
      <h3 className="sr-only">
        <Link href={`/films/${film.slug}`} onClick={open} tabIndex={-1}>
          {rank ? `Number ${rank}: ` : ""}
          {film.title}
        </Link>
      </h3>
      <span className="m">
        {rating && rating.count > 0 ? (
          <span className="card-score">
            <span aria-hidden="true">★</span>{" "}
            <span className="sr-only">Rated </span>
            {rating.average.toFixed(1)}
            <span className="sr-only"> out of 5</span>
            {" · "}
          </span>
        ) : null}
        {film.rating} · {formatRuntime(film.runtime_minutes)}
      </span>
      {modal}
    </article>
  );
}
