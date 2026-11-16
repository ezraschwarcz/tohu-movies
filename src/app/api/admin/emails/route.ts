import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { filmForEmail, runDailyEmails } from "@/lib/email/jobs";
import {
  fridayPickEmail,
  newFilmsEmail,
  replyEmail,
} from "@/lib/email/templates";
import { getFilms } from "@/lib/films";
import { SITE_URL } from "@/lib/site";
import { getServerAuth, createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

/** Admin tools for the optional emails.
 *  GET  ?kind=&slug=&note=   the email as it will look (HTML)
 *  POST {action:"test", ...} sends that email to the admin's own address
 *  POST {action:"run"}       runs today's send now (super admins only) */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Kind = "friday_pick" | "new_films" | "reply";

async function build(kind: Kind, slug: string | null, note: string | null) {
  const films = await getFilms();
  const film = films.find((f) => f.slug === slug) ?? films[0];
  if (!film) return null;
  const unsubscribeUrl = `${SITE_URL}/profile?view=preferences`;
  if (kind === "new_films") {
    return newFilmsEmail({ films: [filmForEmail(film)], unsubscribeUrl });
  }
  if (kind === "reply") {
    return replyEmail({
      replier: "Maya",
      body: "Agreed. That last scene stayed with me for days.",
      filmTitle: film.title,
      filmSlug: film.slug,
      unsubscribeUrl,
    });
  }
  return fridayPickEmail({
    name: "",
    film: filmForEmail(film),
    note: note?.trim() || null,
    unsubscribeUrl,
  });
}

function kindOf(value: unknown): Kind {
  return value === "new_films" || value === "reply" ? value : "friday_pick";
}

export async function GET(request: Request) {
  const { isAdmin } = await getServerAuth();
  if (!isAdmin) return new NextResponse("Not found", { status: 404 });
  const url = new URL(request.url);
  const mail = await build(
    kindOf(url.searchParams.get("kind")),
    url.searchParams.get("slug"),
    url.searchParams.get("note"),
  );
  if (!mail) return new NextResponse("No films yet.", { status: 404 });
  return new NextResponse(mail.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function POST(request: Request) {
  const { isAdmin, email } = await getServerAuth();
  if (!isAdmin || !email) {
    return NextResponse.json({ ok: false, message: "Admins only." }, { status: 404 });
  }
  const input = (await request.json().catch(() => ({}))) as {
    action?: string;
    kind?: string;
    slug?: string;
    note?: string;
  };

  if (input.action === "run") {
    const supabase = await createServerSupabase();
    const check = await supabase.rpc("is_super_admin");
    if (check.data !== true) {
      return NextResponse.json({ ok: false, message: "Only a super admin can run the send." });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: false, message: "The site has no sending key (RESEND_API_KEY) in Vercel." });
    }
    const db = createServiceSupabase();
    if (!db) {
      return NextResponse.json({
        ok: false,
        message: "The site has no database service key yet. Add SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.",
      });
    }
    const s = await runDailyEmails(db);
    try {
      await supabase.rpc("admin_log_event", {
        p_action: "Email run",
        p_target: "Started by hand",
        p_detail: `Friday Pick ${s.friday_pick}, new films ${s.new_films}, replies ${s.replies}, failed ${s.failed}`,
      });
    } catch {
      // not worth failing the request over
    }
    return NextResponse.json({
      ok: true,
      message: `Sent: Friday Pick ${s.friday_pick}, new-film alerts ${s.new_films}, replies ${s.replies}.${s.failed ? ` Failed: ${s.failed} (${s.notes[0] ?? "see Resend"}).` : ""}${s.capped ? " The daily cap was reached; the rest go out on the next run." : ""}`,
    });
  }

  const mail = await build(kindOf(input.kind), input.slug ?? null, input.note ?? null);
  if (!mail) return NextResponse.json({ ok: false, message: "No films yet." });
  const out = await sendEmail({ to: email, ...mail, subject: `[Test] ${mail.subject}` });
  return NextResponse.json(
    out.ok
      ? { ok: true, message: `Test sent to ${email}.` }
      : {
          ok: false,
          message: out.skipped
            ? "The site has no sending key (RESEND_API_KEY) in Vercel."
            : `The email service refused it: ${out.error}`,
        },
  );
}
