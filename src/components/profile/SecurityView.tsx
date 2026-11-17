"use client";

import type { ProfileSettings } from "./useProfileSettings";

export default function SecurityView({ s }: { s: ProfileSettings }) {
  const {
    confirmPassword,
    newPassword,
    onAddPasskey,
    onRemovePasskey,
    onSetPassword,
    passkeyBusy,
    passkeyError,
    passkeyMessage,
    passkeys,
    passwordBusy,
    passwordError,
    passwordSaved,
    setConfirmPassword,
    setNewPassword,
  } = s;
  return (
    <>
      <section aria-label="Sign-in and security" id="security">
        <h2 className="profile-h2">Sign-in &amp; Security</h2>
        <h3 className="profile-h3">Set a password</h3>
        <p className="profile-line">
          If you signed up with an email link, you have no password yet.
          Set one here to sign in with a password as well.
        </p>
        <form className="auth-form" onSubmit={onSetPassword}>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Type it again"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          {passwordError ? (
            <p className="form-error" role="alert">
              {passwordError}
            </p>
          ) : null}
          {passwordSaved ? (
            <p className="form-note" role="status">
              {passwordSaved}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={passwordBusy}>
            {passwordBusy ? "Saving…" : "Set password"}
          </button>
        </form>
      </section>

      <section aria-label="Passkeys" id="passkeys">
        <h2 className="profile-h2">Passkeys</h2>
        <p className="profile-line">
          Passkeys let you sign in with Face ID, fingerprint, or your
          device PIN instead of a password.
        </p>
        {passkeyError ? (
          <p className="form-error" role="alert">
            {passkeyError}
          </p>
        ) : null}
        {passkeyMessage ? (
          <p className="form-note" role="status">
            {passkeyMessage}
          </p>
        ) : null}
        {passkeys === null ? (
          <p className="profile-line">Loading your passkeys…</p>
        ) : passkeys.length === 0 ? (
          <p className="profile-line">No passkeys yet.</p>
        ) : (
          <ul className="profile-list">
            {passkeys.map((p) => (
              <li key={p.id} className="profile-row">
                <span>
                  {p.friendly_name || "Passkey"}
                  <span className="toggle-hint">
                    Added{" "}
                    {new Date(p.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {p.last_used_at
                      ? ` · Last used ${new Date(p.last_used_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`
                      : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn-ghost danger"
                  onClick={() =>
                    void onRemovePasskey(p.id, p.friendly_name || "Passkey")
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn-passkey"
          onClick={() => void onAddPasskey()}
          disabled={passkeyBusy}
        >
          {passkeyBusy ? "Waiting for your device…" : "Add a passkey"}
        </button>
      </section>

    </>
  );
}
