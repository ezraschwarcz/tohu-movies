import { getFilms, genresOf } from "@/lib/films";
import { SITE_URL, TAGLINE } from "@/lib/site";

/** llms.txt: a plain-text summary of the site for AI assistants and
 *  crawlers, generated from the live catalog so the film list is always
 *  complete and current (the old static copy lived at the repo root,
 *  where the app could not serve it, and drifted out of date). Served
 *  at /llms.txt. */
export async function GET() {
  let filmLines: string[] = [];
  try {
    const films = await getFilms();
    filmLines = films.map((film) => {
      const genres = genresOf(film).join(", ").toLowerCase();
      return `- [${film.title} (${film.year})](${SITE_URL}/films/${film.slug}), ${genres}`;
    });
  } catch {
    filmLines = [];
  }

  const body = [
    "# Tohu Movies",
    "",
    `> Tohu Movies is a free, ad supported streaming service for independent films. ${TAGLINE}`,
    "",
    `- Website: ${SITE_URL}/`,
    "- Films stream free with ads. No account required to watch.",
    "",
    "## Films streaming now",
    "",
    ...filmLines,
    "",
    "## More",
    "",
    `- [Privacy Policy](${SITE_URL}/privacy)`,
    `- [Terms of Service](${SITE_URL}/terms)`,
    `- [Cookie Notice](${SITE_URL}/cookies)`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
