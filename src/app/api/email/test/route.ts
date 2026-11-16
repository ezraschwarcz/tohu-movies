import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { getServerAuth } from "@/lib/supabase/server";

/** Admin-only email check. Sends a short test message to the signed-in
 *  admin's own address and reports exactly what happened: sent, the
 *  sending key is missing, or the email service refused it and why.
 *  The reply never includes the key itself. */
export const dynamic = "force-dynamic";

export async function POST() {
  const { isAdmin, email } = await getServerAuth();
  if (!isAdmin || !email) {
    return NextResponse.json({ status: "forbidden" }, { status: 404 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({
      status: "no-key",
      message:
        "The site has no sending key. In Vercel, add RESEND_API_KEY under Environment Variables (Production ticked), then redeploy.",
    });
  }
  const sentAt = new Date().toISOString();
  const result = await sendEmail({
    to: email,
    subject: "Tohu Movies test email",
    html: `<div style="font-family:Arial,Helvetica,sans-serif;background:#0c0b09;color:#f2eee3;padding:28px;"><h1 style="margin:0 0 12px;font-size:22px;">It works.</h1><p style="margin:0;font-size:15px;line-height:1.6;color:#d9d2c0;">This is a test email from the Tohu Movies admin panel, sent at ${sentAt}. If you are reading it, the site can send email.</p></div>`,
    text: `It works. This is a test email from the Tohu Movies admin panel, sent at ${sentAt}.`,
  });
  if (result.ok) {
    return NextResponse.json({
      status: "sent",
      message: `Sent to ${email}. It should arrive within a minute; it also appears under Emails in Resend.`,
    });
  }
  return NextResponse.json({
    status: "failed",
    message: `The email service refused the message: ${result.error}`,
  });
}
