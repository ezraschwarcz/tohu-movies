"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

/** What this page load knows about the visitor's browser, read once
 *  when the home page first appears: when they last visited (before this
 *  visit was stamped), how many films this device has rated, and whether
 *  Safari on an iPhone needs the manual "Add to Home Screen" tip. */
type Visit = {
  now: number;
  previousVisit: number | null;
  ratedCount: number;
  iosInstall: boolean;
};

let visit: Visit | null = null;
function readVisit(): Visit {
  if (visit) return visit;
  const previousVisit = readTime(LAST_VISIT_KEY);
  writeTime(LAST_VISIT_KEY);
  let ratedCount = 0;
  try {
    const raw = window.localStorage.getItem(RATINGS_KEY);
    ratedCount = raw ? Object.keys(JSON.parse(raw) as Record<string, number>).length : 0;
  } catch {
    // ignore
  }
  const ua = window.navigator.userAgent;
  visit = {
    now: Date.now(),
    previousVisit,
    ratedCount,
    iosInstall: !isStandalone() && /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|chrome/i.test(ua),
  };
  return visit;
}
const noSubscribe = () => () => {};

/** Opened from the home screen as an installed app: never offer to install. */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

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

/** One prompt, presented the way the big apps present them: a
 *  floating bubble that slides up over the page (above the tab bar
 *  on phones, bottom-right on desktop), with its own close button.
 *  It is not part of the page flow and never pushes content around. */
function Popup({
  label,
  icon,
  onClose,
  children,
  actions,
}: {
  label: string;
  icon: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="popup" role="dialog" aria-label={label}>
      <span className="popup-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="popup-main">
        <div className="popup-text">{children}</div>
        {actions ? <div className="popup-actions">{actions}</div> : null}
      </div>
      <button
        type="button"
        className="popup-close"
        onClick={onClose}
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default function HomePrompts({ films }: { films: Film[] }) {
  const { loading, user, profile } = useAuth();
  const thisVisit = useSyncExternalStore(noSubscribe, readVisit, () => null);
  const [resume, setResume] = useState<{
    film: Film;
    position: number;
  } | null>(null);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const previousVisit = thisVisit?.previousVisit ?? null;
  const newCount = useMemo(
    () =>
      previousVisit === null
        ? 0
        : films.filter((f) => new Date(f.created_at).getTime() > previousVisit).length,
    [films, previousVisit],
  );
  const ratedCount = thisVisit?.ratedCount ?? 0;
  const iosInstall = thisVisit?.iosInstall ?? false;
  const now = thisVisit?.now ?? 0;

  // Chrome and Android offer their own install prompt; keep it for the
  // "Add to home screen" pop-up.
  useEffect(() => {
    if (isStandalone()) return;
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  // Welcome back: the film they were last watching (signed in only),
  // offered once per browser session.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    const userId = user.id;
    async function loadResume() {
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
        .eq("user_id", userId)
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
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

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

  if (!thisVisit || loading) return null;

  function hide(kind: string) {
    setDismissed((prev) => new Set(prev).add(kind));
  }

  // ---- Priority 1: welcome-back resume ----
  if (user && resume && !dismissed.has("resume")) {
    return (
      <Popup
        label="Welcome back"
        icon="▶"
        onClose={() => hide("resume")}
        actions={
          <Link
            href={`/films/${resume.film.slug}`}
            className="watchlist-btn saved"
          >
            Resume
          </Link>
        }
      >
        <strong>Welcome back.</strong> Resume {resume.film.title} from{" "}
        {formatPosition(resume.position)} of{" "}
        {formatRuntime(resume.film.runtime_minutes)}.
      </Popup>
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
      now - profileDismissedAt > 30 * DAY_MS)
  ) {
    return (
      <Popup
        label="Complete your profile"
        icon="✓"
        onClose={() => {
          if (user) {
            writeTime(`tohu-profile-banner-dismissed-${user.id}`);
          }
          hide("profile");
        }}
        actions={
          <Link href="/profile" className="watchlist-btn saved">
            Complete your profile
          </Link>
        }
      >
        <strong>Complete your profile.</strong> You are{" "}
        {completion.percent}% there. A display name and your favorite genres make sign-in easier and your home page
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
      </Popup>
    );
  }

  // ---- Priority 3: new since your last visit ----
  if (newCount > 0 && !dismissed.has("new")) {
    return (
      <Popup
        label="New films"
        icon="✦"
        onClose={() => hide("new")}
        actions={
          <a href="#new-on-tohu" className="watchlist-btn saved">
            See what is new
          </a>
        }
      >
        <strong>
          {newCount} new film{newCount === 1 ? "" : "s"} since your last
          visit.
        </strong>
      </Popup>
    );
  }

  // ---- Priority 4: sign-in nudge (engaged, signed out) ----
  const nudgeDismissedAt = readTime(SIGNIN_NUDGE_KEY);
  if (
    !user &&
    ratedCount >= 2 &&
    !dismissed.has("signin") &&
    (nudgeDismissedAt === null || now - nudgeDismissedAt > 7 * DAY_MS)
  ) {
    return (
      <Popup
        label="Save your place"
        icon="➜"
        onClose={() => {
          writeTime(SIGNIN_NUDGE_KEY);
          hide("signin");
        }}
        actions={
          <Link href="/login" className="watchlist-btn saved">
            Sign in
          </Link>
        }
      >
        <strong>Save your place.</strong> Sign in with an email link to
        keep your watchlist and continue watching on any device.
      </Popup>
    );
  }

  // ---- Priority 5: add to home screen ----
  const installDismissedAt = readTime(INSTALL_KEY);
  const installCapped =
    installDismissedAt !== null &&
    now - installDismissedAt <= 30 * DAY_MS;
  if (
    !dismissed.has("install") &&
    !installCapped &&
    (installEvent !== null || iosInstall)
  ) {
    return (
      <Popup
        label="Add to home screen"
        icon="↓"
        onClose={() => {
          writeTime(INSTALL_KEY);
          hide("install");
        }}
        actions={
          installEvent ? (
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
          ) : null
        }
      >
        <strong>Add Tohu Movies to your home screen.</strong>{" "}
        {iosInstall
          ? "Tap the Share button in Safari, then “Add to Home Screen”, and Tohu opens like an app."
          : "One tap from your home screen, no app store."}
      </Popup>
    );
  }

  return null;
}
