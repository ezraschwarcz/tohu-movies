import type { Metadata } from "next";
import Link from "next/link";
import { getFilms } from "@/lib/films";
import { allGenres, COLLECTIONS, collectionFilms } from "@/lib/collections";
import { coverArtFor } from "@/lib/posters";
import { SITE_URL } from "@/lib/site";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Browse free movies by genre and collection | Tohu Movies",
  description:
    "Browse every free movie on Tohu by genre or hand-picked collection: horror, comedy, drama, documentaries, family films, true stories and more. No sign-up.",
  alternates: { canonical: `${SITE_URL}/browse` },
};

export default async function BrowsePage() {
  const films = await getFilms();
  const genres = allGenres(films);
  return (
    <div className="wrap browse-wrap">
      <div className="section-head">
        <h1 className="browse-h1">Browse</h1>
        <p className="now-count">{films.length} free films</p>
      </div>

      <h2 className="browse-h2">Collections</h2>
      <div className="browse-collections">
        {COLLECTIONS.map((c) => {
          const list = collectionFilms(films, c);
          if (list.length < 3) return null;
          return (
            <Link key={c.slug} href={`/collections/${c.slug}`} className="browse-collection">
              <span className="browse-collection-art" aria-hidden="true">
                {list.slice(0, 3).map((f) => {
                  const art = coverArtFor(f);
                  return art ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={f.slug} src={art} alt="" loading="lazy" />
                  ) : null;
                })}
              </span>
              <span className="browse-collection-title">{c.title}</span>
              <span className="browse-collection-count">{list.length} films</span>
            </Link>
          );
        })}
      </div>

      <h2 className="browse-h2">Genres</h2>
      <div className="browse-genres">
        {genres.map((g) => (
          <Link key={g.slug} href={`/genre/${g.slug}`} className="browse-genre">
            {g.genre}
            <span>{g.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
