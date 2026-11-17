"use client";

import AccountSafety from "../AccountSafety";
import EmailPrefs from "../EmailPrefs";
import type { ProfileSettings } from "./useProfileSettings";

export default function PreferencesView({ s }: { s: ProfileSettings }) {
  const {
    hideRRated,
    isAdmin,
    setHideRRated,
    userId,
  } = s;
  return (
    <>
      <section aria-label="Preferences" id="preferences">
        <h2 className="profile-h2">Preferences</h2>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={hideRRated}
            onChange={(e) => setHideRRated(e.target.checked)}
          />
          <span>
            Hide R rated films
            <span className="toggle-hint">
              R rated films will not appear in the film rows or the
              Browse all films grid on this device.
            </span>
          </span>
        </label>
        <EmailPrefs userId={userId} />
        <AccountSafety userId={userId} isAdmin={isAdmin} />
      </section>

    </>
  );
}
