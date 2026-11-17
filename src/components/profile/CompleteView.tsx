"use client";

import type { ProfileSettings } from "./useProfileSettings";

export default function CompleteView({ s }: { s: ProfileSettings }) {
  const {
    allGenres,
    completion,
    favGenres,
    genreBusy,
    genreError,
    genreSaved,
    hasPasskey,
    onSaveGenres,
    setView,
    toggleGenre,
  } = s;
  return (
    <>
      <section aria-label="Complete your profile" id="complete">
        <h2 className="profile-h2">Complete your profile</h2>
        {completion.complete ? (
          <p className="profile-line">
            Pick up to 3. They shape the rows on your home page.
          </p>
        ) : (
          <>
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
            <p className="profile-line">
              {completion.percent}% complete. Two quick steps:
            </p>
            <ul className="wizard-steps">
              <li>
                <span aria-hidden="true">
                  {completion.hasName ? "✓" : "○"}
                </span>{" "}
                Display name{" "}
                {completion.hasName ? (
                  <span className="toggle-hint">Done</span>
                ) : (
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => setView("name")}
                  >
                    Add yours
                  </button>
                )}
              </li>
              <li>
                <span aria-hidden="true">
                  {completion.genres.length > 0 ? "✓" : "○"}
                </span>{" "}
                Favorite genres (pick up to 3)
              </li>
              <li>
                <span aria-hidden="true">{hasPasskey ? "✓" : "○"}</span>{" "}
                Passkey{" "}
                <span className="toggle-hint">
                  Optional bonus, never required.{" "}
                  {hasPasskey ? "Added." : ""}
                </span>
                {hasPasskey ? null : (
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => setView("security")}
                  >
                    Add one in Sign-in &amp; Security
                  </button>
                )}
              </li>
            </ul>
          </>
        )}
        <div>
            <div
              className="chips"
              role="group"
              aria-label="Pick up to 3 favorite genres"
            >
              {allGenres.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="chip"
                  aria-pressed={favGenres.includes(g)}
                  onClick={() => toggleGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            {genreError ? (
              <p className="form-error" role="alert">
                {genreError}
              </p>
            ) : null}
            {genreSaved ? (
              <p className="form-note" role="status">
                {genreSaved}
              </p>
            ) : null}
            <button
              type="button"
              className="btn-primary"
              onClick={() => void onSaveGenres()}
              disabled={genreBusy}
            >
              {genreBusy ? "Saving…" : "Save favorite genres"}
            </button>
        </div>
      </section>

    </>
  );
}
