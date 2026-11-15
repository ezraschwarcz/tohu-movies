"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type VideoJsPlayer from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import { durationSeconds, muxStreamUrl, posterUrl } from "@/lib/films";
import { isAgeVerified } from "@/lib/ageGate";
import { posterZoomFor } from "@/lib/posterZoom";
import { officialPosterFor } from "@/lib/posters";
import { MUX_DATA_ENV_KEY, MUX_PLAYER_NAME } from "@/lib/site";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Film } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { useAgeGate } from "./AgeGate";

/** Video.js 8 player with Mux Data, matching the live site.
 *
 *  - Video.js 8.24.1 from npm (the v8 line fits a plain script-tag-free
 *    load; v10 is built for bundlers and React, and its Mux Data support
 *    is a different extension). HLS is built in via videojs-http-streaming.
 *  - Mux Data via the videojs-mux npm package (same 4.x line the live site
 *    loads from litix). It registers the `mux` plugin on video.js.
 *  - One player per film page. If the film changes under a mounted player,
 *    the player is rebuilt for the new film.
 *  - If Mux Data fails to load, playback still works; analytics just
 *    does not flow. The player never blocks on analytics.
 *  - Caption track labels are forced to "English CC" (the Mux language
 *    detector mis-tags some English tracks as "und"/"la"; the text is
 *    English, only the label was wrong). */

type MuxData = {
  env_key: string;
  player_name: string;
  video_id: string;
  video_title: string;
  video_duration: number;
};

type PlayerWithMux = VideoJsPlayer & {
  mux: ((options: { data: MuxData }) => void) & {
    emit: (event: string, data: MuxData) => void;
  };
};

function muxDataFor(film: Film): MuxData {
  return {
    env_key: MUX_DATA_ENV_KEY,
    player_name: MUX_PLAYER_NAME,
    video_id: film.slug,
    video_title: film.title,
    video_duration: durationSeconds(film),
  };
}

function forceEnglishCC(player: VideoJsPlayer) {
  const relabelAll = (list: ArrayLike<TextTrack>) => {
    for (let i = 0; i < list.length; i++) {
      const track = list[i];
      if (
        (track.kind === "captions" || track.kind === "subtitles") &&
        track.label !== "English CC"
      ) {
        try {
          // video.js TextTrack labels are settable at runtime even
          // though the DOM type marks label read-only.
          (track as { label: string }).label = "English CC";
        } catch {
          // some tracks are read-only; the menu keeps the manifest label
        }
      }
    }
  };
  const tracks = player.textTracks();
  if (tracks) {
    relabelAll(tracks as unknown as ArrayLike<TextTrack>);
    tracks.addEventListener?.("addtrack", () =>
      relabelAll(tracks as unknown as ArrayLike<TextTrack>),
    );
  }
  const remote = player.remoteTextTracks();
  if (remote) {
    relabelAll(remote as unknown as ArrayLike<TextTrack>);
    remote.addEventListener?.("addtrack", () =>
      relabelAll(remote as unknown as ArrayLike<TextTrack>),
    );
  }
}

const UP_NEXT_SECONDS = 15;
const SKIP_SECONDS = 10;
const PREFS_KEY = "tohu-player-prefs-v1";

/** Viewer settings that carry from film to film on this device. */
type PlayerPrefs = {
  volume?: number;
  muted?: boolean;
  rate?: number;
  captions?: boolean;
};

function readPrefs(): PlayerPrefs {
  try {
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as PlayerPrefs;
  } catch {
    return {};
  }
}

function writePrefs(patch: PlayerPrefs) {
  try {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...readPrefs(), ...patch }),
    );
  } catch {
    // storage unavailable; settings just do not carry over
  }
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Mux storyboard: one sprite image of small frames across the film,
 *  with the time each tile starts. Used for the hover preview on the
 *  progress bar. */
type Storyboard = {
  url: string;
  tile_width: number;
  tile_height: number;
  tiles: { start: number; x: number; y: number }[];
};

type AirPlayVideo = HTMLVideoElement & {
  webkitShowPlaybackTargetPicker?: () => void;
};
const VIEW_AFTER_SECONDS = 30;

