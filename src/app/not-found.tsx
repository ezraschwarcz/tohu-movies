import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | Tohu Movies",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="not-found">
        <h1>Nothing here yet</h1>
        <p>
          This page does not exist, or the film you were looking for is not
          on Tohu Movies yet.
        </p>
        <p>
          <Link href="/" className="play-btn" style={{ textDecoration: "none" }}>
            Browse all films
          </Link>
        </p>
      </div>
    </div>
  );
}
