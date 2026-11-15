import type { MetadataRoute } from "next";
import { getFilms } from "@/lib/films";
import { SITE_URL } from "@/lib/site";

/** Sitemap for search engines, generated from the live catalog so it can
 *  never go stale the way the old static file did (it listed only the
 *  homepage). Served at /sitemap.xml. Lists the homepage, every film
 *  page, and the legal pages. Account and admin pages are deliberately
 *  excluded; robots.ts keeps crawlers out of them. If the catalog query
 *  ever fails, the static entries still go out, so the sitemap never
 *  fully breaks.
 *
 *  Poster images are deliberately NOT included as image entries: the
 *  Mux poster URLs carry query strings (?width=800&time=90), and the
 *  generated XML writes the & raw, which makes the whole document
 *  invalid XML that browsers and strict parsers reject. Google reads
 *  the posters from the film pages themselves. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/cookies`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  try {
    const films = await getFilms();
    const filmEntries: MetadataRoute.Sitemap = films.map((film) => ({
      url: `${SITE_URL}/films/${film.slug}`,
      lastModified: film.created_at,
      changeFrequency: "monthly",
      priority: 0.8,
    }));
    return [...staticEntries, ...filmEntries];
  } catch {
    return staticEntries;
  }
}
