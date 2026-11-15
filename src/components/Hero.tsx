"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { formatRuntime, posterUrl } from "@/lib/films";
import { posterZoomFor } from "@/lib/posterZoom";
import { officialPosterFor, posterFocusY } from "@/lib/posters";
import type { Film } from "@/lib/types";
import { useAgeGate } from "./AgeGate";

/** Rotating hero: six films chosen at random from the whole catalog on
 *  every page load, rotating every 6
 *  seconds, with prev/next arrows, dots, and a slide counter. Rotation
 *  pauses on hover, focus, touch, and when the tab is hidden, and is off
 *  for visitors who prefer reduced motion. On mobile the synopsis clamps
 *  to 3 lines with a Read more toggle that only appears when it overflows.
 *  Play goes to the film page (through the R age gate when needed). */

const ROTATE_MS = 7000;

/** Six films at random from the whole catalog, in random order. */
function pickRandom(films: Film[], count = 6): Film[] {
  const pool = [...films];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export default function Hero({ films }: { films: Film[] }) {
  // The lineup is drawn in the visitor's browser on every page load,
  // so it is different each time (a server-side pick is cached and
  // repeats). Until the draw has happened the hero shows an empty
  // frame of the same size, rather than flashing one film and then
  // swapping to another.
  const [featured, setFeatured] = useState<Film[] | null>(null);
  useEffect(() => {
    setFeatured(pickRandom(films));
  }, [films]);
  // Fetch all six pictures as soon as the lineup is known, in the
  // shape this screen will show (cover art on phones, wide still
  // otherwise), so moving to the next film swaps the picture at once
  // instead of the title arriving first and the art catching up.
  useEffect(() => {
    if (!featured) return;
    const phone = window.matchMedia("(max-width: 640px)").matches;
    const held = featured.map((f) => {
      const img = new Image();
      const art = officialPosterFor(f.slug);
      img.src = phone && art ? art : posterUrl(f, 1600);
      return img;
    });
    return () => {
      held.length = 0;
    };
  }, [featured]);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const synRef = useRef<HTMLParagraphElement | null>(null);
  const touchX = useRef<number | null>(null);
  const swipedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { ensureAllowed, modal } = useAgeGate();

  const film = featured ? (featured[index] ?? featured[0]) : undefined;
  const total = featured ? featured.length : 0;

  const goTo = useCallback(
    (next: number) => {
      const wrapped = ((next % total) + total) % total;
      if (wrapped === index) return;
      setFading(true);
      window.setTimeout(() => {
        setIndex(wrapped);
        setExpanded(false);
        setFading(false);
      }, 220);
    },
    [index, total],
  );

  // Auto-rotation: always on, except while a finger is on the banner,
  // while a control inside it has keyboard focus, while the tab is
  // hidden, or when the visitor has asked their device for reduced
  // motion. Hovering with a mouse no longer pauses it: the banner is
  // most of the screen, so the pointer is nearly always over it.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    if (mq.matches || paused || total <= 1) return;
    timer.current = setTimeout(() => goTo(index + 1), ROTATE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [index, paused, total, goTo]);

  useEffect(() => {
    function onVisibility() {
      setPaused(document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Show the Read more toggle only when the (mobile-clamped) synopsis
  // actually overflows. Re-measured when the film changes or the viewport
  // resizes; on desktop the clamp does not apply, so it stays hidden.
  useEffect(() => {
    function measure() {
      const el = synRef.current;
      if (!el) return;
      setNeedsToggle(el.scrollHeight > el.clientHeight + 1);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [film, expanded]);

  if (!film) {
    // Same size as the real hero, so nothing below it moves when the
    // lineup arrives a moment later.
    return <section className="hero hero-pending" aria-hidden="true" />;
  }
  const current = film;
  const art = officialPosterFor(film.slug);

  /** Watch now: go to the film and start it playing. */
  function play() {
    ensureAllowed(current, () => {
      // Tell the film page to start playing. Kept in the browser's
      // session, not in the address, so a refresh or a shared link
      // never auto-starts.
      try {
        window.sessionStorage.setItem("tohu-autoplay", current.slug);
      } catch {
        // storage unavailable; the film opens without auto-starting
      }
      router.push(`/films/${current.slug}`);
    });
  }

  /** Tapping the art: go to the film's page without starting it. */
  function openFilm(e: React.MouseEvent) {
    e.preventDefault();
    if (Date.now() - swipedAt.current < 600) return;
    ensureAllowed(current, () => router.push(`/films/${current.slug}`));
  }

  return (
    <section
      className={`hero${fading ? " fading" : ""}${art ? " has-art" : ""}`}
      id="hero"
      style={
        art
          ? ({ "--art-y": `${posterFocusY(film.slug)}%` } as React.CSSProperties)
          : undefined
      }
      aria-roledescription="carousel"
      aria-label="Featured films"
      onFocusCapture={(e) => {
        // Keyboard focus only; a mouse click or tap should not stop it.
        try {
          if ((e.target as HTMLElement).matches?.(":focus-visible")) setPaused(true);
        } catch {
          // older browsers do not know :focus-visible; ignore
        }
      }}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        // Lifting the finger lets the rotation carry on.
        setPaused(false);
        // Swipe left/right on the hero moves between featured films,
        // the gesture phone users expect from a carousel.
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start === null || end === undefined) return;
        const dx = end - start;
        if (Math.abs(dx) < 48) return;
        // A swipe is not a tap: ignore the click the browser may send
        // after it, so swiping never opens the film.
        swipedAt.current = Date.now();
        goTo(dx < 0 ? index + 1 : index - 1);
      }}
    >
      {/* Plain <img>, not next/image: the Mux still URL carries
          ?width=...&time=... query params, which the /_next/image
          optimizer rejects with HTTP 400. Mux already sizes the
          still, so the optimizer adds nothing. The .hero img.bg CSS
          rule carries the fill positioning next/image used to add. */}
      {/* Wide still on desktop; the film's cover art on phones, where
          the hero is a tall card. <picture> lets the browser fetch
          only the one it will show. */}
      <a
        className="hero-art"
        href={`/films/${film.slug}`}
        onClick={openFilm}
        aria-label={`Open ${film.title}`}
      >
        <picture>
          {art ? <source media="(max-width: 640px)" srcSet={art} /> : null}
          <img
            className="bg"
            src={posterUrl(film, 1600)}
            style={
              {
                "--poster-zoom": posterZoomFor(film.slug),
              } as React.CSSProperties
            }
            alt=""
            fetchPriority="high"
          />
        </picture>
      </a>
      <div className="shade" aria-hidden="true" />
      <div className="hero-in">
        <h1>{film.title}</h1>
        <p className="meta-row">
          <span>{film.year}</span>
          <span aria-hidden="true">·</span>
          <span>{formatRuntime(film.runtime_minutes)}</span>
          <span aria-hidden="true">·</span>
          <span>{film.rating}</span>
          <span aria-hidden="true">·</span>
          <span>{film.genre}</span>
        </p>
        <p ref={synRef} className={`syn${expanded ? "" : " clamped"}`}>
          {film.synopsis}
        </p>
        {needsToggle ? (
          <button
            type="button"
            className="syn-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        ) : null}
        <div>
          <button type="button" className="play-btn" onClick={play}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch now
          </button>
        </div>
      </div>
      <button
        type="button"
        className="hero-nav prev"
        aria-label="Previous featured film"
        onClick={() => goTo(index - 1)}
      >
        ‹
      </button>
      <button
        type="button"
        className="hero-nav next"
        aria-label="Next featured film"
        onClick={() => goTo(index + 1)}
      >
        ›
      </button>
      <div className="hero-dots" role="tablist" aria-label="Featured films">
        {(featured ?? []).map((f, i) => (
          <button
            key={f.slug}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Featured film ${i + 1}: ${f.title}`}
            className={`hero-dot${i === index ? " active" : ""}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
      <span className="hero-count">
        {index + 1} / {total}
      </span>
      {modal}
    </section>
  );
}
