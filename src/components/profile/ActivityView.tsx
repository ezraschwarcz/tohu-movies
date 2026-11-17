"use client";

import Link from "next/link";
import type { ProfileSettings } from "./useProfileSettings";

export default function ActivityView({ s }: { s: ProfileSettings }) {
  const {
    rated,
  } = s;
  return (
    <>
      <section aria-label="Your activity" id="activity">
        <h2 className="profile-h2">Your activity</h2>
        <h3 className="profile-h3">Films you rated on this device</h3>
        {rated === null ? (
          <p className="profile-line">Loading your ratings…</p>
        ) : rated.length === 0 ? (
          <p className="profile-line">
            You have not rated any films yet on this device. Tap the stars
            on any film to rate it.
          </p>
        ) : (
          <ul className="profile-list">
            {rated.map((r) => (
              <li key={r.film_slug} className="profile-row">
                <Link href={`/films/${r.film_slug}`}>{r.title}</Link>
                <span
                  className="profile-stars"
                  aria-label={`${r.stars} out of 5 stars`}
                >
                  {"★".repeat(r.stars)}
                  {"☆".repeat(5 - r.stars)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </>
  );
}
