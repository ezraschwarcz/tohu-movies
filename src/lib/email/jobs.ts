import type { SupabaseClient } from "@supabase/supabase-js";
import { formatRuntime, genresOf, getFilms } from "@/lib/films";
import { coverArtFor } from "@/lib/posters";
import { SITE_URL } from "@/lib/site";
import type { Film } from "@/lib/types";
import { sendEmail } from "./send";
import {
  fridayPickEmail,
  newFilmsEmail,
  replyEmail,
  type EmailFilmDetail,
} from "./templates";

/** The daily email run: the Friday Pick (on Fridays, with Saturday and
 *  Sunday as catch-up days), alerts for films added in the last week,
 *  and notices of replies to a member's comments.
 *
 *  Nobody is emailed twice: each send is claimed in the database
 *  before it goes out, and released again if the send fails. A daily
 *  cap keeps the run inside the email service's allowance; whatever is
 *  left over goes out on the next run. */

export function filmForEmail(film: Film): EmailFilmDetail {
  const art = coverArtFor(film);
  return {
    slug: film.slug,
    title: film.title,
    year: film.year,
    poster: art ? (art.startsWith("http") ? art : `${SITE_URL}${art}`) : null,
    facts: [
      String(film.year),
      formatRuntime(film.runtime_minutes),
      film.rating,
      genresOf(film).slice(0, 2).join(", "),
    ]
      .filter(Boolean)
      .join(" · "),
    synopsis:
      film.synopsis.length > 260
        ? `${film.synopsis.slice(0, 257).trimEnd()}…`
        : film.synopsis,
  };
}

export function unsubscribeUrl(token: string, kind: string): string {
  return `${SITE_URL}/unsubscribe?t=${token}&k=${kind}`;
}

/** The Friday on or just before today (Central time), as YYYY-MM-DD,
 *  if today is Friday, Saturday or Sunday; otherwise null. */
export function currentFriday(now = new Date()): string | null {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const back = { Fri: 0, Sat: 1, Sun: 2 }[get("weekday")];
  if (back === undefined) return null;
  const d = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")) - back));
  return d.toISOString().slice(0, 10);
}

