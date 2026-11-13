"use client";

import { useEffect, useState } from "react";
import { isAgeVerified } from "@/lib/ageGate";
import { posterUrl } from "@/lib/films";
import type { Film } from "@/lib/types";
import { AgeGateModal } from "./AgeGate";
import Player from "./Player";

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
  const [allowed, setAllowed] = useState<boolean | null>(
    film.rating === "R" ? null : true,
  );
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    if (film.rating !== "R") return;
    if (isAgeVerified()) {
      setAllowed(true);
    } else {
      setAllowed(false);
      setGateOpen(true);
    }
  }, [film.rating, film.slug]);

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
              setAllowed(true);
              setGateOpen(false);
            }}
            onCancel={() => setGateOpen(false)}
          />
        ) : (
          <p style={{ marginTop: 14 }}>
            <button
              type="button"
              className="play-btn"
              onClick={() => setGateOpen(true)}
            >
              Watch — rated R
            </button>
          </p>
        )}
      </>
    );
  }

  return <Player film={film} nextFilm={nextFilm} />;
}
