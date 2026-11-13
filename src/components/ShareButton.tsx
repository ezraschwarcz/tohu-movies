"use client";

import { useState } from "react";

/** Share this film: the device share sheet when the browser has one
 *  (navigator.share, mostly phones), otherwise copy the film URL to
 *  the clipboard and say so. No share counts, no social buttons. */
export default function ShareButton({
  filmSlug,
  filmTitle,
}: {
  filmSlug: string;
  filmTitle: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = `${window.location.origin}/films/${filmSlug}`;
    const nav = navigator as Navigator & {
      share?: (data: { title: string; url: string }) => Promise<void>;
    };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: `${filmTitle} — Tohu Movies`, url });
        return;
      } catch {
        // The user closed the share sheet, or sharing failed. Either
        // way, do nothing more; copying behind their back after a
        // cancel would be a surprise.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions); leave the button as is.
    }
  }

  return (
    <button
      type="button"
      className="watchlist-btn"
      onClick={() => void onShare()}
      aria-live="polite"
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
