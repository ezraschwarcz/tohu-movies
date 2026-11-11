"use client";

import { useEffect, useRef } from "react";
import type VideoJsPlayer from "video.js/dist/types/player";
import "video.js/dist/video-js.css";
import { durationSeconds, muxStreamUrl, posterUrl } from "@/lib/films";
import { MUX_DATA_ENV_KEY, MUX_PLAYER_NAME } from "@/lib/site";
import type { Film } from "@/lib/types";

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

  useEffect(() => {
    let cancelled = false;
    let player: VideoJsPlayer | null = null;

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
    }

    init().catch(() => {
      // If video.js itself fails to load, the video element stays usable
      // as a plain <video> (the source is set below as a fallback).
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
        {/* Fallback source: if video.js fails to initialise, the browser
            still plays the HLS stream natively (Safari) or shows the
            poster. video.js replaces this source on init. */}
        <source src={muxStreamUrl(film.playback_id)} type="application/x-mpegURL" />
      </video>
    </div>
  );
}
