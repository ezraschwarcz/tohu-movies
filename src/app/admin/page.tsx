import { notFound } from "next/navigation";
import { createServerSupabase, getServerAuth } from "@/lib/supabase/server";
import { embeddedOne } from "@/lib/types";
import AdminPanel from "@/components/AdminPanel";

/** Admin panel: comment moderation and adding films. Protected by the
 *  profile's is_admin flag, checked here on every load. Non-admins and
 *  signed-out visitors get a 404, so the route does not reveal itself.
 *  This page is dynamic: it reads the session from the request's
 *  cookies. It needs the Phase 2 migration SQL run first (admin read
 *  access to pending comments, admin insert on films). */
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { isAdmin } = await getServerAuth();
  if (!isAdmin) {
    notFound();
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id,film_slug,body,status,user_id,created_at,profiles(display_name),films(title)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`Supabase pending comments query failed: ${error.message}`);
  }

  // Normalize the embedded joins (object or array) to one object each.
  const pending = (
    (data ?? []) as unknown as React.ComponentProps<
      typeof AdminPanel
    >["initialPending"]
  ).map((c) => ({
    ...c,
    profiles: embeddedOne(
      c.profiles as unknown as
        | { display_name: string }
        | { display_name: string }[]
        | null,
    ),
    films: embeddedOne(
      c.films as unknown as { title: string } | { title: string }[] | null,
    ),
  }));

  return (
    <div className="wrap admin-wrap">
      <div className="section-head">
        <h2>Admin</h2>
        <p className="now-count">Comment moderation and adding films</p>
      </div>
      <AdminPanel initialPending={pending} />
    </div>
  );
}
