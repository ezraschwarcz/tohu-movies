import type { Film, RatingsRecord } from "@/lib/types";
import FilmCard from "./FilmCard";

/** A plain grid of film cards for the browse pages. */
export default function BrowseGrid({
  films,
  ratings,
}: {
  films: Film[];
  ratings: RatingsRecord;
}) {
  return (
    <div className="grid">
      {films.map((film) => (
        <FilmCard key={film.slug} film={film} rating={ratings[film.slug] ?? null} />
      ))}
    </div>
  );
}
