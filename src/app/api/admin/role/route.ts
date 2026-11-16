import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { accessChangeEmail } from "@/lib/email/templates";
import { createServerSupabase } from "@/lib/supabase/server";

/** Change a member's access (member / admin / super admin) and send
 *  the notification emails.
 *
 *  The rules are enforced in the database, not here: the change is
 *  made by admin_set_role with the caller's own session, so it fails
 *  for anyone who is not allowed to make it (see
 *  supabase/migrations/20261116b_super_admins.sql). This route only
 *  adds the emails: one to the member whose access changed, and a
 *  notice to every super admin, so access never changes silently.
 *
 *  The access change stands even if an email cannot be sent; the
 *  reply says which happened, and both are written to the admin log. */
export const dynamic = "force-dynamic";

const ROLES = ["member", "admin", "super_admin"] as const;
type Role = (typeof ROLES)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = {
  name: string | null;
  email: string | null;
  previous: Role;
  role: Role;
  actor: string;
  super_admin_emails: string[];
};

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as {
    userId?: unknown;
    role?: unknown;
  } | null;
  const userId = typeof input?.userId === "string" ? input.userId : "";
  const role = ROLES.find((r) => r === input?.role);
  if (!UUID.test(userId) || !role) {
    return NextResponse.json(
      { ok: false, message: "That request was not understood." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_set_role", {
    p_user: userId,
    p_role: role,
  });
  if (error || !data) {
    const text = error?.message ?? "";
    const missing =
      error?.code === "PGRST202" || /could not find the function/i.test(text);
    return NextResponse.json(
      {
        ok: false,
        message: missing
          ? "This needs the super-admin database update. Run supabase/migrations/20261116b_super_admins.sql in the Supabase SQL Editor, then try again."
          : text || "The change was not made.",
      },
      { status: missing ? 503 : 403 },
    );
  }

  const result = data as Result;
  const name = result.name || "A member";
  const when = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  });

  // The member themself, then every super admin (once each, and not
  // the member again if they are one).
  const sent: string[] = [];
  const failed: string[] = [];
  let skipped = false;
  const track = async (to: string, who: "you" | string) => {
    const mail = accessChangeEmail({ who, role: result.role, actor: result.actor, when });
    const out = await sendEmail({ to, ...mail });
    if (out.ok) sent.push(who === "you" ? "the member" : "a super admin");
    else if (out.skipped) skipped = true;
    else failed.push(out.error);
  };
  const own = result.email?.toLowerCase() ?? null;
  if (result.email) await track(result.email, "you");
  const seen = new Set<string>(own ? [own] : []);
  for (const address of result.super_admin_emails ?? []) {
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    await track(address, name);
  }

  const emailNote = skipped
    ? "No notification email was sent: the site has no sending key."
    : failed.length > 0
      ? `Some notification emails could not be sent (${failed[0]}).`
      : `Notification emails sent: ${sent.length}.`;
  try {
    await supabase.rpc("admin_log_event", {
      p_action: "Access emails",
      p_target: name,
      p_detail: emailNote,
    });
  } catch {
    // The access change itself is already logged by the database.
  }

  const done =
    result.role === "member"
      ? `${name} is no longer an admin.`
      : result.role === "super_admin"
        ? `${name} is now a super admin.`
        : `${name} is now an admin.`;
  return NextResponse.json({ ok: true, message: `${done} ${emailNote}` });
}
