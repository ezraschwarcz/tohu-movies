import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/supabase/server";
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
  return (
    <div className="wrap admin-wrap">
      <div className="section-head">
        <h2>Control room</h2>
        <p className="now-count">Films, comments, members and tools</p>
      </div>
      <AdminPanel adminId={userId} />
    </div>
  );
}
