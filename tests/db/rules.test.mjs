// Database access rules, tested on a throwaway copy of the database.
//
// Every migration in supabase/migrations runs against a fresh in-memory
// Postgres (PGlite), on top of tests/db/base.sql (a stand-in for the tables
// that existed before the migrations). Then each test acts as a visitor, a
// member, a banned member, an admin or a super admin, and checks that the
// database itself allows or refuses the action, whatever the website does.
//
//   node --test tests/db

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

const SUPER = "00000000-0000-0000-0000-00000000000a";
const SUPER2 = "00000000-0000-0000-0000-00000000000b";
const ADMIN = "00000000-0000-0000-0000-00000000000c";
const ADMIN2 = "00000000-0000-0000-0000-00000000000d";
const MEMBER = "00000000-0000-0000-0000-00000000000e";
const OTHER = "00000000-0000-0000-0000-00000000000f";
const BANNED = "00000000-0000-0000-0000-000000000010";

const MIGRATIONS = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"));

let db;

async function fresh() {
  const pg = new PGlite();
  await pg.exec(readFileSync("tests/db/base.sql", "utf8"));
  for (const sql of MIGRATIONS) await pg.exec(sql);
  await pg.exec(`
    insert into auth.users (id, email) values
      ('${SUPER}', 'super@example.com'), ('${SUPER2}', 'super2@example.com'),
      ('${ADMIN}', 'admin@example.com'), ('${ADMIN2}', 'admin2@example.com'),
      ('${MEMBER}', 'member@example.com'), ('${OTHER}', 'other@example.com'),
      ('${BANNED}', 'banned@example.com');
    insert into public.profiles (id, display_name, is_admin, is_super_admin, is_banned) values
      ('${SUPER}', 'Super', true, true, false), ('${SUPER2}', 'Super Two', true, true, false),
      ('${ADMIN}', 'Admin', true, false, false), ('${ADMIN2}', 'Admin Two', true, false, false),
      ('${MEMBER}', 'Member', false, false, false), ('${OTHER}', 'Other', false, false, false),
      ('${BANNED}', 'Banned', false, false, true);
    insert into public.films (slug, title, year, runtime_minutes, playback_id) values
      ('jinn', 'Jinn', 2014, 97, 'abc');
  `);
  return pg;
}

/** Run SQL as someone: null = a signed-out visitor. Resolves to rows, or
 *  rejects with the database's refusal. */
