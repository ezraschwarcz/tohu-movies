import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/site";

/** For uptime monitors: answers "ok" when the site is up and the database
 *  responds, and a 503 when the database does not. Reveals nothing else. */
export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/films?select=slug&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    database = res.ok;
  } catch {
    database = false;
  }
  return Response.json(
    { status: database ? "ok" : "degraded" },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
