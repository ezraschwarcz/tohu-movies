import type { Film } from "@/lib/types";

/** Actor and director pages, built from the names on each film. A new
 *  film's cast and director get pages by themselves. */

export type Person = {
  slug: string;
  name: string;
  directed: Film[];
  actedIn: Film[];
};

export function personSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Split "A, B (narrator), C" into clean names; drops placeholders
 *  such as "No principal cast listed". */
export function namesIn(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(",")
    .map((part) => part.replace(/\([^)]*\)/g, "").trim())
    .filter(
      (name) =>
        name.length > 2 &&
        name.length < 60 &&
        !/\b(no|non|none|cast|listed|narrative|various|unknown)\b/i.test(name),
    );
}

export function allPeople(films: Film[]): Person[] {
  const map = new Map<string, Person>();
  const get = (name: string) => {
    const slug = personSlug(name);
    if (!slug) return null;
    let person = map.get(slug);
    if (!person) {
      person = { slug, name, directed: [], actedIn: [] };
      map.set(slug, person);
    }
    return person;
  };
  for (const film of films) {
    for (const name of namesIn(film.director)) {
      const p = get(name);
      if (p && !p.directed.includes(film)) p.directed.push(film);
    }
    for (const name of namesIn(film.cast_text)) {
      const p = get(name);
      if (p && !p.actedIn.includes(film)) p.actedIn.push(film);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
