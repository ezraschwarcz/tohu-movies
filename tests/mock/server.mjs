// A stand-in for Supabase, used by the automated tests and for checking
// layouts locally without touching the real database. It answers the
// handful of requests the site makes with fixed sample data.
//
// Sign-in: a request whose bearer token is "test-member" or "test-admin"
// is treated as that signed-in person (see tests/helpers.ts). Anything
// else is a signed-out visitor.
//
//   node tests/mock/server.mjs        (listens on http://127.0.0.1:54321)

import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.MOCK_PORT ?? 54321);
const base = JSON.parse(readFileSync(new URL("./films.json", import.meta.url), "utf8"));

const SYNOPSIS =
  "Two struggling actors and best friends fall for the same woman, and their friendship and careers come apart.";
const films = base.map((f, i) => ({
  ...f,
  director: "Jane Doe",
  cast_text: "A Person, B Person",
  synopsis: SYNOPSIS,
  warnings: i % 3 === 0 ? "Language." : "",
  playback_id: `mock${i}`,
  // Newest first in the fixture; one hour apart, all before the tests run.
  created_at: new Date(Date.UTC(2026, 10, 11) - i * 3600e3).toISOString(),
}));

const PEOPLE = {
  "test-member": { id: "00000000-0000-0000-0000-000000000002", email: "maya@example.com", name: "Maya", admin: false },
  "test-admin": { id: "00000000-0000-0000-0000-000000000001", email: "ezra@example.com", name: "Ezra", admin: true },
};

function whoIs(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  return PEOPLE[token] ?? null;
}

const member = (i) => ({
  id: `00000000-0000-0000-0000-00000000000${i}`,
  email: ["ezra@example.com", "dana@example.com", "maya@example.com", "spamking@example.com", "a.very.long.email.address.for.testing@example-domain.com"][i],
  display_name: ["Ezra", "Dana", "Maya", "spam_king", ""][i],
  avatar_preset: null,
  avatar_url: null,
  created_at: `2026-10-0${i + 1}T12:00:00Z`,
  last_sign_in_at: i === 4 ? null : `2026-11-1${i}T12:00:00Z`,
  is_admin: i < 3,
  is_super_admin: i === 0,
  is_banned: i === 3,
  banned_reason: i === 3 ? "Posting links" : null,
  comments: i * 3,
});

const comments = [
  ["Loved the ending, did not see it coming.", "Maya", 2],
  ["This one is underrated. The practical effects hold up better than most studio films from the same year.", "Dana", 1],
].map(([body, name, who], i) => ({
  id: `c${i}`,
  film_slug: films[0].slug,
  body,
  status: "approved",
  parent_id: null,
  user_id: `00000000-0000-0000-0000-00000000000${who}`,
  created_at: `2026-11-1${i}T12:00:00Z`,
  profiles: { display_name: name, avatar_preset: null, avatar_url: null },
}));

/** Rows for a table read, honouring ?slug=eq.x and ?film_slug=eq.x. */
function table(name, url, person) {
  const eq = (key) => url.searchParams.get(key)?.replace(/^eq\./, "");
  switch (name) {
    case "films": {
      const slug = eq("slug");
      return slug ? films.filter((f) => f.slug === slug) : films;
    }
    case "ratings":
      return films.slice(0, 20).flatMap((f, i) => [
        { film_slug: f.slug, stars: 5 - (i % 3) },
        { film_slug: f.slug, stars: 4 },
      ]);
    case "comments": {
      const slug = eq("film_slug");
      return slug ? comments.filter((c) => c.film_slug === slug) : comments;
    }
    case "profiles":
      return person
        ? [{ id: person.id, display_name: person.name, is_admin: person.admin, bio: "Here for the low-budget gems.", avatar_preset: "popcorn", avatar_url: null }]
        : [];
    case "watchlist":
      return person ? films.slice(3, 6).map((f) => ({ film_slug: f.slug, user_id: person.id })) : [];
    case "email_prefs":
      return person ? [{ user_id: person.id, friday_pick: true, new_films: true, replies: true }] : [];
    default:
      return [];
  }
}

