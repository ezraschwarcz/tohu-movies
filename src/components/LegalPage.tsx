import type { ReactNode } from "react";
import Link from "next/link";
import Logo from "./Logo";

/** Shared shell for the legal pages, matching the live site's layout:
 *  brand and a Back to films link on top, title, meta line, intro, then
 *  the sections. */
export default function LegalPage({
  title,
  meta,
  intro,
  children,
  footerNote,
}: {
  title: string;
  meta: string;
  intro: string;
  children: ReactNode;
  footerNote?: ReactNode;
}) {
  return (
    <div className="legal-wrap">
      <div className="legal-top">
        <Link href="/" className="legal-brand">
          <Logo size={26} />
          <span>
            Tohu <span>Movies</span>
          </span>
        </Link>
        <Link href="/" className="legal-back">
          ← Back to films
        </Link>
      </div>
      <article className="legal-page">
        <h1>{title}</h1>
        <p className="legal-meta">{meta}</p>
        <p className="legal-intro">{intro}</p>
        {children}
        <p className="legal-footer-note">
          {footerNote ?? (
            <>
              Back to the films?{" "}
              <Link href="/">Browse all films on Tohu Movies</Link>.
            </>
          )}
        </p>
      </article>
    </div>
  );
}
