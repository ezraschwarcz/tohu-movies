import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerSupabase, getServerAuth } from "@/lib/supabase/server";
import AdminPanel from "@/components/AdminPanel";

/** The admin control room: overview, films, comments, members, tools.
 *  Protected by the profile's admin flag, checked here on every load;
 *  everyone else gets a 404, so the page does not reveal itself. Every
 *  action is checked again inside the database, so this page is a
 *  convenience, not the lock. */
export const metadata: Metadata = {
  title: "Admin — Tohu Movies",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { isAdmin, userId } = await getServerAuth();
  if (!isAdmin || !userId) {
    notFound();
  }
  // Super admins see the controls for giving admin access. Asked of the
  // database, which is also what enforces it. False until the
  // super-admin database update has run.
  const supabase = await createServerSupabase();
  const { data: superFlag } = await supabase.rpc("is_super_admin");
  const isSuperAdmin = superFlag === true;

  return (
    <div className="wrap admin-wrap">
      <div className="section-head">
        <h2>Control room</h2>
        <p className="now-count">
          Films, comments, members and tools
          {isSuperAdmin ? " · you are a super admin" : ""}
        </p>
      </div>
      <AdminPanel adminId={userId} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
