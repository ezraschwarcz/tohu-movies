import type { Metadata } from "next";
import { getFilms, getRatings, getViewCounts } from "@/lib/films";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import JsonLd from "@/components/JsonLd";
import ContinueWatching from "@/components/ContinueWatching";
import DiscoveryRows from "@/components/DiscoveryRows";
import Hero from "@/components/Hero";
import FilmGrid from "@/components/FilmGrid";
import HomePrompts from "@/components/HomePrompts";

/** Home page. Films and shared ratings come from Supabase at request
 *  time (cached 60s); a film added to the database appears within that
 *  window without a rebuild.
 *  Note: the revalidate value is a literal on purpose. Route segment
 *  config is read by static analysis, and an imported constant is
 *  flagged as an unsupported value at build time. */
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo-512.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

/** Six films at random from the whole catalog, in random order, for
 *  the hero. Chosen on the server each time the page is rebuilt (at
 *  most once a minute, on a visit), so the top of the home page shows
 *  a different lineup from one visit to the next without the picture
 *  flickering as it loads. */
function pickFeatured<T>(films: T[], count = 6): T[] {
  const pool = [...films];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export default async function HomePage() {
  const [films, ratings, views] = await Promise.all([
    getFilms(),
    getRatings(),
    getViewCounts(),
  ]);
  return (
    <>
      <JsonLd data={SITE_JSON_LD} />
      <Hero films={films} featured={pickFeatured(films)} />
      <div className="wrap">
      <HomePrompts films={films} />
      <ContinueWatching />
      <DiscoveryRows films={films} ratings={ratings} views={views} />
      <FilmGrid films={films} ratings={ratings} />
      </div>
    </>
  );
}
