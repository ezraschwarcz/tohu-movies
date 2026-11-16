import { SITE_URL } from "../site";

/** Tohu's email look, shared by every message the site sends: dark
 *  card, logo, one amber button. Tables and inline styles only, since
 *  that is what email apps render reliably. */

/** Postal address shown at the foot of every email (required by law
 *  for marketing email, and good practice for the rest). */
export const POSTAL_ADDRESS =
  "Tohu Entertainment, LLC &middot; 9854 National Blvd. #302 &middot; Los Angeles, CA 90034";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#e9a83a" style="border-radius:999px;"><a href="${esc(url)}" style="display:inline-block;padding:15px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#1a1405;text-decoration:none;border-radius:999px;">${esc(label)}</a></td></tr></table>`;
}

function layout(options: {
  preview: string;
  body: string;
  footer: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Tohu Movies</title>
</head>
<body style="margin:0;padding:0;background:#0c0b09;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(options.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c0b09;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="padding:0 4px 20px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;letter-spacing:1px;color:#f2eee3;">
<img src="${SITE_URL}/logo-192.png" width="36" height="36" alt="" style="vertical-align:middle;border:0;border-radius:8px;margin-right:10px;"><span style="vertical-align:middle;">TOHU <span style="color:#e9a83a;">MOVIES</span></span>
</td></tr>
<tr><td style="background:#171512;border:1px solid #2e2b25;border-radius:14px;padding:36px 32px;font-family:Arial,Helvetica,sans-serif;color:#f2eee3;">
${options.body}
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8d8676;">
${options.footer}<br>${POSTAL_ADDRESS}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export type EmailFilm = {
  slug: string;
  title: string;
  year: number;
  /** Absolute poster URL, or null to list the film as text only. */
  poster: string | null;
};

/** Sent once, shortly after a new member's first sign-in. */
export function welcomeEmail(input: {
  name: string;
  films: EmailFilm[];
  preferencesUrl: string;
}): { subject: string; html: string; text: string } {
  const first = input.name.trim().split(/\s+/)[0] || "there";
  const films = input.films.slice(0, 3);
  const filmCells = films
    .map(
      (f) => `<td width="33%" valign="top" style="padding:0 6px;">
<a href="${SITE_URL}/films/${esc(f.slug)}" style="text-decoration:none;color:#f2eee3;">
${f.poster ? `<img src="${esc(f.poster)}" width="140" alt="" style="display:block;width:100%;max-width:140px;height:auto;border-radius:8px;border:0;">` : ""}
<span style="display:block;padding-top:8px;font-size:13px;font-weight:bold;line-height:1.3;">${esc(f.title)}</span>
<span style="display:block;font-size:12px;color:#b3ab99;">${f.year}</span>
</a></td>`,
    )
    .join("");

  const body = `<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#f2eee3;">Welcome to Tohu, ${esc(first)}.</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#d9d2c0;">Tohu is free independent film: no subscription, no card, nothing to cancel. Every film is handpicked, in HD, with captions.</p>
${
  films.length > 0
    ? `<p style="margin:0 0 12px;font-size:13px;font-weight:bold;letter-spacing:1px;color:#e9a83a;">START WITH ONE OF THESE</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 -6px 26px;"><tr>${filmCells}</tr></table>`
    : ""
}
<p style="margin:0 0 8px;font-size:13px;font-weight:bold;letter-spacing:1px;color:#e9a83a;">MAKE IT YOURS</p>
<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#d9d2c0;">Save films to your watchlist and they wait for you on any device.</p>
<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#d9d2c0;">Stop a film anywhere and pick it up later.</p>
<p style="margin:0 0 26px;font-size:15px;line-height:1.6;color:#d9d2c0;">Rate and comment. We read every word.</p>
${button("Browse all films", `${SITE_URL}/#now-streaming`)}
<p style="margin:26px 0 0;font-size:14px;line-height:1.6;color:#b3ab99;">The Tohu Movies team</p>`;

  const footer = `Tohu Movies &middot; Free independent films &middot; <a href="${SITE_URL}" style="color:#b3ab99;">tohumovies.com</a><br>
You received this once because you created a Tohu Movies account. <a href="${esc(input.preferencesUrl)}" style="color:#b3ab99;">Choose which emails you get</a>.`;

  const text = [
    `Welcome to Tohu, ${first}.`,
    "",
    "Tohu is free independent film: no subscription, no card, nothing to cancel. Every film is handpicked, in HD, with captions.",
    "",
    ...(films.length > 0
      ? ["Start with one of these:", ...films.map((f) => `- ${f.title} (${f.year}): ${SITE_URL}/films/${f.slug}`), ""]
      : []),
    "Save films to your watchlist, stop anywhere and pick up later, and rate and comment.",
    "",
    `Browse all films: ${SITE_URL}/#now-streaming`,
    "",
    "The Tohu Movies team",
    "",
    `Choose which emails you get: ${input.preferencesUrl}`,
  ].join("\n");

  return {
    subject: "You're in. Here's where to start.",
    html: layout({
      preview: "Three films our members keep coming back to.",
      body,
      footer,
    }),
    text,
  };
}

/** Sent to a member whose admin access changed, and (as a notice) to
 *  every super admin, so access never changes silently. */
export function accessChangeEmail(input: {
  /** "you" for the member's own email; their name for the notice. */
  who: "you" | string;
  role: "member" | "admin" | "super_admin";
  actor: string;
  when: string;
}): { subject: string; html: string; text: string } {
  const own = input.who === "you";
  const label =
    input.role === "super_admin"
      ? "a super admin"
      : input.role === "admin"
        ? "an admin"
        : "no longer an admin";
  const subject = own
    ? input.role === "member"
      ? "Your Tohu Movies admin access was removed"
      : `You are now ${label} on Tohu Movies`
    : input.role === "member"
      ? `Admin access removed: ${input.who}`
      : `${input.who} is now ${label} on Tohu Movies`;
  const headline = own
    ? input.role === "member"
      ? "Your admin access was removed"
      : `You are now ${label}`
    : input.role === "member"
      ? `${input.who} is no longer an admin`
      : `${input.who} is now ${label}`;
  const what =
    input.role === "super_admin"
      ? "Super admins can do everything admins can, and are the only ones who can give admin access to others. A super admin's access can only be changed directly in the database."
      : input.role === "admin"
        ? "Admins can add, edit and hide films, review comments, and ban members from the control room."
        : "The control room is no longer available on this account. Watching, comments and the watchlist work as before.";
  const lines = [
    `${input.actor} made this change on ${input.when}.`,
    what,
    own && input.role !== "member"
      ? "Keep this account safe: turn on one-tap sign-in (a passkey) in your profile, and never share a sign-in code."
      : "",
    own
      ? "If you were not expecting this, let the person named above know."
      : "If this was not expected, review it in the control room under Log.",
  ].filter(Boolean);
  const body = `<h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#f2eee3;">${esc(headline)}</h1>${lines
    .map(
      (l) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#d9d2c0;">${esc(l)}</p>`,
    )
    .join("")}${
    input.role !== "member" || !own
      ? `<div style="padding-top:8px;">${button("Open the control room", `${SITE_URL}/admin`)}</div>`
      : ""
  }`;
  return {
    subject,
    html: layout({
      preview: headline,
      body,
      footer:
        "You are receiving this because it concerns admin access on Tohu Movies. These notices cannot be switched off.",
    }),
    text: [headline, "", ...lines, "", `${SITE_URL}/admin`].join("\n"),
  };
}