/** The next Friday strictly after today (Central), as YYYY-MM-DD. */
export function nextFriday(now = new Date()): string {
  for (let i = 0; i < 8; i++) {
    const day = new Date(now.getTime() + i * 86400000);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
    }).format(day);
    if (weekday === "Fri") {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(day);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/** The hour (UTC) the daily cron runs; see vercel.json. */
const NEW_FILMS_HOUR_UTC = 15;

type Recipient = { user_id: string; email: string; name: string; unsub_token: string };

export type RunSummary = {
  friday_pick: number;
  new_films: number;
  replies: number;
  failed: number;
  capped: boolean;
  notes: string[];
};

export async function runDailyEmails(db: SupabaseClient): Promise<RunSummary> {
  const summary: RunSummary = {
    friday_pick: 0,
    new_films: 0,
    replies: 0,
    failed: 0,
    capped: false,
    notes: [],
  };
  let budget = Math.max(0, Number(process.env.EMAIL_DAILY_CAP ?? 80) || 80);
  const films = await getFilms();
  const bySlug = new Map(films.map((f) => [f.slug, f]));

  /** Claim, send, release on failure. Returns false when the cap is hit. */
  async function deliver(
    kind: string,
    key: string,
    userId: string,
    to: string,
    message: { subject: string; html: string; text: string },
    unsub: string,
    count: "friday_pick" | "new_films" | "replies",
  ): Promise<boolean> {
    if (budget <= 0) {
      summary.capped = true;
      return false;
    }
    const claim = await db.rpc("email_claim", { p_kind: kind, p_key: key, p_user: userId });
    if (claim.error || claim.data !== true) return true;
    budget -= 1;
    const out = await sendEmail({ to, ...message, unsubscribeUrl: unsub });
    if (out.ok) {
      summary[count] += 1;
    } else {
      summary.failed += 1;
      if (summary.notes.length < 3) summary.notes.push(out.error);
      await db.rpc("email_unclaim", { p_kind: kind, p_key: key, p_user: userId });
      // The email service is refusing: stop instead of hammering it.
      if (!out.skipped && /429|rate|quota|limit/i.test(out.error)) {
        budget = 0;
        summary.capped = true;
      }
    }
    return true;
  }

  // 1. Replies first: they are personal and time-sensitive.
  const replies = await db.rpc("email_pending_replies", { p_limit: 100 });
  if (replies.error) summary.notes.push(`replies: ${replies.error.message}`);
  for (const r of (replies.data ?? []) as (Recipient & {
    reply_id: string;
    replier: string;
    body: string;
    film_slug: string;
    film_title: string;
  })[]) {
    const unsub = unsubscribeUrl(r.unsub_token, "replies");
    const ok = await deliver(
      "reply",
      r.reply_id,
      r.user_id,
      r.email,
      replyEmail({
        replier: r.replier,
        body: r.body,
        filmTitle: r.film_title,
        filmSlug: r.film_slug,
        unsubscribeUrl: unsub,
      }),
      unsub,
      "replies",
    );
    if (!ok) break;
  }

  // 2. The Friday Pick.
  const friday = currentFriday();
  if (friday) {
    const pick = await db.rpc("email_friday_pick", { p_date: friday });
    const row = ((pick.data ?? []) as { film_slug: string; note: string | null }[])[0];
    const film = row ? bySlug.get(row.film_slug) : undefined;
    if (pick.error) summary.notes.push(`pick: ${pick.error.message}`);
    if (film) {
      const list = await db.rpc("email_recipients", {
        p_kind: "friday_pick",
        p_key: friday,
        p_limit: 500,
      });
      for (const m of (list.data ?? []) as Recipient[]) {
        const unsub = unsubscribeUrl(m.unsub_token, "friday_pick");
        const ok = await deliver(
          "friday_pick",
          friday,
          m.user_id,
          m.email,
          fridayPickEmail({
            name: m.name,
            film: filmForEmail(film),
            note: row.note,
            unsubscribeUrl: unsub,
          }),
          unsub,
          "friday_pick",
        );
        if (!ok) break;
      }
    }
  }

  // 3. New films: at most one email per member per day, listing every
  //    film added since the previous daily run. The window is the 24 hours
  //    ending at the most recent 15:00 UTC (the cron time), so a run started
  //    by hand from the admin page covers the same films and the same day,
  //    and a film is only ever announced on one day. A film loaded in bulk
  //    (a whole library at once) goes out as one email, not one per film.
  const end = new Date();
  if (end.getUTCHours() < NEW_FILMS_HOUR_UTC) end.setUTCDate(end.getUTCDate() - 1);
  end.setUTCHours(NEW_FILMS_HOUR_UTC, 0, 0, 0);
  const start = end.getTime() - 24 * 60 * 60 * 1000;
  const fresh = films
    .filter((f) => {
      const added = Date.parse(f.created_at);
      return added >= start && added < end.getTime();
    })
    .reverse();
  if (fresh.length > 0) {
    const day = end.toISOString().slice(0, 10);
    const list = await db.rpc("email_recipients", {
      p_kind: "new_films",
      p_key: day,
      p_limit: 500,
    });
    if (list.error) summary.notes.push(`new films: ${list.error.message}`);
    for (const m of (list.data ?? []) as Recipient[]) {
      const unsub = unsubscribeUrl(m.unsub_token, "new_films");
      const ok = await deliver(
        "new_films",
        day,
        m.user_id,
        m.email,
        newFilmsEmail({ films: fresh.map(filmForEmail), unsubscribeUrl: unsub }),
        unsub,
        "new_films",
      );
      if (!ok) break;
    }
  }

  return summary;
}
