import { getBrowserSupabase } from "@/lib/supabase/client";

/** Anonymous counters behind the control room's Insights tab. Each
 *  call adds one to a daily total in the database; nothing about who
 *  did it is sent or stored. Failures are ignored: counting must never
 *  get in the way of watching or signing in. */

export type FilmEvent = "open" | "play" | "q25" | "q50" | "q75" | "done";
export type SignupEvent =
  | "page_open"
  | "code_requested"
  | "code_verified"
  | "google_started"
  | "welcome_done"
  | "welcome_skipped";

/** Count a step once per film per browser session, so a reload or a
 *  rewind does not count twice. */
export function trackFilmEvent(slug: string, event: FilmEvent): void {
  const key = `tohu-fe-${slug}-${event}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // storage unavailable: count anyway
  }
  void getBrowserSupabase()
    .rpc("track_film_event", { p_slug: slug, p_event: event })
    .then(
      () => {},
      () => {},
    );
}

export function trackSignupEvent(event: SignupEvent): void {
  const key = `tohu-se-${event}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // storage unavailable: count anyway
  }
  void getBrowserSupabase()
    .rpc("track_signup_event", { p_event: event })
    .then(
      () => {},
      () => {},
    );
}
