import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BrowseGrid from "@/components/BrowseGrid";
import JsonLd from "@/components/JsonLd";
import { getFilms, getRatings } from "@/lib/films";
import { COLLECTIONS, collectionFilms } from "@/lib/collections";
import { SITE_URL } from "@/lib/site";

export const revalidate = 60;

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = COLLECTIONS.find((c) => c.slug === slug);
  if (!collection) return { title: "Collection not found | Tohu Movies" };
  return {
    title: `${collection.title}: free movies | Tohu Movies`,
    description: `${collection.blurb} Free on Tohu, no sign-up.`,
    alternates: { canonical: `${SITE_URL}/collections/${slug}` },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = COLLECTIONS.find((c) => c.slug === slug);
  if (!collection) notFound();
  const [films, ratings] = await Promise.all([getFilms(), getRatings()]);
  const list = collectionFilms(films, collection);
  if (list.length === 0) notFound();
  return (
    <div className="wrap browse-wrap">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: collection.title,
          description: collection.blurb,
          itemListElement: list.map((f, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_URL}/films/${f.slug}`,
            name: f.title,
          })),
        }}
      />
      <p className="browse-crumb">
        <Link href="/browse">Browse</Link> / Collections
      </p>
      <div className="section-head">
        <h1 className="browse-h1">{collection.title}</h1>
        <p className="now-count">{list.length} films</p>
      </div>
      <p className="browse-blurb">{collection.blurb}</p>
      <BrowseGrid films={list} ratings={ratings} />
    </div>
  );
}
