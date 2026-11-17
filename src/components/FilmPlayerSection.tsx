"use client";

import { useEffect, useState } from "react";
import { AGE_VERIFIED_KEY } from "@/lib/ageGate";
import { useHydrated, useStoredValue } from "@/lib/clientState";
import { posterUrl } from "@/lib/films";
import { trackFilmEvent } from "@/lib/track";
import type { Film } from "@/lib/types";
import { AgeGateModal } from "./AgeGate";
import Player from "./Player";
import PlayerBoundary from "./PlayerBoundary";

/** The film page player area. Non-R films play straight away. R rated
 *  films show the age gate before the player appears; the check reads
 *  localStorage after mount (never during prerendering, so there is no
 *  hydration mismatch). If the viewer cancels the gate, a button reopens
 *  it. */
export default function FilmPlayerSection({
  film,
  nextFilm = null,
}: {
  film: Film;
  /** Up Next pick for the player's end screen. */
  nextFilm?: Film | null;
}) {
  // R-rated films wait for the visitor's saved age answer, which only
  // the browser knows: null means "not known yet", so nothing flashes.
  const hydrated = useHydrated();
  const verified = useStoredValue(AGE_VERIFIED_KEY) === "1";
  const [confirmedNow, setConfirmedNow] = useState(false);
  const [gateClosedOn, setGateClosedOn] = useState<string | null>(null);
  const allowed: boolean | null =
    film.rating !== "R" ? true : !hydrated ? null : verified || confirmedNow;
  // The age question opens by itself on each R-rated film, until closed.
  const gateOpen = allowed === false && gateClosedOn !== film.slug;

  useEffect(() => {
    trackFilmEvent(film.slug, "open");
  }, [film.slug]);

  if (allowed === null) {
    return (
      <div className="player-placeholder">
        {/* Plain <img>, not next/image: the Mux still URL carries
            ?width=...&time=... query params, which the /_next/image
            optimizer rejects with HTTP 400. Mux already sizes the
            still, so the optimizer adds nothing. */}
        <img
          src={posterUrl(film, 1280)}
          alt={`Still from ${film.title}`}
          width={1280}
          height={720}
          fetchPriority="high"
        />
      </div>
    );
  }

  if (!allowed) {
    return (
      <>
        <div className="player-placeholder">
          <img
            src={posterUrl(film, 1280)}
            alt={`Still from ${film.title}`}
            width={1280}
            height={720}
            fetchPriority="high"
          />
          <p className="gate-note">
            This film is rated R. Confirm you are 18 or older to watch it.
          </p>
        </div>
        {gateOpen ? (
          <AgeGateModal
            filmTitle={film.title}
            onConfirm={() => {
              setConfirmedNow(true);
            }}
            onCancel={() => setGateClosedOn(film.slug)}
          />
        ) : (
          <p style={{ marginTop: 14 }}>
            <button
              type="button"
              className="play-btn"
              onClick={() => setGateClosedOn(null)}
            >
              Watch — rated R
            </button>
          </p>
        )}
      </>
    );
  }

  return (
    <PlayerBoundary film={film}>
      <Player film={film} nextFilm={nextFilm} />
    </PlayerBoundary>
  );
}
