import Link from "next/link";
import { FOOTER_PROMO } from "@/lib/site";

export default function Footer() {
  return (
    <footer>
      <p className="foot-brand">
        Tohu<span> Movies</span>
      </p>
      <p className="foot-promo">{FOOTER_PROMO}</p>
      <p className="foot-copy">
        &copy; 2027 Tohu Movies. All rights reserved. &middot; tohumovies.com
      </p>
      <nav className="foot-links" aria-label="Legal">
        <Link href="/privacy">Privacy Policy</Link>
        <span className="sep" aria-hidden="true">
          &middot;
        </span>
        <Link href="/terms">Terms of Service</Link>
        <span className="sep" aria-hidden="true">
          &middot;
        </span>
        <Link href="/cookies">Cookie Notice</Link>
      </nav>
    </footer>
  );
}
