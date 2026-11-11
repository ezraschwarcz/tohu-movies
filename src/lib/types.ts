export type Film = {
  slug: string;
  title: string;
  year: number;
  /** Comma-separated genre list, e.g. "Horror, Thriller, Fantasy". */
  genre: string;
  director: string;
  /** Comma-separated cast list. The database column is cast_text because
   *  `cast` is a reserved word in Postgres. */
  cast_text: string;
  /** "PG 13" | "R" | "PG" | "NR" | "TV PG" */
  rating: string;
  runtime_minutes: number;
  synopsis: string;
  warnings: string;
  playback_id: string;
  created_at: string;
};

export type RatingSummary = {
  average: number;
  count: number;
};

/** film slug -> shared average and count. A plain record (not a Map) so
 *  it stays serializable through Next.js caching. */
export type RatingsRecord = Record<string, RatingSummary>;

export type SortKey = "default" | "newest" | "top-rated" | "az";
