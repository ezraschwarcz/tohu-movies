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

export default async function HomePage() {
  const [films, ratings, views] = await Promise.all([
    getFilms(),
    getRatings(),
    getViewCounts(),
  ]);
  return (
    <div className="wrap">
      <JsonLd data={SITE_JSON_LD} />
      <Hero films={films} />
      <HomePrompts films={films} />
      <ContinueWatching />
      <DiscoveryRows films={films} ratings={ratings} views={views} />
      <FilmGrid films={films} ratings={ratings} />
    </div>
  );
}
