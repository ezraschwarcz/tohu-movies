/** Send one email through Resend. Server only: the API key lives in
 *  the RESEND_API_KEY environment variable (set in Vercel), never in
 *  this codebase and never sent to the browser. With no key set, the
 *  call does nothing and reports `skipped`, so the site keeps working
 *  before email is switched on. */

const FROM = "Tohu Movies <hello@tohumovies.com>";

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped: boolean; error: string };

export async function sendEmail(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** One-click unsubscribe address, for optional emails. */
  unsubscribeUrl?: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, error: "RESEND_API_KEY is not set" };
  const base = process.env.RESEND_API_URL ?? "https://api.resend.com";
  try {
    const res = await fetch(`${base}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.unsubscribeUrl
          ? {
              headers: {
                "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, skipped: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id ?? null };
  } catch (err) {
    return { ok: false, skipped: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
