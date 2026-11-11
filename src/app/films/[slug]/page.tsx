import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatRuntime,
  genresOf,
  getFilmBySlug,
  getFilms,
  getRatings,
  posterUrl,
} from "@/lib/films";
import { SITE_URL } from "@/lib/site";
import FilmCard from "@/components/FilmCard";
import FilmPlayerSection from "@/components/FilmPlayerSection";
import StarRating from "@/components/StarRating";

/** Film detail page: /films/[slug]. One dynamic route, rendered from the
 *  Supabase films table. The 55 known slugs are pre-rendered at build
 *  time; a film added later renders on demand (dynamicParams) and is then
 *  cached. Each page carries its own Open Graph and Twitter tags.
 *  Note: the revalidate value is a literal on purpose. Route segment
 *  config is read by static analysis, and an imported constant is
 *  flagged as an unsupported value at build time. */
export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const films = await getFilms();
  return films.map((film) => ({ slug: film.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const film = await getFilmBySlug(slug);
  if (!film) {
    return { title: "Film not found" };
  }
  const poster = posterUrl(film, 1200);
  const description =
    film.synopsis.length > 200
      ? `${film.synopsis.slice(0, 197)}…`
      : film.synopsis;
  const title = `${film.title} (${film.year})`;
  return {
    title,
    description,
    openGraph: {
      type: "video.movie",
      url: `${SITE_URL}/films/${film.slug}`,
      title: `${title} | Tohu Movies`,
      description,
      images: [
        {
          url: poster,
          width: 1200,
          height: 675,
          alt: `Still from ${film.title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Tohu Movies`,
      description,
      images: [poster],
    },
  };
}

export default async function FilmPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const film = await getFilmBySlug(slug);
  if (!film) {
    notFound();
  }
  const [ratings, films] = await Promise.all([getRatings(), getFilms()]);
  const rating = ratings[film.slug] ?? null;

  // The two films whose warnings carry the 988 Suicide and Crisis Lifeline
  // get the prominent amber warning box above the player. The warnings
  // text itself is the content warning, so it is shown once, here, rather
  // than duplicated in the details below.
  const isSensitive = film.warnings.includes("988");

  const filmGenres = new Set(genresOf(film));
  const more = films
    .filter((f) => f.slug !== film.slug)
    .sort((a, b) => {
      const aSame = genresOf(a).some((g) => filmGenres.has(g)) ? 0 : 1;
      const bSame = genresOf(b).some((g) => filmGenres.has(g)) ? 0 : 1;
      return aSame - bSame;
    })
    .slice(0, 6);

  return (
    <div className="wrap film-page">
      <Link href="/" className="back-link">
        ← Back to films
      </Link>

      <div className="player-section">
        {isSensitive ? (
          <div className="sensitive" role="note">
            <strong>Sensitive content warning: </strong>
            {film.warnings}
          </div>
        ) : null}
        <FilmPlayerSection film={film} />
      </div>

      <div className="film-details">
        <h1>{film.title}</h1>
        <p className="meta-row">
          <span>{film.year}</span>
          <span aria-hidden="true">·</span>
          <span>{formatRuntime(film.runtime_minutes)}</span>
          <span aria-hidden="true">·</span>
          <span>{film.rating}</span>
          <span aria-hidden="true">·</span>
          <span>{film.genre}</span>
        </p>
        <p className="syn">{film.synopsis}</p>
        <StarRating filmSlug={film.slug} initial={rating} />
        <dl className="film-facts">
          <div>
            <dt>Director</dt>
            <dd>{film.director}</dd>
          </div>
          <div>
            <dt>Cast</dt>
            <dd>{film.cast_text}</dd>
          </div>
          <div>
            <dt>Genre</dt>
            <dd>{film.genre}</dd>
          </div>
          <div>
            <dt>Runtime</dt>
            <dd>{formatRuntime(film.runtime_minutes)}</dd>
          </div>
        </dl>
        {isSensitive ? null : (
          <p className="warn">
            <strong>Content warning:</strong> {film.warnings}
          </p>
        )}
      </div>

      {more.length > 0 ? (
        <section className="more-films" aria-label="More films">
          <div className="section-head">
            <h2>More films</h2>
          </div>
          <div className="grid">
            {more.map((f) => (
              <FilmCard key={f.slug} film={f} rating={ratings[f.slug] ?? null} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
