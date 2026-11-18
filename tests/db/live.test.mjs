// The real database, checked from outside as a signed-out visitor.
//
// Uses only the public key every visitor's browser already has, so it needs
// no password and changes nothing: every write below is one the database
// must refuse. If a test here fails, something private became public.
//
//   node --test tests/db/live.test.mjs
//   (set SUPABASE_URL / SUPABASE_PUBLIC_KEY to check another project)

import { test } from "node:test";
import assert from "node:assert/strict";

const URL = process.env.SUPABASE_URL ?? "https://fsyctibngbqjswizwuww.supabase.co";
const KEY = process.env.SUPABASE_PUBLIC_KEY ?? "sb_publishable_APwY3mhnSdBlq1lAIOkA3Q_8CrpMsa5";
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function call(path, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

/** Refused outright, or allowed but returning nothing. */
function nothingVisible(r, what) {
  const refused = r.status === 401 || r.status === 403;
  const empty = r.status === 200 && Array.isArray(r.body) && r.body.length === 0;
  assert.ok(refused || empty, `${what}: expected refused or empty, got ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
}

function refused(r, what) {
  assert.ok(r.status === 401 || r.status === 403, `${what}: expected refused, got ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
}

test("the film catalog is public", async () => {
  const r = await call("films?select=slug&limit=1");
  assert.equal(r.status, 200);
  assert.ok(r.body.length === 1);
});

for (const table of [
  "email_prefs", "email_sends", "admin_log", "member_blocks", "comment_reports",
  "film_events", "signup_events", "film_submissions", "friday_picks", "film_views",
]) {
  test(`visitors cannot read ${table}`, async () => {
    refused(await call(`${table}?select=*&limit=1`), table);
  });
}

for (const table of ["watchlist", "continue_watching"]) {
  test(`visitors see no one's ${table}`, async () => {
    nothingVisible(await call(`${table}?select=*&limit=1`), table);
  });
}

test("visitors see only public profile fields", async () => {
  assert.equal((await call("profiles?select=id,display_name&limit=1")).status, 200);
  for (const col of ["is_admin", "is_banned", "banned_reason"]) {
    refused(await call(`profiles?select=${col}&limit=1`), `profiles.${col}`);
  }
});

test("visitors cannot see who rated what", async () => {
  refused(await call("ratings?select=voter_id&limit=1"), "ratings.voter_id");
});

test("visitors cannot see comments waiting for moderation", async () => {
  nothingVisible(await call("comments?select=id&status=eq.pending&limit=1"), "pending comments");
});

for (const fn of ["admin_overview", "admin_set_role", "email_recipients", "super_admin_emails", "my_profile_summary"]) {
  test(`visitors cannot call ${fn}`, async () => {
    const args = fn === "admin_set_role" ? { p_user: "00000000-0000-0000-0000-000000000000", p_role: "admin" }
      : fn === "email_recipients" ? { p_kind: "new_films", p_key: "x", p_limit: 1 } : {};
    refused(await call(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) }), fn);
  });
}

test("visitors cannot post comments", async () => {
  const r = await call("comments", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ film_slug: "jinn", body: "check" }) });
  refused(r, "insert comment");
});

test("visitors cannot change films", async () => {
  const r = await call("films?slug=eq.jinn", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ title: "Jinn" }) });
  nothingVisible(r, "update film");
});
