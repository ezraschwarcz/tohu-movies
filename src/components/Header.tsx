"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { useSiteSearch } from "./SiteProvider";

/** Top bar, matching the live site: sticky, shrinks on scroll, wordmark,
 *  "Free films, no sign up" tagline, Now Streaming link, and the search
 *  input. The search writes into the shared site context (the home grid
 *  reads it) and mirrors into ?q= so a search is shareable. */

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
        type="search"
        placeholder="Search films"
        aria-label="Search films"
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { setQuery } = useSiteSearch();

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
        <span className="tagline">Free films, no sign up</span>
        <nav className="main-nav" aria-label="Primary">
          <Link className="nav-link" href="/#now-streaming">
            Now Streaming
          </Link>
        </nav>
        <SearchBox />
      </div>
    </header>
  );
}
