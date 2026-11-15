"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRuntime, genresOf, portraitPosterUrl } from "@/lib/films";
import type { Film, RatingSummary } from "@/lib/types";
import { useAgeGate } from "./AgeGate";
import WatchlistButton from "./WatchlistButton";

/** One film card (redesign v2): a portrait poster with the title set
 *  large over it, then one quiet line of facts. The poster is a 2:3
 *  smart crop of the film's still (Mux centers it on the subject).
 *  Rating a film happens on the film page; the card only shows the
 *  shared average when there is one. The Watchlist button sits on the
 *  poster corner (shown on hover or focus; always shown on touch
 *  screens). Clicking an R rated film runs the age gate first. An
 *  optional rank draws the Top 10 numeral.
 *  Plain <img>, not next/image: the Mux still URL carries query
 *  params, which the /_next/image optimizer rejects. */

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
          onClick={open}
          aria-label={`Watch ${film.title}`}
        >
          <img
            src={portraitPosterUrl(film, 480)}
            alt=""
            width={480}
            height={720}
            loading="lazy"
          />
          <span className="poster-shade" aria-hidden="true" />
          {rank ? (
            <span className="poster-rank" aria-hidden="true">
              {rank}
            </span>
          ) : null}
          <span
            className={`poster-title size-${titleSize(film.title)}`}
            aria-hidden="true"
          >
            {film.title}
          </span>
          <span className="play-ic" aria-hidden="true">
            <span>
              <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </Link>
        <WatchlistButton filmSlug={film.slug} filmTitle={film.title} compact />
      </div>
      <h3>
        <Link href={`/films/${film.slug}`} onClick={open}>
          {rank ? <span className="sr-only">Number {rank}: </span> : null}
          {film.title}
        </Link>
      </h3>
      <span className="m">
        {film.year} · {film.rating} · {formatRuntime(film.runtime_minutes)}
      </span>
      <span className="g">
        {rating && rating.count > 0 ? (
          <span className="card-score">
            <span aria-hidden="true">★</span>{" "}
            <span className="sr-only">Rated </span>
            {rating.average.toFixed(1)}
            <span className="sr-only"> out of 5</span>
            {" · "}
          </span>
        ) : null}
        {genresOf(film).join(", ")}
      </span>
      {modal}
    </article>
  );
}