/** Answers for database functions (/rest/v1/rpc/<name>). */
function rpc(name, person) {
  const admin = person?.admin === true;
  switch (name) {
    case "is_admin":
      return admin;
    case "is_super_admin":
      return admin;
    case "film_view_counts":
      return films.slice(0, 11).map((f, i) => ({ film_slug: f.slug, views: 50 - i }));
    case "my_film_ratings":
      return person ? films.slice(2, 5).map((f, i) => ({ film_slug: f.slug, stars: 5 - i })) : [];
    case "public_profile":
      return {
        id: "00000000-0000-0000-0000-000000000002",
        display_name: "Maya",
        avatar_preset: null,
        avatar_url: null,
        bio: "Horror and thriller fan. Here for the low-budget gems nobody else has heard of.",
        created_at: "2026-10-03T12:00:00Z",
        comment_count: 1,
        comments: [{ id: "c0", body: comments[0].body, created_at: comments[0].created_at, film_slug: films[0].slug, film_title: films[0].title }],
      };
    case "my_profile_summary":
      return person
        ? {
            member_since: "2026-10-03T12:00:00Z",
            bio: "Here for the low-budget gems.",
            watchlist: 3,
            comments: 4,
            rated: 3,
            started: 6,
            finished: 4,
            minutes: 1040,
            history: films.slice(0, 6).map((f, i) => ({
              film_slug: f.slug, title: f.title, year: f.year, playback_id: f.playback_id, poster_url: null,
              position_seconds: [5200, 900, 5400, 2400, 300, 5000][i], duration_seconds: 5600,
              updated_at: new Date(Date.UTC(2026, 10, 15) - i * 86400000 * 2).toISOString(),
            })),
            ratings: films.slice(2, 5).map((f, i) => ({ film_slug: f.slug, title: f.title, year: f.year, poster_url: null, stars: 5 - i, updated_at: "2026-11-12T12:00:00Z" })),
            recent_comments: comments.map((c) => ({ id: c.id, body: c.body, status: c.status, created_at: c.created_at, film_slug: c.film_slug, film_title: films[0].title })),
          }
        : null;
    case "unsubscribe_email":
      return "friday_pick";
  }
  if (!admin) return null;
  switch (name) {
    case "admin_overview":
      return {
        members: 1284, members_7d: 96, members_30d: 402, admins: 2, banned: 3, films: films.length, hidden_films: 1,
        comments: 341, pending_comments: 4, views_7d: 2210, views_30d: 9120, views_all: 48211,
        top_films: films.slice(0, 8).map((f, i) => ({ slug: f.slug, title: f.title, views: 900 - i * 83 })),
        sources: [{ source: "x.com", members: 88 }, { source: "direct", members: 80 }, { source: "google.com", members: 32 }],
        recent: [{ action: "Film added", target: films[0].title, detail: null, created_at: "2026-11-15T20:00:00Z", admin: "Ezra" }],
      };
    case "admin_member_counts":
      return { total: 1284, new_7d: 96, admins: 3, super_admins: 1, banned: 3 };
    case "admin_list_films":
      return films.map((f, i) => ({ ...f, is_hidden: i === 2, poster_url: null, views: 500 - i * 7, comments: i % 5 }));
    case "admin_list_comments":
      return [0, 1, 2].map((i) => ({
        id: `p${i}`, film_slug: films[i].slug, film_title: films[i].title,
        body: ["Loved the ending.", "Where was this filmed?", "check out my site www.spam.example"][i],
        status: "pending", user_id: member(i + 1).id, display_name: member(i + 1).display_name,
        is_banned: i === 2, created_at: `2026-11-1${i}T12:00:00Z`,
      }));
    case "admin_list_reports":
      return [];
    case "admin_list_members":
      return [0, 1, 2, 3, 4].map(member);
    case "admin_list_log":
      return [["Made admin", "Dana", "Was: member", "Ezra"], ["Film edited", films[0].title, null, "Dana"]].map((r, i) => ({
        id: 99 - i, action: r[0], target: r[1], detail: r[2], admin: r[3], created_at: `2026-11-1${5 - i}T10:20:00Z`,
      }));
    case "admin_insights":
      return {
        days: 30,
        viewing: { open: 4210, play: 2630, q25: 1710, q50: 1220, q75: 930, done: 610 },
        films: films.slice(0, 6).map((f, i) => ({ slug: f.slug, title: f.title, open: 900 - i * 90, play: 600 - i * 62, q25: 400 - i * 40, q50: 300 - i * 31, q75: 220 - i * 22, done: 150 - i * 15 })),
        signup: { page_open: 820, code_requested: 540, code_verified: 402, welcome_done: 288, welcome_skipped: 61, google_started: 140 },
        new_accounts: 402,
      };
    case "admin_email_overview":
      return { members: 1284, friday_pick: 900, new_films: 850, replies: 1100, sent_7d: {}, sent_today: 0, picks: [] };
    case "admin_list_submissions":
      return [];
    default:
      return null;
  }
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url ?? "/", "http://localhost");
  const person = whoIs(req);

  if (url.pathname === "/auth/v1/user") {
    if (!person) return send(res, 401, { message: "not signed in" });
    return send(res, 200, {
      id: person.id, aud: "authenticated", role: "authenticated", email: person.email,
      created_at: "2026-10-01T12:00:00Z", app_metadata: { provider: "email" },
      user_metadata: { display_name: person.name, password_set: true, favorite_genres: ["Drama"] },
    });
  }
  if (url.pathname === "/auth/v1/passkeys") {
    return send(res, 200, person ? [{ id: "pk1", friendly_name: "iPhone", created_at: "2026-11-01T12:00:00Z", last_used_at: "2026-11-15T12:00:00Z" }] : []);
  }
  if (url.pathname.startsWith("/auth/v1/")) return send(res, 200, {});

  const rpcMatch = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
  if (rpcMatch) return send(res, 200, rpc(rpcMatch[1], person));

  const tableMatch = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (tableMatch) {
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 201, []);
    const rows = table(tableMatch[1], url, person);
    const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    return send(res, 200, single ? (rows[0] ?? null) : rows);
  }
  if (url.pathname.startsWith("/storage/v1/")) return send(res, 200, []);
  send(res, 404, { message: "not in the stand-in" });
}).listen(PORT, "127.0.0.1", () => console.log(`Stand-in Supabase on http://127.0.0.1:${PORT}`));
