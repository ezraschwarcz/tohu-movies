"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

/** Floating pill bottom tab bar, mobile only (Peacock-style). Four
 *  tabs: Home, Search, Watchlist, Profile. Search scrolls to the top
 *  and focuses the header search box; it is a button, not a link, and
 *  never counts as the active tab. Signed-out visitors are sent to
 *  /login with a next param for Watchlist and Profile. Hidden on
 *  desktop by CSS (.tabbar is display none above 640px).
 *
 *  The Watchlist tab is labeled "Watchlist", not Peacock's "My Stuff":
 *  the site calls it a watchlist everywhere else (nav, profile, the
 *  button on each film), so that label is clearer here. */

function focusSearch() {
  // Focus inside the click handler (a user gesture) so iOS opens the
  // keyboard, then scroll to the top so the header search box is
  // visible. preventScroll stops the focus itself from jumping the
  // page before the smooth scroll runs.
  try {
    const input = document.getElementById("site-search");
    if (input) input.focus({ preventScroll: true });
  } catch {
    // ignore
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.8-3.8" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h12v18l-6-4.5L6 21z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
    </svg>
  );
}

export default function TabBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const watchlistHref = user ? "/watchlist" : "/login?next=/watchlist";
  const profileHref = user ? "/profile" : "/login?next=/profile";

  return (
    <nav className="tabbar" aria-label="Sections">
      <Link
        href="/"
        className={`tabbar-link${pathname === "/" ? " active" : ""}`}
        aria-current={pathname === "/" ? "page" : undefined}
      >
        <HomeIcon />
        <span>Home</span>
      </Link>
      <button
        type="button"
        className="tabbar-link"
        onClick={focusSearch}
        aria-label="Search films"
      >
        <SearchIcon />
        <span>Search</span>
      </button>
      <Link
        href={watchlistHref}
        className={`tabbar-link${pathname === "/watchlist" ? " active" : ""}`}
        aria-current={pathname === "/watchlist" ? "page" : undefined}
      >
        <BookmarkIcon />
        <span>Watchlist</span>
      </Link>
      <Link
        href={profileHref}
        className={`tabbar-link${pathname === "/profile" ? " active" : ""}`}
        aria-current={pathname === "/profile" ? "page" : undefined}
      >
        <ProfileIcon />
        <span>Profile</span>
      </Link>
    </nav>
  );
}
