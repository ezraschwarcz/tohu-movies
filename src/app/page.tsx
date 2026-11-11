import { getFilms, getRatings } from "@/lib/films";
import ContinueWatching from "@/components/ContinueWatching";
import Hero from "@/components/Hero";
import FilmGrid from "@/components/FilmGrid";

/** Home page. Films and shared ratings come from Supabase at request
 *  time (cached 60s); a film added to the database appears within that
 *  window without a rebuild.
 *  Note: the revalidate value is a literal on purpose. Route segment
 *  config is read by static analysis, and an imported constant is
 *  flagged as an unsupported value at build time. */
export const revalidate = 60;

export default async function HomePage() {
  const [films, ratings] = await Promise.all([getFilms(), getRatings()]);
  return (
    <div className="wrap">
      <Hero films={films} />
      <ContinueWatching />
      <FilmGrid films={films} ratings={ratings} />
    </div>
  );
}
