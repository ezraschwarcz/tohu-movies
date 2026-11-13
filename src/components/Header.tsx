"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import Avatar from "./Avatar";
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
 *  the account avatar with a small chevron (Facebook style); clicking
 *  it opens the account menu — identity card, profile sections,
 *  watchlist, admin, sign out. The menu closes on an outside click,
 *  Escape, a link click, or a route change. Watching stays free; this
 *  only gates comments, watchlist, and continue watching. */
function AuthArea() {
  const { loading, user, profile, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement | null>(null);
  const pathname = usePathname();

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click or Escape while open.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (
        menuRef.current &&
        e.target instanceof Node &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

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

  const name = profile?.display_name || user.email || "Your account";
  const email = user.email ?? "";

  return (
    <span className="auth-area">
      <span className="account-menu" ref={menuRef}>
        <button
          type="button"
          className="account-button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Account menu for ${name}`}
        >
          <Avatar
            preset={profile?.avatar_preset}
            url={profile?.avatar_url}
            name={name}
            size={34}
          />
          <svg
            className="account-chev"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9.5 12 15.5 18 9.5" />
          </svg>
        </button>
        {open ? (
          <div className="account-dropdown" role="menu">
            <Link
              className="account-id"
              href="/profile"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <Avatar
                preset={profile?.avatar_preset}
                url={profile?.avatar_url}
                name={name}
                size={40}
              />
              <span className="account-id-text">
                <span className="account-id-name">{name}</span>
                {email ? (
                  <span className="account-id-email">{email}</span>
                ) : null}
              </span>
            </Link>
            <div className="account-divider" aria-hidden="true" />
            <Link
              className="account-row"
              href="/profile"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              Your profile
            </Link>
            <Link
              className="account-row"
              href="/profile?view=complete"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              Complete your profile
            </Link>
            <Link
              className="account-row"
              href="/watchlist"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              My watchlist
            </Link>
            <Link
              className="account-row"
              href="/profile?view=security"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              Sign-in &amp; security
            </Link>
            <Link
              className="account-row"
              href="/profile?view=preferences"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              Preferences
            </Link>
            {isAdmin ? (
              <Link
                className="account-row"
                href="/admin"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                Admin
              </Link>
            ) : null}
            <div className="account-divider" aria-hidden="true" />
            <button
              type="button"
              className="account-row account-signout"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </span>
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
