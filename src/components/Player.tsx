"use client";

import { useEffect, useRef } from "react";
import type VideoJsPlayer from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import { durationSeconds, muxStreamUrl, posterUrl } from "@/lib/films";
import { MUX_DATA_ENV_KEY, MUX_PLAYER_NAME } from "@/lib/site";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Film } from "@/lib/types";
import { useAuth } from "./AuthProvider";

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

export default function Player({ film }: { film: Film }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { user } = useAuth();
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

    /** Resume where a signed-in user stopped, once, right after the
     *  player loads. Skipped for very short positions and for films
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
          const seek = () => {
            try {
              p.currentTime(pos);
            } catch {
              // ignore
            }
          };
          if (p.readyState() >= 1) {
            seek();
          } else {
            p.one("loadedmetadata", seek);
          }
        }
      } catch {
        // resume is best effort; playback starts from the beginning
      }
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
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        sources: [
          { src: muxStreamUrl(film.playback_id), type: "application/x-mpegURL" },
        ],
        poster: posterUrl(film, 1280),
      });
      player = created;

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
      created.on("timeupdate", () => void savePosition(false));
      created.on("pause", () => void savePosition(true));
      created.on("ended", () => {
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
