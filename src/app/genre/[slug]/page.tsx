import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BrowseGrid from "@/components/BrowseGrid";
import JsonLd from "@/components/JsonLd";
import { getFilms, getRatings } from "@/lib/films";
import { allGenres, filmsInGenre } from "@/lib/collections";
import { SITE_URL } from "@/lib/site";

export const revalidate = 60;

export async function generateStaticParams() {
  const films = await getFilms();
  return allGenres(films).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = filmsInGenre(await getFilms(), slug);
  if (!found) return { title: "Genre not found | Tohu Movies" };
  const name = found.genre.toLowerCase();
  return {
    title: `Free ${name} movies | Tohu Movies`,
    description: `Watch ${found.films.length} free ${name} movies on Tohu, including ${found.films
      .slice(0, 3)
      .map((f) => f.title)
      .join(", ")}. No sign-up, no subscription.`,
    alternates: { canonical: `${SITE_URL}/genre/${slug}` },
  };
}

export default async function GenrePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [films, ratings] = await Promise.all([getFilms(), getRatings()]);
  const found = filmsInGenre(films, slug);
  if (!found) notFound();
  const name = found.genre.toLowerCase();
  return (
    <div className="wrap browse-wrap">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Free ${name} movies`,
          itemListElement: found.films.map((f, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}/films/${f.slug}`,
            name: f.title,
          })),
        }}
      />
      <p className="browse-crumb">
        <Link href="/browse">Browse</Link> / Genres
      </p>
      <div className="section-head">
        <h1 className="browse-h1">Free {name} movies</h1>
        <p className="now-count">{found.films.length} films</p>
      </div>
      <p className="browse-blurb">
        Every {name} film on Tohu, free to watch with no sign-up and no subscription.
      </p>
      <BrowseGrid films={found.films} ratings={ratings} />
    </div>
  );
}
