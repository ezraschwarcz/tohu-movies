"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
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
}: {
  userId: string;
  email: string;
  displayName: string;
  watchlistCount: number;
}) {
  const { signOut, refreshProfile } = useAuth();
  const { hideRRated, setHideRRated } = useSiteSearch();
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState<RatedFilm[] | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyItem[] | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);

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
      const text = err instanceof Error ? err.message : "";
      setPasskeyError(
        text || "Could not add a passkey. Try again.",
      );
    } finally {
      setPasskeyBusy(false);
    }
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

      <section aria-label="Name and email">
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

      <section aria-label="Preferences">
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
              R rated films will not appear in the Now Streaming grid on
              this device.
            </span>
          </span>
        </label>
      </section>

      <section aria-label="Your activity">
        <h2 className="profile-h2">Your activity</h2>
        <p className="profile-line">
          <Link href="/watchlist">
            My watchlist ({watchlistCount} film
            {watchlistCount === 1 ? "" : "s"} saved)
          </Link>
        </p>
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

      <section aria-label="Passkeys">
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
