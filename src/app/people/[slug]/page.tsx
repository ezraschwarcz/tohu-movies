import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BrowseGrid from "@/components/BrowseGrid";
import JsonLd from "@/components/JsonLd";
import { getFilms, getRatings } from "@/lib/films";
import { allPeople } from "@/lib/people";
import { SITE_URL } from "@/lib/site";

export const revalidate = 60;

export async function generateStaticParams() {
  return allPeople(await getFilms()).map((p) => ({ slug: p.slug }));
}

async function find(slug: string) {
  const films = await getFilms();
  return allPeople(films).find((p) => p.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const person = await find(slug);
  if (!person) return { title: "Not found | Tohu Movies" };
  const films = [...new Set([...person.actedIn, ...person.directed])];
  return {
    title: `${person.name} movies: watch free | Tohu Movies`,
    description: `Watch ${films
      .slice(0, 3)
      .map((f) => `${f.title} (${f.year})`)
      .join(", ")}${films.length > 3 ? " and more" : ""} with ${person.name}, free on Tohu Movies. No sign-up.`,
    alternates: { canonical: `${SITE_URL}/people/${slug}` },
  };
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [person, ratings] = await Promise.all([find(slug), getRatings()]);
  if (!person) notFound();
  const films = [...new Set([...person.actedIn, ...person.directed])];
  const roles = [
    person.actedIn.length > 0 ? "Actor" : null,
    person.directed.length > 0 ? "Director" : null,
  ].filter(Boolean);
  return (
    <div className="wrap browse-wrap">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: person.name,
          url: `${SITE_URL}/people/${person.slug}`,
          jobTitle: roles.join(", "),
        }}
      />
      <p className="browse-crumb">
        <Link href="/browse">Browse</Link> / People
      </p>
      <div className="section-head">
        <h1 className="browse-h1">{person.name}</h1>
        <p className="now-count">
          {roles.join(" and ")} · {films.length} film{films.length === 1 ? "" : "s"} on Tohu
        </p>
      </div>
      {person.actedIn.length > 0 ? (
        <>
          {person.directed.length > 0 ? <h2 className="browse-h2">Appears in</h2> : null}
          <BrowseGrid films={person.actedIn} ratings={ratings} />
        </>
      ) : null}
      {person.directed.length > 0 ? (
        <>
          {person.actedIn.length > 0 ? <h2 className="browse-h2">Directed</h2> : null}
          <BrowseGrid films={person.directed} ratings={ratings} />
        </>
      ) : null}
    </div>
  );
}