export default function Player({
  film,
  nextFilm = null,
}: {
  film: Film;
  /** The Up Next pick (first "More films" film on the page), or null
   *  for no end screen. */
  nextFilm?: Film | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();
  const { ensureAllowed, modal } = useAgeGate();
  const [showUpNext, setShowUpNext] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(UP_NEXT_SECONDS);
  /** Saved position to offer ("Resume from 42:10"), or null. */
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [airPlay, setAirPlay] = useState(false);
  const playerRef = useRef<VideoJsPlayer | null>(null);
  const nextFilmRef = useRef<Film | null>(nextFilm);
  useEffect(() => {
    nextFilmRef.current = nextFilm;
  }, [nextFilm]);
  const { user } = useAuth();
  // Up Next countdown: runs only while the end screen is showing and
  // the next film needs no age gate (or the viewer is already age
  // verified). An R rated next film for an unverified viewer never
  // auto-starts: the countdown holds and Play now runs the age gate.
  const nextNeedsGate =
    nextFilm !== null && nextFilm.rating === "R" && !isAgeVerified();
  // isAgeVerified reads localStorage, so it is only meaningful after
  // mount; the countdown effect below runs client side only anyway,
  // and Play now re-checks through ensureAllowed regardless.
  function playNextNow() {
    if (!nextFilm) return;
    setShowUpNext(false);
    ensureAllowed(nextFilm, () => router.push(`/films/${nextFilm.slug}`));
  }

  useEffect(() => {
    if (!showUpNext || !nextFilm) return;
    if (nextFilm.rating === "R" && !isAgeVerified()) return;
    if (secondsLeft <= 0) {
      playNextNow();
      return;
    }
    const t = window.setTimeout(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => window.clearTimeout(t);
    // playNextNow is re-created each render; the timeout only needs
    // the current secondsLeft and visibility state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUpNext, secondsLeft, nextFilm]);

  // A new film means a new end screen state.
  useEffect(() => {
    setShowUpNext(false);
    setSecondsLeft(UP_NEXT_SECONDS);
    setResumeAt(null);
  }, [film.slug]);

  function resumeNow() {
    const p = playerRef.current;
    const at = resumeAt;
    setResumeAt(null);
    if (!p || at === null) return;
    try {
      p.currentTime(at);
      void p.play();
    } catch {
      // ignore; the viewer can still press play
    }
  }

  function startOver() {
    const p = playerRef.current;
    setResumeAt(null);
    if (!p) return;
    try {
      p.currentTime(0);
      void p.play();
    } catch {
      // ignore
    }
  }

  function openAirPlay() {
    const el = playerRef.current?.el()?.querySelector("video") as AirPlayVideo | null;
    el?.webkitShowPlaybackTargetPicker?.();
  }

  // The signed-in user id, kept current so the player's event listeners
  // (attached once at init) always save for the right user, even if the
  // user signs in after the player mounted.
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    let player: VideoJsPlayer | null = null;
    let lastSavedAt = 0;
    // A Watch now button leaves a note in the browser's session
    // naming this film: start it as soon as the player is ready.
    // The note is read once and removed.
    let wantsAutoplay = false;
    try {
      if (window.sessionStorage.getItem("tohu-autoplay") === film.slug) {
        wantsAutoplay = true;
        window.sessionStorage.removeItem("tohu-autoplay");
      }
    } catch {
      // ignore
    }
    const cleanups: (() => void)[] = [];
    let watchedSeconds = 0;
    let lastTick = -1;
    let viewRecorded = false;

    /** Count one view after 30 seconds of actual playback (seeking
     *  does not count), at most once per film per browser session,
     *  for any viewer. Stores no personal data beyond the signed-in
     *  user id the database attaches itself. Best effort: if the
     *  view tracking migration has not run, the call fails quietly. */
    function trackView() {
      if (viewRecorded || !player || cancelled) return;
      let current = 0;
      try {
        current = player.currentTime() ?? 0;
      } catch {
        return;
      }
      const delta = current - lastTick;
      if (lastTick >= 0 && delta > 0 && delta < 2) watchedSeconds += delta;
      lastTick = current;
      if (watchedSeconds < VIEW_AFTER_SECONDS) return;
      viewRecorded = true;
      const key = `tohu-viewed-${film.slug}`;
      try {
        if (window.sessionStorage.getItem(key)) return;
        window.sessionStorage.setItem(key, "1");
      } catch {
        // storage unavailable; still record once for this mount
      }
      void getBrowserSupabase()
        .rpc("record_film_view", { p_slug: film.slug })
        .then(
          () => {},
          () => {},
        );
    }

    /** Save the playback position for signed-in users only, throttled
     *  to at most once every 15 seconds (plus a forced save on pause).
     *  Anonymous viewers are never recorded. A failure never breaks
     *  playback. */
    async function savePosition(force: boolean) {
      const userId = userIdRef.current;
      if (!userId || !player || cancelled) return;
      let current = 0;
      let duration = 0;
      try {
        current = player.currentTime() ?? 0;
        duration = player.duration() ?? 0;
      } catch {
        return;
      }
      if (!Number.isFinite(current) || !Number.isFinite(duration) || duration <= 0) return;
      if (current < 5) return;
      const now = Date.now();
      if (!force && now - lastSavedAt < 15000) return;
      lastSavedAt = now;
      try {
        await getBrowserSupabase()
          .from("continue_watching")
          .upsert(
            {
              user_id: userId,
              film_slug: film.slug,
              position_seconds: Math.floor(current),
              duration_seconds: Math.floor(duration),
            },
            { onConflict: "user_id,film_slug" },
          );
      } catch {
        // recording is best effort; playback continues
      }
    }

    /** Offer to resume where a signed-in user stopped, once, right
     *  after the player loads. Skipped for very short positions and for films
     *  that are nearly finished. */
    async function resumeFromSaved(p: VideoJsPlayer) {
      const userId = userIdRef.current;
      if (!userId) return;
      try {
        const { data } = await getBrowserSupabase()
          .from("continue_watching")
          .select("position_seconds,duration_seconds")
          .eq("user_id", userId)
          .eq("film_slug", film.slug)
          .maybeSingle();
        if (cancelled || !data) return;
        const pos = data.position_seconds as number;
        const dur = data.duration_seconds as number;
        if (pos > 15 && dur > 0 && pos < dur - 30) {
          // Offer the choice instead of jumping silently: the viewer
          // picks Resume or Start over on the player.
          if (wantsAutoplay) {
            // Arrived through a Watch now button: carry on from
            // where they stopped, without asking.
            const go = () => {
              try {
                p.currentTime(pos);
              } catch {
                // ignore
              }
            };
            if (p.readyState() >= 1) go();
            else p.one("loadedmetadata", go);
          } else if (p.paused()) {
            setResumeAt(pos);
          }
        }
      } catch {
        // resume is best effort; playback starts from the beginning
      }
    }

    /** Everything that makes the player comfortable to use: settings
     *  that carry between films, keyboard shortcuts, double-tap to
     *  skip on phones, hover previews on the progress bar, and
     *  AirPlay. Each piece is independent and best effort: a failure
     *  in one never stops playback. Returns its cleanup functions. */
    function wirePlayerExtras(p: VideoJsPlayer): (() => void)[] {
      const undo: (() => void)[] = [];

      // --- Remembered volume, mute, and speed ---
      const prefs = readPrefs();
      try {
        if (typeof prefs.volume === "number") p.volume(Math.min(1, Math.max(0, prefs.volume)));
        if (typeof prefs.muted === "boolean") p.muted(prefs.muted);
        if (typeof prefs.rate === "number") {
          p.one("loadedmetadata", () => p.playbackRate(prefs.rate as number));
        }
      } catch {
        // ignore
      }
      p.on("volumechange", () =>
        writePrefs({ volume: p.volume() ?? 1, muted: p.muted() ?? false }),
      );
      p.on("ratechange", () => writePrefs({ rate: p.playbackRate() ?? 1 }));

      // --- Remembered captions on/off ---
      const captionTracks = () => {
        const list = p.textTracks() as unknown as ArrayLike<TextTrack>;
        const out: TextTrack[] = [];
        for (let i = 0; i < list.length; i++) {
          if (list[i].kind === "captions" || list[i].kind === "subtitles") out.push(list[i]);
        }
        return out;
      };
      let applyingCaptions = false;
      const applyCaptionPref = () => {
        if (readPrefs().captions !== true) return;
        const tracks = captionTracks();
        if (tracks.length === 0 || tracks.some((t) => t.mode === "showing")) return;
        applyingCaptions = true;
        tracks[0].mode = "showing";
        applyingCaptions = false;
      };
      p.on("loadedmetadata", applyCaptionPref);
      const trackList = p.textTracks() as unknown as EventTarget;
      const onTrackChange = () => {
        if (applyingCaptions) return;
        writePrefs({ captions: captionTracks().some((t) => t.mode === "showing") });
      };
      const onTrackAdded = () => applyCaptionPref();
      trackList.addEventListener?.("change", onTrackChange);
      trackList.addEventListener?.("addtrack", onTrackAdded);
      undo.push(() => {
        trackList.removeEventListener?.("change", onTrackChange);
        trackList.removeEventListener?.("addtrack", onTrackAdded);
      });

      const toggleCaptions = () => {
        const tracks = captionTracks();
        if (tracks.length === 0) return;
        const showing = tracks.some((t) => t.mode === "showing");
        for (const t of tracks) t.mode = "disabled";
        if (!showing) tracks[0].mode = "showing";
      };

      const skip = (delta: number) => {
        try {
          const d = p.duration() ?? 0;
          const next = Math.max(0, (p.currentTime() ?? 0) + delta);
          p.currentTime(d > 0 ? Math.min(d - 1, next) : next);
        } catch {
          // ignore
        }
      };

      // --- Keyboard shortcuts (whole page, never while typing) ---
      const onKey = (e: KeyboardEvent) => {
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.isContentEditable ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) ||
            // A focused button or link keeps its own Space/Enter.
            (/^(BUTTON|A)$/.test(t.tagName) && (e.key === " " || e.key === "Enter")) ||
            t.closest?.(".vjs-menu, .vjs-modal-dialog, [role='dialog']"))
        ) {
          return;
        }
        let handled = true;
        switch (e.key) {
          case " ":
          case "k":
          case "K":
            if (p.paused()) void p.play();
            else p.pause();
            break;
          case "ArrowLeft":
          case "j":
          case "J":
            skip(-SKIP_SECONDS);
            break;
          case "ArrowRight":
          case "l":
          case "L":
            skip(SKIP_SECONDS);
            break;
          case "ArrowUp":
            p.volume(Math.min(1, (p.volume() ?? 1) + 0.1));
            break;
          case "ArrowDown":
            p.volume(Math.max(0, (p.volume() ?? 1) - 0.1));
            break;
          case "m":
          case "M":
            p.muted(!p.muted());
            break;
          case "f":
          case "F":
            if (p.isFullscreen()) void p.exitFullscreen();
            else void p.requestFullscreen();
            break;
          case "c":
          case "C":
            toggleCaptions();
            break;
          default:
            handled = false;
        }
        if (handled) {
          e.preventDefault();
          p.userActive(true);
        }
      };
      document.addEventListener("keydown", onKey);
      undo.push(() => document.removeEventListener("keydown", onKey));

      // --- Double-tap the left or right side to skip (touch) ---
      const root = p.el() as HTMLElement;
      let lastTap = { time: 0, side: 0 };
      const onTouchEnd = (e: TouchEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target || target.closest(".vjs-control-bar, .vjs-menu, .vjs-modal-dialog, button")) return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        const rect = root.getBoundingClientRect();
        const ratio = (touch.clientX - rect.left) / rect.width;
        const side = ratio < 0.35 ? -1 : ratio > 0.65 ? 1 : 0;
        const now = Date.now();
        if (side !== 0 && lastTap.side === side && now - lastTap.time < 320) {
          skip(side * SKIP_SECONDS);
          lastTap = { time: 0, side: 0 };
          flashSkip(side);
        } else {
          lastTap = { time: now, side };
        }
      };
      const flash = document.createElement("div");
      flash.className = "tohu-skip-flash";
      flash.setAttribute("aria-hidden", "true");
      root.appendChild(flash);
      let flashTimer: ReturnType<typeof setTimeout> | null = null;
      function flashSkip(side: number) {
        flash.textContent = side < 0 ? `« ${SKIP_SECONDS}s` : `${SKIP_SECONDS}s »`;
        flash.dataset.side = side < 0 ? "left" : "right";
        flash.classList.add("show");
        if (flashTimer) clearTimeout(flashTimer);
        flashTimer = setTimeout(() => flash.classList.remove("show"), 450);
      }
      root.addEventListener("touchend", onTouchEnd, { passive: true });
      undo.push(() => {
        root.removeEventListener("touchend", onTouchEnd);
        if (flashTimer) clearTimeout(flashTimer);
        flash.remove();
      });

      // --- Hover previews on the progress bar (Mux storyboard) ---
      const progress = root.querySelector<HTMLElement>(".vjs-progress-control");
      if (progress) {
        const tip = document.createElement("div");
        tip.className = "tohu-preview";
        tip.setAttribute("aria-hidden", "true");
        progress.appendChild(tip);
        let board: Storyboard | null = null;
        let sheet = { w: 0, h: 0 };
        const SCALE = 0.62;
        fetch(`https://image.mux.com/${film.playback_id}/storyboard.json`)
          .then((r) => (r.ok ? (r.json() as Promise<Storyboard>) : null))
          .then((data) => {
            if (cancelled || !data || !Array.isArray(data.tiles) || data.tiles.length === 0) return;
            const img = new Image();
            img.onload = () => {
              if (cancelled) return;
              board = data;
              sheet = { w: img.naturalWidth, h: img.naturalHeight };
              tip.style.width = `${Math.round(data.tile_width * SCALE)}px`;
              tip.style.height = `${Math.round(data.tile_height * SCALE)}px`;
              tip.style.backgroundImage = `url("${data.url}")`;
              tip.style.backgroundSize = `${Math.round(sheet.w * SCALE)}px ${Math.round(sheet.h * SCALE)}px`;
            };
            img.src = data.url;
          })
          .catch(() => {
            // no storyboard; the bar simply has no preview
          });
        const onMove = (e: MouseEvent) => {
          if (!board) return;
          const bar = progress.querySelector<HTMLElement>(".vjs-progress-holder") ?? progress;
          const rect = bar.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          const time = ratio * (p.duration() || 0);
          let tile = board.tiles[0];
          for (const t of board.tiles) {
            if (t.start <= time) tile = t;
            else break;
          }
          const w = board.tile_width * SCALE;
          const holder = progress.getBoundingClientRect();
          const left = Math.min(
            holder.width - w - 4,
            Math.max(4, e.clientX - holder.left - w / 2),
          );
          tip.style.left = `${left}px`;
          tip.style.backgroundPosition = `-${Math.round(tile.x * SCALE)}px -${Math.round(tile.y * SCALE)}px`;
          tip.classList.add("show");
        };
        const onLeave = () => tip.classList.remove("show");
        progress.addEventListener("mousemove", onMove);
        progress.addEventListener("mouseleave", onLeave);
        undo.push(() => {
          progress.removeEventListener("mousemove", onMove);
          progress.removeEventListener("mouseleave", onLeave);
          tip.remove();
        });
      }

      // --- AirPlay (Safari on iPhone, iPad, Mac) ---
      const videoEl = root.querySelector("video");
      if (videoEl && "WebKitPlaybackTargetAvailabilityEvent" in window) {
        videoEl.setAttribute("x-webkit-airplay", "allow");
        const onAvailability = (e: Event) => {
          setAirPlay((e as Event & { availability?: string }).availability === "available");
        };
        videoEl.addEventListener("webkitplaybacktargetavailabilitychanged", onAvailability);
        undo.push(() =>
          videoEl.removeEventListener("webkitplaybacktargetavailabilitychanged", onAvailability),
        );
      }

      return undo;
    }

    async function init() {
      // Client-only: video.js touches the DOM at import time, so it is
      // loaded inside the effect, never during server prerendering.
      const videojs = (await import("video.js")).default;
      // Registers the `mux` plugin on the video.js instance.
      await import("videojs-mux");
      if (cancelled || !videoRef.current) return;

      const created = videojs(videoRef.current, {
        controls: true,
        autoplay: false,
        preload: "metadata",
        playsinline: true,
        fluid: true,
        playbackRates: [0.75, 1, 1.25, 1.5, 2],
        controlBar: {
          // Back 10s / forward 10s buttons beside play.
          skipButtons: { forward: SKIP_SECONDS, backward: SKIP_SECONDS },
          // Video.js built-in picture-in-picture toggle in the
          // control bar (browsers that support PiP show it).
          pictureInPictureToggle: true,
        },
        // Keyboard shortcuts are handled below for the whole page, so
        // they work without first clicking the player.
        userActions: { hotkeys: false },
        // The caption style panel (size, color, background) keeps the
        // viewer's choices between visits.
        persistTextTrackSettings: true,
        sources: [
          { src: muxStreamUrl(film.playback_id), type: "application/x-mpegURL" },
        ],
        poster: posterUrl(film, 1280),
      });
      player = created;
      playerRef.current = created;
      cleanups.push(...wirePlayerExtras(created));

      // Mux Data: per-film views. A failure here must not break playback.
      try {
        const p = created as unknown as PlayerWithMux;
        if (typeof p.mux === "function") {
          p.mux({ data: muxDataFor(film) });
        }
      } catch {
        // analytics unavailable; playback continues
      }

      forceEnglishCC(created);
      created.on("loadedmetadata", () => forceEnglishCC(created));

      // Continue watching (signed-in users only): resume where they
      // stopped, and record the position as they watch. Finishing a film
      // removes it from Continue watching.
      void resumeFromSaved(created);
      if (wantsAutoplay) {
        created.ready(() => {
          const attempt = created.play();
          // Some phones refuse to start sound without a direct tap on
          // the video. If so, the big play button is simply left
          // showing; nothing breaks.
          if (attempt && typeof attempt.catch === "function") {
            attempt.catch(() => {});
          }
        });
      }
      created.on("timeupdate", () => void savePosition(false));
      created.on("timeupdate", trackView);
      created.on("pause", () => void savePosition(true));
      created.on("playing", () => setResumeAt(null));
      created.on("ended", () => {
        // Up Next end screen (any viewer, signed in or not).
        if (nextFilmRef.current) {
          setSecondsLeft(UP_NEXT_SECONDS);
          setShowUpNext(true);
        }
        const userId = userIdRef.current;
        if (!userId) return;
        void getBrowserSupabase()
          .from("continue_watching")
          .delete()
          .eq("user_id", userId)
          .eq("film_slug", film.slug)
          .then(
            () => {},
            () => {},
          );
      });
    }

    init().catch(() => {
      // If video.js itself fails to load, the video element shows the
      // poster but cannot play (the source is only set through video.js).
    });

    return () => {
      cancelled = true;
      for (const fn of cleanups) {
        try {
          fn();
        } catch {
          // ignore
        }
      }
      playerRef.current = null;
      if (player) {
        player.dispose();
        player = null;
      }
    };
    // Rebuild the player when the film changes (client navigation between
    // film pages reuses this component).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film.playback_id]);

  return (
    <div className="player-shell">
      {resumeAt !== null && !showUpNext ? (
        <div className="resume-prompt" role="group" aria-label="Resume playback">
          <p>
            You stopped at <strong>{formatClock(resumeAt)}</strong>
          </p>
          <div className="resume-actions">
            <button type="button" className="play-btn" onClick={resumeNow}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Resume
            </button>
            <button type="button" className="btn-ghost" onClick={startOver}>
              Start over
            </button>
          </div>
        </div>
      ) : null}
      {airPlay ? (
        <button
          type="button"
          className="airplay-btn"
          onClick={openAirPlay}
          aria-label="Play on a TV or speaker with AirPlay"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 17H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1" />
            <path d="M12 15l5 6H7z" />
          </svg>
        </button>
      ) : null}
      {showUpNext && nextFilm ? (
        <div className="up-next" role="dialog" aria-label="Up next">
          {officialPosterFor(nextFilm.slug) ? (
            <span className="up-next-poster is-official">
              <img
                src={officialPosterFor(nextFilm.slug) as string}
                alt=""
                width={600}
                height={900}
              />
            </span>
          ) : (
            <span className="up-next-poster">
              <img
                src={posterUrl(nextFilm, 800)}
                style={
                  {
                    "--poster-zoom": posterZoomFor(nextFilm.slug),
                  } as React.CSSProperties
                }
                alt=""
                width={800}
                height={450}
              />
            </span>
          )}
          <div className="up-next-body">
            <p className="up-next-label">Up next</p>
            <h3>
              <Link href={`/films/${nextFilm.slug}`}>{nextFilm.title}</Link>
            </h3>
            {nextNeedsGate ? (
              <p className="up-next-count">
                Rated R. Confirm your age to play it.
              </p>
            ) : (
              <>
                <p className="up-next-count">
                  Playing in {secondsLeft}s
                </p>
                <div
                  className="up-next-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={UP_NEXT_SECONDS}
                  aria-valuenow={secondsLeft}
                  aria-label="Time until the next film plays"
                >
                  <span
                    style={{
                      width: `${(secondsLeft / UP_NEXT_SECONDS) * 100}%`,
                    }}
                  />
                </div>
              </>
            )}
            <div className="up-next-actions">
              <button
                type="button"
                className="play-btn"
                onClick={playNextNow}
              >
                Play now
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowUpNext(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {modal}
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered"
        controls
        playsInline
        crossOrigin="anonymous"
        poster={posterUrl(film, 1280)}
        preload="metadata"
        data-testid="tohu-player"
      >
        {/* No <source> child here, deliberately. The source is set only
            through the `sources` option in the videojs() call, so it is
            always routed through VHS (videojs-http-streaming). A <source>
            child lets the browser start loading the HLS stream natively
            before video.js initializes, and the player then adopts that
            native source instead of VHS — VHS never runs, so it never
            creates the subtitle TextTrack from the manifest's SUBTITLES
            group and the captions button never appears. (Reproduced and
            fixed Nov 11, 2026.) If video.js fails to load, the poster
            still shows. */}
      </video>
    </div>
  );
}
