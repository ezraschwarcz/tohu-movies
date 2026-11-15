"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Shown when a page hits an unexpected error in the browser, in
 *  place of the framework's plain "This page couldn't load" screen.
 *  It keeps the site's header and look, offers a way forward, and
 *  prints the technical reason in small print so it can be reported. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="wrap">
      <div className="not-found" role="alert">
        <h1>Something went wrong</h1>
        <p>This page hit a problem. You can try again, or head back home.</p>
        <p className="error-actions">
          <button type="button" className="play-btn" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Back to home
          </Link>
        </p>
        <p className="error-detail">
          Details: {String(error.message || "Unknown error").slice(0, 300)}
          {error.digest ? ` (ref ${error.digest})` : ""}
        </p>
      </div>
    </div>
  );
}
