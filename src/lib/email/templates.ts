import { SITE_URL } from "../site";

/** Tohu's email look, shared by every message the site sends: dark
 *  card, logo, one amber button. Tables and inline styles only, since
 *  that is what email apps render reliably. */

/** Postal address shown at the foot of every email (required by law
 *  for marketing email, and good practice for the rest). */
/** The mailing address the law asks marketing emails to carry. Mail apps
 *  like to turn addresses into blue map links; the styles in layout() and
 *  this span keep it the same grey as the rest of the footer. */
export const POSTAL_ADDRESS =
  '<span class="address" style="color:#8d8676;text-decoration:none;">Tohu Entertainment, LLC<br><span style="white-space:nowrap;">9854 National Blvd. #302,</span> <span style="white-space:nowrap;">Los Angeles, CA 90034</span></span>';

const FOOTER_LINK = "color:#b3ab99;text-decoration:underline;";

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
<meta name="supported-color-schemes" content="dark light">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>Tohu Movies</title>
<style>
a[x-apple-data-detectors], .address a { color: inherit !important; text-decoration: none !important; font: inherit !important; }
@media only screen and (max-width: 480px) {
  .card { padding: 28px 22px !important; }
  .film-poster, .film-text { display: block !important; width: 100% !important; }
  .film-poster { padding: 0 0 18px !important; }
  .film-poster img { width: 160px !important; }
  .foot { padding: 22px 8px 0 !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#0c0b09;">
<div role="article" aria-roledescription="email" aria-label="Tohu Movies" lang="en">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(options.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c0b09;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="padding:0 4px 20px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;letter-spacing:1px;color:#f2eee3;">
<img src="${SITE_URL}/logo-192.png" width="36" height="36" alt="" style="vertical-align:middle;border:0;border-radius:8px;margin-right:10px;"><span style="vertical-align:middle;">TOHU <span style="color:#e9a83a;">MOVIES</span></span>
</td></tr>
<tr><td class="card" style="background:#171512;border:1px solid #2e2b25;border-radius:14px;padding:36px 32px;font-family:Arial,Helvetica,sans-serif;color:#f2eee3;">
${options.body}
</td></tr>
<tr><td class="foot" style="padding:24px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.75;color:#8d8676;">
<p style="margin:0 0 14px;">${options.footer}</p>
<p style="margin:0;">${POSTAL_ADDRESS}</p>
</td></tr>
</table>
</td></tr>
</table>
</div>
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

  const footer = `You received this once because you created a Tohu Movies account.<br>
<a href="${esc(input.preferencesUrl)}" style="${FOOTER_LINK}">Choose which emails you get</a>`;

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

/* ------------------------------------------------------------------
 * Optional emails: the Friday Pick, new-film alerts, reply notices.
 * Each carries a one-click unsubscribe link for its own kind.
 * ------------------------------------------------------------------ */

export type EmailFilmDetail = EmailFilm & {
  facts: string;
  synopsis: string;
};

function optionalFooter(why: string, unsubscribeUrl: string): string {
  return `${why}<br>
<a href="${esc(unsubscribeUrl)}" style="${FOOTER_LINK}">Unsubscribe</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="${SITE_URL}/profile?view=preferences" style="${FOOTER_LINK}">Email settings</a>`;
}

function filmBlock(film: EmailFilmDetail, source: string): string {
  const url = `${SITE_URL}/films/${esc(film.slug)}?utm_source=email&amp;utm_campaign=${source}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${film.poster ? `<td class="film-poster" width="150" valign="top" style="padding:0 20px 0 0;"><a href="${url}"><img src="${esc(film.poster)}" width="150" alt="${esc(film.title)}" style="display:block;width:150px;height:auto;border-radius:10px;border:0;"></a></td>` : ""}
<td class="film-text" valign="top">
<p style="margin:0 0 6px;font-size:22px;line-height:1.2;font-weight:bold;color:#f2eee3;">${esc(film.title)}</p>
<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#b3ab99;">${esc(film.facts)}</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#d9d2c0;">${esc(film.synopsis)}</p>
${button("Watch free", `${SITE_URL}/films/${film.slug}?utm_source=email&utm_campaign=${source}`)}
</td></tr></table>`;
}

export function fridayPickEmail(input: {
  name: string;
  film: EmailFilmDetail;
  note: string | null;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const first = input.name.trim().split(/\s+/)[0];
  const hello = first && !/^Viewer$/i.test(first) ? `${first}, here` : "Here";
  const body = `<p style="margin:0 0 10px;font-size:13px;font-weight:bold;letter-spacing:1px;color:#e9a83a;">THE FRIDAY PICK</p>
<h1 style="margin:0 0 22px;font-size:24px;line-height:1.25;color:#f2eee3;">${esc(hello)} is this week&rsquo;s film.</h1>
${input.note ? `<p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#d9d2c0;">${esc(input.note)}</p>` : ""}
${filmBlock(input.film, "friday-pick")}
<p style="margin:26px 0 0;font-size:14px;line-height:1.6;color:#b3ab99;">Free to watch, no subscription. Enjoy your weekend.</p>`;
  const link = `${SITE_URL}/films/${input.film.slug}?utm_source=email&utm_campaign=friday-pick`;
  return {
    subject: `The Friday Pick: ${input.film.title}`,
    html: layout({
      preview: input.note || input.film.synopsis.slice(0, 110),
      body,
      footer: optionalFooter("You asked for the Friday Pick.", input.unsubscribeUrl),
    }),
    text: [
      `The Friday Pick: ${input.film.title}`,
      input.film.facts,
      "",
      ...(input.note ? [input.note, ""] : []),
      input.film.synopsis,
      "",
      `Watch free: ${link}`,
      "",
      `Unsubscribe: ${input.unsubscribeUrl}`,
      "Tohu Entertainment, LLC, 9854 National Blvd. #302, Los Angeles, CA 90034",
    ].join("\n"),
  };
}

export function newFilmsEmail(input: {
  films: EmailFilmDetail[];
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const total = input.films.length;
  const films = input.films.slice(0, 4);
  const more = total - films.length;
  const one = total === 1;
  const headline = one ? `New on Tohu: ${films[0].title}` : `${total} new films on Tohu`;
  const browse = `${SITE_URL}/browse?utm_source=email&utm_campaign=new-films`;
  const body = `<p style="margin:0 0 10px;font-size:13px;font-weight:bold;letter-spacing:1px;color:#e9a83a;">JUST ADDED</p>
<h1 style="margin:0 0 24px;font-size:24px;line-height:1.25;color:#f2eee3;">${esc(headline)}</h1>
${films.map((f) => filmBlock(f, "new-films")).join('<div style="height:28px;line-height:28px;">&nbsp;</div>')}
${more > 0 ? `<p style="margin:28px 0 0;font-size:15px;line-height:1.6;color:#d9d2c0;">And ${more} more. <a href="${browse}" style="color:#e9a83a;">See everything new on Tohu</a>.</p>` : ""}`;
  return {
    subject: headline,
    html: layout({
      preview: one ? films[0].synopsis.slice(0, 110) : input.films.map((f) => f.title).join(", ").slice(0, 110),
      body,
      footer: optionalFooter("You asked for new-film alerts.", input.unsubscribeUrl),
    }),
    text: [
      headline,
      "",
      ...films.flatMap((f) => [
        `${f.title} (${f.facts})`,
        f.synopsis,
        `${SITE_URL}/films/${f.slug}?utm_source=email&utm_campaign=new-films`,
        "",
      ]),
      ...(more > 0 ? [`And ${more} more: ${browse}`, ""] : []),
      `Unsubscribe: ${input.unsubscribeUrl}`,
      "Tohu Entertainment, LLC, 9854 National Blvd. #302, Los Angeles, CA 90034",
    ].join("\n"),
  };
}

export function replyEmail(input: {
  replier: string;
  body: string;
  filmTitle: string;
  filmSlug: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const link = `${SITE_URL}/films/${input.filmSlug}?utm_source=email&utm_campaign=reply#comments`;
  const body = `<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#f2eee3;">${esc(input.replier)} replied to your comment on ${esc(input.filmTitle)}</h1>
<p style="margin:0 0 24px;padding:14px 16px;border-left:3px solid #e9a83a;background:#221f1a;border-radius:6px;font-size:15px;line-height:1.6;color:#d9d2c0;">${esc(input.body)}</p>
${button("See the conversation", link)}`;
  return {
    subject: `${input.replier} replied to your comment on ${input.filmTitle}`,
    html: layout({
      preview: input.body.slice(0, 110),
      body,
      footer: optionalFooter("You get these when someone replies to you.", input.unsubscribeUrl),
    }),
    text: [
      `${input.replier} replied to your comment on ${input.filmTitle}:`,
      "",
      input.body,
      "",
      `See the conversation: ${link}`,
      "",
      `Stop reply emails: ${input.unsubscribeUrl}`,
      "Tohu Entertainment, LLC, 9854 National Blvd. #302, Los Angeles, CA 90034",
    ].join("\n"),
  };
}