async function as(user, sql, params = []) {
  const role = user ? "authenticated" : "anon";
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false); set role ${role};`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

async function isAdmin(id) {
  const rows = await db.query("select is_admin, is_super_admin from public.profiles where id = $1", [id]);
  return rows.rows[0];
}

before(async () => {
  db = await fresh();
});
after(async () => {
  await db.close();
});

describe("migrations", () => {
  test("every migration can be run twice without error", async () => {
    const pg = new PGlite();
    await pg.exec(readFileSync("tests/db/base.sql", "utf8"));
    for (const sql of MIGRATIONS) await pg.exec(sql);
    for (const sql of MIGRATIONS) await pg.exec(sql);
    await pg.close();
  });
});

describe("the control room is for admins only", () => {
  for (const fn of ["admin_overview()", "admin_list_members('', 0, 10)", "admin_list_films()", "admin_member_counts()"]) {
    test(`a visitor cannot call ${fn}`, async () => {
      await assert.rejects(as(null, `select public.${fn}`));
    });
    test(`a member cannot call ${fn}`, async () => {
      await assert.rejects(as(MEMBER, `select public.${fn}`));
    });
  }
  test("an admin can call admin_overview()", async () => {
    const rows = await as(ADMIN, "select public.admin_overview() as o");
    assert.ok(rows[0].o);
  });
});

describe("admin access rules", () => {
  test("a member cannot make themselves an admin by editing their profile", async () => {
    await as(MEMBER, `update public.profiles set is_admin = true where id = '${MEMBER}'`).catch(() => {});
    assert.equal((await isAdmin(MEMBER)).is_admin, false);
  });
  test("a regular admin cannot make someone an admin", async () => {
    await assert.rejects(as(ADMIN, `select public.admin_set_role('${MEMBER}', 'admin')`), /super admin/i);
    assert.equal((await isAdmin(MEMBER)).is_admin, false);
  });
  test("nobody can change their own access", async () => {
    await assert.rejects(as(SUPER, `select public.admin_set_role('${SUPER}', 'member')`), /your own access/i);
  });
  test("a super admin's access cannot be changed from the site, even by another super admin", async () => {
    await assert.rejects(as(SUPER, `select public.admin_set_role('${SUPER2}', 'member')`), /super admin/i);
    assert.equal((await isAdmin(SUPER2)).is_super_admin, true);
  });
  test("a banned member cannot be made an admin", async () => {
    await assert.rejects(as(SUPER, `select public.admin_set_role('${BANNED}', 'admin')`), /ban/i);
  });
  test("a super admin can make a member an admin, and it is logged", async () => {
    await as(SUPER, `select public.admin_set_role('${OTHER}', 'admin')`);
    assert.equal((await isAdmin(OTHER)).is_admin, true);
    const log = await db.query("select action from public.admin_log where target_id = $1", [OTHER]);
    assert.ok(log.rows.length > 0, "the change is written to the admin log");
  });
  test("an admin can remove a regular admin", async () => {
    await as(ADMIN, `select public.admin_set_role('${ADMIN2}', 'member')`);
    assert.equal((await isAdmin(ADMIN2)).is_admin, false);
  });
  test("the admin log cannot be read or edited directly by anyone signed in", async () => {
    await assert.rejects(as(SUPER, "select * from public.admin_log"));
    await assert.rejects(as(SUPER, "delete from public.admin_log"));
  });
});

describe("comments", () => {
  test("a visitor cannot post a comment", async () => {
    await assert.rejects(as(null, `insert into public.comments (film_slug, body, user_id) values ('jinn', 'hi', null)`));
  });
  test("a member cannot post a comment as someone else", async () => {
    await assert.rejects(as(MEMBER, `insert into public.comments (film_slug, body, user_id) values ('jinn', 'hi', '${OTHER}')`));
  });
  test("a member can post a comment as themselves", async () => {
    await as(MEMBER, `insert into public.comments (film_slug, body, user_id) values ('jinn', 'Loved it', '${MEMBER}')`);
  });
  test("a banned member cannot post a comment", async () => {
    await assert.rejects(as(BANNED, `insert into public.comments (film_slug, body, user_id) values ('jinn', 'spam', '${BANNED}')`));
  });
});

describe("private member data", () => {
  test("a member cannot read another member's email settings", async () => {
    await db.query(`insert into public.email_prefs (user_id) values ('${OTHER}') on conflict do nothing`);
    const rows = await as(MEMBER, `select * from public.email_prefs where user_id = '${OTHER}'`);
    assert.equal(rows.length, 0);
  });
  test("a visitor cannot read email settings at all", async () => {
    await assert.rejects(as(null, "select * from public.email_prefs"));
  });
  test("the email system's functions cannot be called by members", async () => {
    await assert.rejects(as(MEMBER, "select * from public.email_recipients('new_films', 'x', 10)"));
    await assert.rejects(as(MEMBER, "select * from public.email_new_films()"));
  });
  test("a public profile never includes an email address", async () => {
    const rows = await as(null, `select public.public_profile('${MEMBER}') as p`);
    assert.ok(!JSON.stringify(rows[0].p ?? {}).includes("@"), "no email in the public profile");
  });
  test("a visitor cannot read email addresses from the profiles table", async () => {
    await assert.rejects(as(null, "select email from auth.users"));
  });
});

describe("security advisor fixes", () => {
  before(async () => {
    await db.query(`insert into storage.objects (bucket_id, name) values
      ('avatars', '${MEMBER}/avatar.jpg'), ('avatars', '${OTHER}/avatar.jpg'), ('posters', 'jinn.jpg')`);
  });
  test("nobody can call the sign-up set-up function directly", async () => {
    await assert.rejects(as(null, "select public.handle_new_user()"));
    await assert.rejects(as(MEMBER, "select public.handle_new_user()"));
  });
  test("set_updated_at has a fixed search path", async () => {
    const rows = await db.query("select proconfig from pg_proc where proname = 'set_updated_at'");
    assert.ok(String(rows.rows[0].proconfig).includes("search_path"));
  });
  test("a visitor cannot list photo or poster files", async () => {
    const rows = await as(null, "select name from storage.objects");
    assert.equal(rows.length, 0);
  });
  test("a member sees only their own photo file", async () => {
    const rows = await as(MEMBER, "select name from storage.objects");
    assert.deepEqual(rows.map((r) => r.name), [`${MEMBER}/avatar.jpg`]);
  });
  test("an admin can see poster files", async () => {
    const rows = await as(ADMIN, "select name from storage.objects where bucket_id = 'posters'");
    assert.equal(rows.length, 1);
  });
});
