"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatRuntime } from "@/lib/films";
import {
  computeProfileCompletion,
  favoriteGenresFromMetadata,
  passwordSetFromMetadata,
} from "@/lib/profile";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { embeddedOne } from "@/lib/types";
import type { ContinueWatchingEntry, Film } from "@/lib/types";
import { useAuth } from "./AuthProvider";

/** Home page prompts: ONE at a time, in a fixed priority order, all
 *  dismissible, all frequency capped in localStorage. No fake
 *  urgency, no counts that are not real, nothing that reappears the
 *  moment it is dismissed.
 *
 *  Priority: (1) welcome-back resume, (2) complete your profile,
 *  (3) new films since your last visit, (4) sign-in nudge for engaged
 *  signed-out visitors, (5) add to home screen. Dismissing the one
 *  showing lets the next one in line appear. */

const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_VISIT_KEY = "tohu-last-visit";
const RESUME_SESSION_KEY = "tohu-resume-prompt-shown";
const SIGNIN_NUDGE_KEY = "tohu-signin-nudge-dismissed";
const INSTALL_KEY = "tohu-install-dismissed";
const RATINGS_KEY = "tohu-ratings-v1";

function readTime(key: string): number | null {
  try {
    const v = window.localStorage.getItem(key);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeTime(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // ignore
  }
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

function formatPosition(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HomePrompts({ films }: { films: Film[] }) {
  const { loading, user, profile } = useAuth();
  const [ready, setReady] = useState(false);
  const [resume, setResume] = useState<{
    film: Film;
    position: number;
  } | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [ratedCount, setRatedCount] = useState(0);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [iosInstall, setIosInstall] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Gather every prompt's eligibility once the auth state is known.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    // New since last visit: compute from the PREVIOUS visit time,
    // then stamp this visit. First ever visit: no prompt.
    const prevVisit = readTime(LAST_VISIT_KEY);
    if (prevVisit !== null) {
      const n = films.filter(
        (f) => new Date(f.created_at).getTime() > prevVisit,
      ).length;
      if (!cancelled) setNewCount(n);
    }
    writeTime(LAST_VISIT_KEY);

    // Films this device rated (anonymous localStorage ratings).
    try {
      const raw = window.localStorage.getItem(RATINGS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      if (!cancelled) setRatedCount(Object.keys(parsed).length);
    } catch {
      // ignore
    }

    // Install: already installed / standalone never prompts.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (!standalone) {
      const ua = window.navigator.userAgent;
      const isIos = /iphone|ipad|ipod/i.test(ua);
      const isSafari =
        /safari/i.test(ua) && !/crios|fxios|chrome/i.test(ua);
      if (isIos && isSafari) setIosInstall(true);
      const onBip = (e: Event) => {
        e.preventDefault();
        if (!cancelled) {
          setInstallEvent(e as BeforeInstallPromptEvent);
        }
      };
      window.addEventListener("beforeinstallprompt", onBip);
    }

    // Resume entry (signed-in only), once per browser session.
    async function loadResume() {
      if (!user) return;
      try {
        if (window.sessionStorage.getItem(RESUME_SESSION_KEY)) return;
      } catch {
        // ignore
      }
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from("continue_watching")
        .select(
          "film_slug,position_seconds,duration_seconds,updated_at,films(*)",
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const row = ((data ?? []) as unknown as ContinueWatchingEntry[])
        .map((r) => ({
          ...r,
          films: embeddedOne(r.films as unknown as Film | Film[] | null),
        }))
        .find((r) => r.films !== null && r.duration_seconds > 0);
      if (row?.films) {
        setResume({ film: row.films, position: row.position_seconds });
        try {
          window.sessionStorage.setItem(RESUME_SESSION_KEY, "1");
        } catch {
          // ignore
        }
      }
    }
    void loadResume();

    setReady(true);
    return () => {
      cancelled = true;
    };
  }, [loading, user, films]);

  const completion = useMemo(() => {
    if (!user) return null;
    const metadata = user.user_metadata as Record<string, unknown>;
    return computeProfileCompletion({
      displayName:
        profile?.display_name ??
        (typeof metadata.display_name === "string"
          ? metadata.display_name
          : null),
      passwordSet: passwordSetFromMetadata(metadata),
      favoriteGenres: favoriteGenresFromMetadata(metadata),
    });
  }, [user, profile]);

  if (!ready || loading) return null;

  function hide(kind: string) {
    setDismissed((prev) => new Set(prev).add(kind));
  }

  // ---- Priority 1: welcome-back resume ----
  if (user && resume && !dismissed.has("resume")) {
    return (
      <section className="home-prompt" aria-label="Welcome back">
        <div className="home-prompt-text">
          <strong>Welcome back.</strong> Resume {resume.film.title} from{" "}
          {formatPosition(resume.position)} of{" "}
          {formatRuntime(resume.film.runtime_minutes)}.
        </div>
        <div className="home-prompt-actions">
          <Link
            href={`/films/${resume.film.slug}`}
            className="watchlist-btn saved"
          >
            Resume
          </Link>
          <button
            type="button"
            className="continue-dismiss"
            onClick={() => hide("resume")}
          >
            Dismiss
          </button>
        </div>
      </section>
    );
  }

  // ---- Priority 2: complete your profile ----
  const profileDismissedAt = user
    ? readTime(`tohu-profile-banner-dismissed-${user.id}`)
    : null;
  if (
    user &&
    completion &&
    !completion.complete &&
    !dismissed.has("profile") &&
    (profileDismissedAt === null ||
      Date.now() - profileDismissedAt > 30 * DAY_MS)
  ) {
    return (
      <section className="home-prompt" aria-label="Complete your profile">
        <div className="home-prompt-text">
          <strong>Complete your profile.</strong> You are{" "}
          {completion.percent}% there. A display name, a password, and
          your favorite genres make sign-in easier and your home page
          more yours.
          <div
            className="wizard-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion.percent}
            aria-label="Profile completion"
          >
            <span style={{ width: `${completion.percent}%` }} />
          </div>
        </div>
        <div className="home-prompt-actions">
          <Link href="/profile" className="watchlist-btn saved">
            Complete your profile
          </Link>
          <button
            type="button"
            className="continue-dismiss"
            onClick={() => {
              if (user) {
                writeTime(`tohu-profile-banner-dismissed-${user.id}`);
              }
              hide("profile");
            }}
          >
            Dismiss
          </button>
        </div>
      </section>
    );
  }

  // ---- Priority 3: new since your last visit ----
  if (newCount > 0 && !dismissed.has("new")) {
    return (
      <section className="home-prompt" aria-label="New films">
        <div className="home-prompt-text">
          <strong>
            {newCount} new film{newCount === 1 ? "" : "s"} since your last
            visit.
          </strong>
        </div>
        <div className="home-prompt-actions">
          <a href="#new-on-tohu" className="watchlist-btn saved">
            See what is new
          </a>
          <button
            type="button"
            className="continue-dismiss"
            onClick={() => hide("new")}
          >
            Dismiss
          </button>
        </div>
      </section>
    );
  }

  // ---- Priority 4: sign-in nudge (engaged, signed out) ----
  const nudgeDismissedAt = readTime(SIGNIN_NUDGE_KEY);
  if (
    !user &&
    ratedCount >= 2 &&
    !dismissed.has("signin") &&
    (nudgeDismissedAt === null || Date.now() - nudgeDismissedAt > 7 * DAY_MS)
  ) {
    return (
      <section className="home-prompt" aria-label="Save your place">
        <div className="home-prompt-text">
          <strong>Save your place.</strong> Sign in with an email link to
          keep your watchlist and continue watching on any device.
        </div>
        <div className="home-prompt-actions">
          <Link href="/login" className="watchlist-btn saved">
            Sign in
          </Link>
          <button
            type="button"
            className="continue-dismiss"
            onClick={() => {
              writeTime(SIGNIN_NUDGE_KEY);
              hide("signin");
            }}
          >
            Dismiss
          </button>
        </div>
      </section>
    );
  }

  // ---- Priority 5: add to home screen ----
  const installDismissedAt = readTime(INSTALL_KEY);
  const installCapped =
    installDismissedAt !== null &&
    Date.now() - installDismissedAt <= 30 * DAY_MS;
  if (
    !dismissed.has("install") &&
    !installCapped &&
    (installEvent !== null || iosInstall)
  ) {
    return (
      <section className="home-prompt" aria-label="Add to home screen">
        <div className="home-prompt-text">
          <strong>Add Tohu Movies to your home screen.</strong>{" "}
          {iosInstall
            ? "Tap the Share button in Safari, then “Add to Home Screen”, and Tohu opens like an app."
            : "One tap from your home screen, no app store."}
        </div>
        <div className="home-prompt-actions">
          {installEvent ? (
            <button
              type="button"
              className="watchlist-btn saved"
              onClick={() => {
                void (async () => {
                  try {
                    await installEvent.prompt();
                    await installEvent.userChoice;
                  } catch {
                    // ignore
                  }
                  setInstallEvent(null);
                  hide("install");
                })();
              }}
            >
              Install
            </button>
          ) : null}
          <button
            type="button"
            className="continue-dismiss"
            onClick={() => {
              writeTime(INSTALL_KEY);
              hide("install");
            }}
          >
            Dismiss
          </button>
        </div>
      </section>
    );
  }

  return null;
}
