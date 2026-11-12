"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRuntime, genresOf, posterUrl } from "@/lib/films";
import type { Film, RatingSummary } from "@/lib/types";
import { useAgeGate } from "./AgeGate";
import StarRating from "./StarRating";
import WatchlistButton from "./WatchlistButton";

/** One film card: portrait poster still (2:3, center crop of the 16:9
 *  Mux frame, with play icon, runtime and CC badges), title, year /
 *  runtime / rating, genres, and shared star rating. Clicking an R
 *  rated film runs the age gate first, then goes to the film page;
 *  other films navigate straight there. */

export default function FilmCard({
  film,
  rating,
}: {
  film: Film;
  rating: RatingSummary | null;
}) {
  const router = useRouter();
  const { ensureAllowed, modal } = useAgeGate();

  function open(e: React.MouseEvent) {
    e.preventDefault();
    ensureAllowed(film, () => router.push(`/films/${film.slug}`));
  }

  return (
    <article className="card">
      <Link
        href={`/films/${film.slug}`}
        className="thumb"
        onClick={open}
        aria-label={`Watch ${film.title}`}
      >
        {/* Plain <img>, not next/image: the Mux still URL carries
            ?width=...&time=... query params, which the /_next/image
            optimizer rejects with HTTP 400. Mux already sizes the
            still, so the optimizer adds nothing. */}
        <img
          src={posterUrl(film, 800)}
          alt={`Still from ${film.title}`}
          width={600}
          height={900}
          loading="lazy"
          sizes="(max-width: 640px) 50vw, (max-width: 1100px) 25vw, 16vw"
        />
        <span className="play-ic" aria-hidden="true">
          <span>
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
        <span className="dur">{formatRuntime(film.runtime_minutes)}</span>
        <span className="cc">CC</span>
      </Link>
      <h3>
        <Link href={`/films/${film.slug}`} onClick={open}>
          {film.title}
        </Link>
      </h3>
      <span className="m">
        {film.year} · {formatRuntime(film.runtime_minutes)} · {film.rating}
      </span>
      <span className="g">{genresOf(film).join(", ")}</span>
      <StarRating filmSlug={film.slug} initial={rating} />
      <WatchlistButton filmSlug={film.slug} filmTitle={film.title} compact />
      {modal}
    </article>
  );
}
