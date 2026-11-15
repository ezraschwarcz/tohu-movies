import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  durationSeconds,
  formatRuntime,
  genresOf,
  getFilmBySlug,
  getFilms,
  getRatings,
  muxStreamUrl,
  posterUrl,
} from "@/lib/films";
import { SITE_URL } from "@/lib/site";
import { getCommentThreads } from "@/lib/comments";
import { getServerAuth } from "@/lib/supabase/server";
import CommentsSection from "@/components/CommentsSection";
import JsonLd from "@/components/JsonLd";
import FilmCard from "@/components/FilmCard";
import FilmPlayerSection from "@/components/FilmPlayerSection";
import ShareButton from "@/components/ShareButton";
import StarRating from "@/components/StarRating";
import WatchlistButton from "@/components/WatchlistButton";

/** Film detail page: /films/[slug]. One dynamic route, rendered from the
 *  Supabase films table. The 55 known slugs come from
 *  generateStaticParams; since Phase 5.2 the page also reads the
 *  viewer's session (to mark which comments they have liked), so it
 *  renders per request rather than from a shared cache. Each page
 *  carries its own Open Graph and Twitter tags.
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
  const description =
    film.synopsis.length > 200
      ? `${film.synopsis.slice(0, 197)}…`
      : film.synopsis;
  const title = `${film.title} (${film.year})`;
  return {
    title,
    description,
    alternates: { canonical: `/films/${film.slug}` },
    openGraph: {
      type: "video.movie",
      url: `${SITE_URL}/films/${film.slug}`,
      title: `${title} | Tohu Movies`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Tohu Movies`,
      description,
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
  // The viewer's id (null when signed out) only personalizes the
  // comment threads: which comments they have already liked. Reading
  // the session makes this page render per request; comments, likes,
  // and commenter avatars are per-user state, not cacheable content.
  const { userId } = await getServerAuth();
  const [ratings, films, commentThreads] = await Promise.all([
    getRatings(),
    getFilms(),
    getCommentThreads(slug, userId),
  ]);
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

  const pageUrl = `${SITE_URL}/films/${film.slug}`;
  const poster = posterUrl(film, 1200);
  const isoDuration = `PT${Math.floor(film.runtime_minutes / 60)}H${film.runtime_minutes % 60}M`;
  const people = (list: string) =>
    list
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ "@type": "Person", name }));
  const filmJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Movie",
        "@id": `${pageUrl}#movie`,
        name: film.title,
        url: pageUrl,
        description: film.synopsis,
        image: poster,
        datePublished: String(film.year),
        duration: isoDuration,
        contentRating: film.rating,
        genre: film.genre.split(",").map((g) => g.trim()).filter(Boolean),
        director: people(film.director),
        actor: people(film.cast_text),
        ...(rating && rating.count > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: Number(rating.average.toFixed(1)),
                ratingCount: rating.count,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
      },
      {
        "@type": "VideoObject",
        "@id": `${pageUrl}#video`,
        name: `${film.title} (${film.year})`,
        description: film.synopsis,
        thumbnailUrl: [poster],
        uploadDate: film.created_at,
        duration: `PT${durationSeconds(film)}S`,
        contentUrl: muxStreamUrl(film.playback_id),
        embedUrl: pageUrl,
        isFamilyFriendly: film.rating !== "R",
        about: { "@id": `${pageUrl}#movie` },
      },
    ],
  };

  return (
    <div className="wrap film-page">
      <JsonLd data={filmJsonLd} />
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
        <FilmPlayerSection film={film} nextFilm={more[0] ?? null} />
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
        <p className="film-actions">
          <WatchlistButton filmSlug={film.slug} filmTitle={film.title} />
          <ShareButton filmSlug={film.slug} filmTitle={film.title} />
        </p>
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

      <CommentsSection
        filmSlug={film.slug}
        initialThreads={commentThreads.threads}
        totalApproved={commentThreads.totalApproved}
      />

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
