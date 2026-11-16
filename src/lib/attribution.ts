/** Where a visitor first came from, remembered on their device so it
 *  can be noted once if they later create an account. This is what
 *  lets the control room say "12 new members came from reddit".
 *
 *  Only a short label is kept: a campaign tag from the link they
 *  followed (utm_source / utm_campaign), or the name of the site that
 *  sent them. No page history, no tracking across sites. */
const KEY = "tohu-first-touch";

function clean(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._ -]/g, "").slice(0, 40).trim();
}

export function rememberFirstTouch(): void {
  try {
    if (window.localStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const source = clean(params.get("utm_source") ?? "");
    const campaign = clean(params.get("utm_campaign") ?? "");
    let label = "";
    if (source) {
      label = campaign ? `${source} / ${campaign}` : source;
    } else if (document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host && !host.endsWith("tohumovies.com")) label = clean(host);
    }
    window.localStorage.setItem(KEY, label || "direct");
  } catch {
    // Private mode or blocked storage: simply not recorded.
  }
}

export function firstTouch(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "direct";
  } catch {
    return "direct";
  }
}
