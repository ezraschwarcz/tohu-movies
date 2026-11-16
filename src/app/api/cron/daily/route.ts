import { NextResponse } from "next/server";
import { runDailyEmails } from "@/lib/email/jobs";
import { createServiceSupabase } from "@/lib/supabase/service";

/** The daily email run, called by Vercel's scheduler (vercel.json).
 *  Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else
 *  is refused, so the public cannot trigger sends. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "forbidden" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ status: "no-sending-key" });
  }
  const db = createServiceSupabase();
  if (!db) {
    return NextResponse.json({ status: "no-service-key" });
  }
  const summary = await runDailyEmails(db);
  return NextResponse.json({ status: "ok", ...summary });
}
