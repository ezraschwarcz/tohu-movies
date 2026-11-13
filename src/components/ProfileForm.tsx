"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  isPasskeyDisabledError,
  PASSKEY_DISABLED_MESSAGE,
} from "@/lib/passkeyError";
import { computeProfileCompletion } from "@/lib/profile";
import { useAuth } from "./AuthProvider";
import { useSiteSearch } from "./SiteProvider";

/** Profile: display name, email, preferences, your activity, passkeys,
 *  and sign out. Ratings are anonymous per browser (voter id in
 *  localStorage), so "films you rated" means films rated on this device.
 *
 *  The display name saves to profiles.display_name. The update policy
 *  lets a user update only their own row, and is_admin can never be
 *  changed this way (the policy's WITH CHECK blocks self-promotion).
 *  The "Hide R rated films" toggle is a per-browser preference in
 *  localStorage, shared with the home grid through the site context. */

const VOTER_KEY = "tohu-voter-id-v1";

type RatedFilm = {
  film_slug: string;
  stars: number;
  title: string;
};

type PasskeyItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

export default function ProfileForm({
  userId,
  email,
  displayName,
  watchlistCount,
  isAdmin,
  initialPasswordSet,
  initialGenres,
  allGenres,
}: {
  userId: string;
  email: string;
  displayName: string;
  watchlistCount: number;
  /** Admins reach /admin from here on mobile, where the header nav
   *  pills row is hidden behind the bottom tab bar. */
  isAdmin: boolean;
  /** password_set flag from auth user metadata (server read). */
  initialPasswordSet: boolean;
  /** favorite_genres from auth user metadata (server read). */
  initialGenres: string[];
  /** Every genre in the catalog, for the completion picker. */
  allGenres: string[];
}) {
  const { signOut, refreshProfile } = useAuth();
  const { hideRRated, setHideRRated } = useSiteSearch();
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [rated, setRated] = useState<RatedFilm[] | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyItem[] | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  // Profile completion state: the saved name (not the in-progress
  // input), the password flag, and the picked genres.
  const [savedName, setSavedName] = useState(displayName);
  const [passwordIsSet, setPasswordIsSet] = useState(initialPasswordSet);
  const [favGenres, setFavGenres] = useState<string[]>(initialGenres);
  const [genreBusy, setGenreBusy] = useState(false);
  const [genreSaved, setGenreSaved] = useState<string | null>(null);
  const [genreError, setGenreError] = useState<string | null>(null);

  const completion = computeProfileCompletion({
    displayName: savedName,
    passwordSet: passwordIsSet,
    favoriteGenres: favGenres,
  });
  const hasPasskey = passkeys !== null && passkeys.length > 0;

  function toggleGenre(genre: string) {
    setGenreSaved(null);
    setGenreError(null);
    setFavGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((g) => g !== genre);
      if (prev.length >= 3) return prev;
      return [...prev, genre];
    });
  }

  async function onSaveGenres() {
    setGenreBusy(true);
    setGenreError(null);
    setGenreSaved(null);
    const supabase = getBrowserSupabase();
    const { error: err } = await supabase.auth.updateUser({
      data: { favorite_genres: favGenres },
    });
    setGenreBusy(false);
    if (err) {
      setGenreError(err.message);
      return;
    }
    setGenreSaved("Favorite genres saved.");
  }

  // Films rated on this device (anonymous voter id in localStorage).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let voterId: string | null = null;
      try {
        voterId = window.localStorage.getItem(VOTER_KEY);
      } catch {
        // ignore
      }
      if (!voterId) {
        if (!cancelled) setRated([]);
        return;
      }
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from("ratings")
        .select("film_slug,stars,films(title)")
        .eq("voter_id", voterId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const rows = (data ?? []) as unknown as {
        film_slug: string;
        stars: number;
        films: { title: string } | { title: string }[] | null;
      }[];
      setRated(
        rows.map((r) => {
          const film = Array.isArray(r.films) ? r.films[0] : r.films;
          return {
            film_slug: r.film_slug,
            stars: r.stars,
            title: film?.title ?? r.film_slug,
          };
        }),
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Registered passkeys for this account.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = getBrowserSupabase();
      const { data, error: err } = await supabase.auth.passkey.list();
      if (cancelled) return;
      if (err) {
        setPasskeyError("Could not load your passkeys.");
        setPasskeys([]);
        return;
      }
      setPasskeys(data ?? []);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSaveName(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a display name.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    const supabase = getBrowserSupabase();
    const { error: err } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", userId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshProfile();
    setSavedName(trimmed);
    setSaved("Display name saved.");
  }

  async function onAddPasskey() {
    setPasskeyBusy(true);
    setPasskeyError(null);
    setPasskeyMessage(null);
    const supabase = getBrowserSupabase();
    try {
      const { error: err } = await supabase.auth.registerPasskey();
      if (err) throw err;
      setPasskeyMessage("Passkey added.");
      const { data } = await supabase.auth.passkey.list();
      setPasskeys(data ?? []);
    } catch (err) {
      if (isPasskeyDisabledError(err)) {
        setPasskeyError(PASSKEY_DISABLED_MESSAGE);
      } else {
        const text = err instanceof Error ? err.message : "";
        setPasskeyError(
          text || "Could not add a passkey. Try again.",
        );
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  /** Set (or change) a password while signed in. This is how a
   *  magic-link-only account gets a password: updateUser adds one to
   *  the account, and the visitor can sign in with it next time. */
  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError("Your password needs at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The two passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordSaved(null);
    const supabase = getBrowserSupabase();
    const { error: err } = await supabase.auth.updateUser({
      password: newPassword,
      data: { password_set: true },
    });
    setPasswordBusy(false);
    if (err) {
      setPasswordError(err.message);
      return;
    }
    setPasswordIsSet(true);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(
      "Password set. You can sign in with it next time.",
    );
  }

  async function onRemovePasskey(id: string, label: string) {
    if (
      !window.confirm(`Remove the passkey “${label}”? You can add a new one any time.`)
    ) {
      return;
    }
    setPasskeyError(null);
    setPasskeyMessage(null);
    const supabase = getBrowserSupabase();
    const { error: err } = await supabase.auth.passkey.delete({
      passkeyId: id,
    });
    if (err) {
      setPasskeyError(err.message);
      return;
    }
    setPasskeys((list) => (list ?? []).filter((p) => p.id !== id));
    setPasskeyMessage("Passkey removed.");
  }

  return (
    <div className="auth-wrap">
      <h1>Your profile</h1>
      <p className="auth-intro">
        Your name, preferences, and activity. Watching stays free; this
        account is only for comments, your watchlist, and continue
        watching.
      </p>

      <nav className="profile-nav" aria-label="Profile sections">
        <a href="#complete">Complete profile</a>
        <a href="#mystuff">My Stuff</a>
        <a href="#activity">Activity</a>
        <a href="#preferences">Preferences</a>
        <a href="#security">Sign-in &amp; Security</a>
        {isAdmin ? <a href="#admin">Admin</a> : null}
      </nav>

      <section aria-label="Complete your profile" id="complete">
        <h2 className="profile-h2">Complete your profile</h2>
        {completion.complete ? (
          <p className="form-note" role="status">
            Profile complete. Your name, password, and favorite genres
            are all set. You can change your genres any time below.
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
              {completion.percent}% complete. Three quick steps:
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
                  <a href="#name">Add yours below</a>
                )}
              </li>
              <li>
                <span aria-hidden="true">
                  {completion.hasPassword ? "✓" : "○"}
                </span>{" "}
                Password{" "}
                {completion.hasPassword ? (
                  <span className="toggle-hint">Done</span>
                ) : (
                  <a href="#security">Set one under Sign-in &amp; Security</a>
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
                {hasPasskey ? null : <a href="#security">Add one below</a>}
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
            {busy ? "Saving…" : "Save display name"}
          </button>
        </form>
      </section>

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

      {isAdmin ? (
        <section aria-label="Admin" id="admin">
          <h2 className="profile-h2">Admin</h2>
          <p className="profile-line">
            <Link href="/admin">Open the admin panel</Link> to moderate
            comments and add films.
          </p>
        </section>
      ) : null}

      <section aria-label="My Stuff" id="mystuff">
        <h2 className="profile-h2">My Stuff</h2>
        <p className="profile-line">
          <Link href="/watchlist">
            My watchlist ({watchlistCount} film
            {watchlistCount === 1 ? "" : "s"} saved)
          </Link>
        </p>
        <p className="profile-line">
          Films you stopped partway through are under{" "}
          <Link href="/watchlist">Continue watching on your watchlist
          page</Link>
          , ready to resume.
        </p>
      </section>

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
      </section>

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

      <section aria-label="Sign out">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </section>

      <p className="auth-foot">
        <Link href="/">← Back to films</Link>
      </p>
    </div>
  );
}
