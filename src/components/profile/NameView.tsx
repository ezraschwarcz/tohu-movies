"use client";

import Link from "next/link";
import type { ProfileSettings } from "./useProfileSettings";

export default function NameView({ s }: { s: ProfileSettings }) {
  const {
    bio,
    bioReady,
    busy,
    email,
    error,
    name,
    onSaveName,
    saved,
    setBio,
    setName,
    userId,
  } = s;
  return (
    <>
      <section aria-label="Name and email" id="name">
        <h2 className="profile-h2">Name and email</h2>
        <form className="auth-form" onSubmit={onSaveName}>
          <label className="field">
            <span>Display name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="The name shown on your comments"
              maxLength={60}
              required
              autoComplete="nickname"
            />
          </label>
          {bioReady ? (
            <label className="field">
              <span>
                Bio <span className="toggle-hint">(optional, public)</span>
              </span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 300))}
                placeholder="A line or two about you and the films you like"
                rows={3}
                maxLength={300}
              />
              <span className="field-count">{bio.length}/300</span>
            </label>
          ) : null}
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} disabled readOnly />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="form-note" role="status">
              {saved}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
          <p className="auth-foot">
            <Link href={`/u/${userId}`}>See your public profile</Link>
          </p>
        </form>
      </section>

    </>
  );
}
