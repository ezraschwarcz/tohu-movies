/** Profile completion, shared by the home banner and the profile hub.
 *
 *  Three required steps, each worth a third: a display name, a
 *  password (the `password_set` flag in auth user metadata, set when
 *  an account is created with a password, when a password is set or
 *  reset), and at least one favorite genre (`favorite_genres` in auth
 *  user metadata, up to 3). A passkey is an optional bonus step and
 *  never counts toward the percentage. All of it lives in Supabase
 *  auth user metadata (and the existing profiles row for the name) —
 *  no database schema changes. */

export type ProfileCompletion = {
  hasName: boolean;
  hasPassword: boolean;
  genres: string[];
  /** 0, 33, 67, or 100. */
  percent: number;
  complete: boolean;
};

export function favoriteGenresFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  const raw = metadata?.favorite_genres;
  if (!Array.isArray(raw)) return [];
  return raw.filter((g): g is string => typeof g === "string").slice(0, 3);
}

export function passwordSetFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return metadata?.password_set === true;
}

export function computeProfileCompletion(input: {
  displayName: string | null | undefined;
  passwordSet: boolean;
  favoriteGenres: string[];
}): ProfileCompletion {
  const hasName = Boolean(input.displayName?.trim());
  const hasPassword = input.passwordSet;
  const genres = input.favoriteGenres.slice(0, 3);
  const done = [hasName, hasPassword, genres.length > 0].filter(
    Boolean,
  ).length;
  const percent = Math.round((done / 3) * 100);
  return {
    hasName,
    hasPassword,
    genres,
    percent,
    complete: done === 3,
  };
}
