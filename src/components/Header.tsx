"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { useAuth } from "./AuthProvider";
import { useSiteSearch } from "./SiteProvider";

/** Top bar, matching the live site: sticky, shrinks on scroll, wordmark,
 *  "Free independent movies." tagline, Movies link,
 *  and the search input. The search writes into the shared site context
 *  (the home grid reads it) and mirrors into ?q= so a search is
 *  shareable. The input has id "site-search" so the mobile tab bar can
 *  focus it. On mobile the nav pills row is hidden (the bottom tab bar
 *  covers navigation) and the header is logo + Sign in on row 1 and the
 *  search input on row 2. */

function SearchBox() {
  const { query, setQuery } = useSiteSearch();
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the URL in sync (debounced) without a navigation, so the link
  // stays shareable. Typing on a film page navigates home instead.
  function onChange(value: string) {
    setQuery(value);
    if (pathname !== "/") {
      router.push(value ? `/?q=${encodeURIComponent(value)}` : "/");
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        const url = value
          ? `/?q=${encodeURIComponent(value)}`
          : "/";
        window.history.replaceState(null, "", url);
      } catch {
        // ignore
      }
    }, 250);
  }

  return (
    <div className="search">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.8-3.8" />
      </svg>
      <input
        id="site-search"
        type="search"
        placeholder="Search films"
        aria-label="Search films"
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Sign-in state in the header. Signed out: a Sign in link. Signed in:
 *  the display name (a link to the profile), a Sign out button, and a
 *  My watchlist link (plus an Admin link for admins). Watching stays
 *  free; this only gates comments, watchlist, and continue watching. */
function AuthArea() {
  const { loading, user, profile, isAdmin, signOut } = useAuth();
  if (loading) return <span className="auth-area" aria-hidden="true" />;
  if (!user) {
    return (
      <span className="auth-area">
        <Link className="nav-link auth-link" href="/login">
          Sign in
        </Link>
      </span>
    );
  }
  return (
    <span className="auth-area">
      <Link
        className="auth-name"
        href="/profile"
        title={profile?.display_name ?? user.email ?? ""}
      >
        {profile?.display_name || user.email}
      </Link>
      <button
        type="button"
        className="nav-link auth-link auth-btn"
        onClick={() => void signOut()}
      >
        Sign out
      </button>
    </span>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { setQuery } = useSiteSearch();
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`topbar${scrolled ? " scrolled" : ""}`} id="topbar">
      <div className="topbar-in">
        <Link
          className="wordmark"
          href="/"
          aria-label="Tohu Movies, home"
          onClick={() => setQuery("")}
        >
          <Logo size={34} className="logo-mark" />
          <span className="wordmark-text">
            Tohu<span> Movies</span>
          </span>
        </Link>
        <span className="tagline">Free independent movies.</span>
        <nav className="main-nav" aria-label="Primary">
          <Link className="nav-link" href="/#now-streaming">
            Movies
          </Link>
          {user ? (
            <Link className="nav-link" href="/watchlist">
              My watchlist
            </Link>
          ) : null}
          {isAdmin ? (
            <Link className="nav-link" href="/admin">
              Admin
            </Link>
          ) : null}
        </nav>
        <SearchBox />
        <AuthArea />
      </div>
    </header>
  );
}
