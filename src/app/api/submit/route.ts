import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { createSupabaseClient } from "@/lib/supabase";
import { createServiceSupabase } from "@/lib/supabase/service";

/** Receives the "Submit your film" form. The entry is stored in the
 *  database (control room, Tools) and super admins get a short email.
 *  A hidden field catches simple bots. */
export const dynamic = "force-dynamic";

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!input) {
    return NextResponse.json({ ok: false, message: "That did not come through. Try again." }, { status: 400 });
  }
  const field = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
  if (field("website")) {
    // The hidden field was filled in: a bot. Pretend all is well.
    return NextResponse.json({ ok: true });
  }
  const entry = {
    title: field("title"),
    year: field("year"),
    role: field("role"),
    name: field("name"),
    email: field("email"),
    link: field("link"),
    rights: field("rights"),
    message: field("message"),
  };
  const { error } = await createSupabaseClient().rpc("submit_film", { p: entry });
  if (error) {
    const missing = error.code === "PGRST202";
    return NextResponse.json({
      ok: false,
      message: missing
        ? "The form is not switched on yet. Please email hello@tohumovies.com instead."
        : error.message,
    });
  }

  // Tell the super admins. Best effort: the entry is already saved.
  try {
    const db = createServiceSupabase();
    if (db) {
      const { data } = await db.rpc("super_admin_emails");
      for (const row of ((data ?? []) as { email: string }[]).slice(0, 5)) {
        await sendEmail({
          to: row.email,
          subject: `Film submission: ${entry.title.slice(0, 80)}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222;"><p><strong>${esc(entry.title)}</strong>${entry.year ? ` (${esc(entry.year)})` : ""}</p><p>From ${esc(entry.name)} &lt;${esc(entry.email)}&gt;${entry.role ? `, ${esc(entry.role)}` : ""}</p>${entry.link ? `<p>Link: ${esc(entry.link)}</p>` : ""}${entry.rights ? `<p>Rights: ${esc(entry.rights)}</p>` : ""}${entry.message ? `<p>${esc(entry.message)}</p>` : ""}<p>See all submissions in the control room, under Tools.</p></div>`,
          text: `${entry.title} ${entry.year}\nFrom ${entry.name} <${entry.email}> ${entry.role}\n${entry.link}\n${entry.rights}\n\n${entry.message}`,
        });
      }
    }
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
