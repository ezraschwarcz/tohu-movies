"use client";

import { useCallback, useState } from "react";
import { ageFromBirthdate, isAgeVerified, setAgeVerified } from "@/lib/ageGate";
import type { Film } from "@/lib/types";

/** Age gate for R rated films, matching the live site: a modal with an
 *  optional birthdate field and an "I confirm I am 18 or older" button.
 *  A birthdate under 18 is blocked. Confirmation is remembered in the
 *  browser (localStorage) only. */

export function AgeGateModal({
  filmTitle,
  onConfirm,
  onCancel,
}: {
  filmTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState("");

  function confirm() {
    if (birthdate) {
      const age = ageFromBirthdate(birthdate);
      if (age === null) {
        setError("Enter a valid birthdate, or confirm below.");
        return;
      }
      if (age < 18) {
        setError(
          "This film is rated R. You must be 18 or older to watch it.",
        );
        return;
      }
    }
    setAgeVerified();
    onConfirm();
  }

  return (
    <div
      className="age-gate open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-title"
    >
      <div className="age-panel">
        <span className="age-badge">R</span>
        <h2 id="age-title">This film is rated R</h2>
        <p id="age-desc">
          {filmTitle} is rated R. Please confirm you are 18 or older to
          watch it. You can also enter your birthdate below, or leave it
          blank.
        </p>
        <label htmlFor="age-dob">Birthdate (optional)</label>
        <input
          id="age-dob"
          type="date"
          value={birthdate}
          onChange={(e) => {
            setBirthdate(e.target.value);
            setError("");
          }}
        />
        {error ? (
          <p className="age-error show" role="alert">
            {error}
          </p>
        ) : null}
        <div className="age-actions">
          <button type="button" className="age-confirm" onClick={confirm}>
            I confirm I am 18 or older
          </button>
          <button type="button" className="age-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <p className="age-note">
          Your confirmation is stored only in this browser, so you are not
          asked again on this device.
        </p>
      </div>
    </div>
  );
}

/** Hook for gating an action behind the R age check. Call ensureAllowed
 *  with the film and what should happen once the viewer is allowed; render
 *  the returned modal element. Non-R films and already-verified viewers
 *  pass straight through. */
export function useAgeGate() {
  const [pending, setPending] = useState<{
    film: Film;
    onAllowed: () => void;
  } | null>(null);

  const ensureAllowed = useCallback((film: Film, onAllowed: () => void) => {
    if (film.rating !== "R" || isAgeVerified()) {
      onAllowed();
      return;
    }
    setPending({ film, onAllowed });
  }, []);

  const modal = pending ? (
    <AgeGateModal
      filmTitle={pending.film.title}
      onConfirm={() => {
        const cb = pending.onAllowed;
        setPending(null);
        cb();
      }}
      onCancel={() => setPending(null)}
    />
  ) : null;

  return { ensureAllowed, modal };
}
