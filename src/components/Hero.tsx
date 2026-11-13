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
import type { Film } from "@/lib/types";
import { useAgeGate } from "./AgeGate";

/** Rotating hero, matching the live site: the 6 most recently added films
 *  (last 6 of the catalog order, most recent first), rotating every 6
 *  seconds, with prev/next arrows, dots, and a slide counter. Rotation
 *  pauses on hover, focus, touch, and when the tab is hidden, and is off
 *  for visitors who prefer reduced motion. On mobile the synopsis clamps
 *  to 3 lines with a Read more toggle that only appears when it overflows.
 *  Play goes to the film page (through the R age gate when needed). */

const ROTATE_MS = 6000;

export default function Hero({ films }: { films: Film[] }) {
  const featured = films.slice(-6).reverse();
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const synRef = useRef<HTMLParagraphElement | null>(null);
  const touchX = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { ensureAllowed, modal } = useAgeGate();

  const film = featured[index] ?? films[0];
  const total = featured.length;

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

  // Auto-rotation, paused on hover/focus/touch/hidden/reduced motion.
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

  if (!film) return null;

  function play() {
    ensureAllowed(film, () => router.push(`/films/${film.slug}`));
  }

  return (
    <section
      className={`hero${fading ? " fading" : ""}`}
      id="hero"
      aria-roledescription="carousel"
      aria-label="Featured films"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        // Swipe left/right on the hero moves between featured films,
        // the gesture phone users expect from a carousel.
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start === null || end === undefined) return;
        const dx = end - start;
        if (Math.abs(dx) < 48) return;
        goTo(dx < 0 ? index + 1 : index - 1);
      }}
    >
      {/* Plain <img>, not next/image: the Mux still URL carries
          ?width=...&time=... query params, which the /_next/image
          optimizer rejects with HTTP 400. Mux already sizes the
          still, so the optimizer adds nothing. The .hero img.bg CSS
          rule carries the fill positioning next/image used to add. */}
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
        sizes="100vw"
      />
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
        {featured.map((f, i) => (
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
