"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  isPasskeyDisabledError,
  PASSKEY_DISABLED_MESSAGE,
} from "@/lib/passkeyError";

/** Create an account. Watching is free and needs no account; an account
 *  is only for comments, your watchlist, and continue watching. The
 *  display name is passed as user metadata, so the database trigger
 *  stores it on the profile row that is created automatically at
 *  sign-up.
 *
 *  If sign-up signs the visitor in right away (no email confirmation
 *  step), the form offers to add a passkey on the spot, so the next
 *  sign-in can be Face ID / fingerprint instead of a password. If a
 *  confirmation email is required, there is no session yet, so passkey
 *  registration waits until after sign-in (it is on the profile page).
 *
 *  `next` comes from the server page (search params). */

const LAST_EMAIL_KEY = "tohu-last-email";

export default function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [passkeyAdded, setPasskeyAdded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function callbackUrl(): string {
    const dest = next.startsWith("/") ? next : "/";
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}`;
  }

  function goNext() {
    router.push(next.startsWith("/") ? next : "/");
    router.refresh();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = getBrowserSupabase();
    try {
      const name = displayName.trim();
      if (!name) throw new Error("Please enter a display name.");
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: callbackUrl(),
        },
      });
      if (err) throw err;
      try {
        window.localStorage.setItem(LAST_EMAIL_KEY, email.trim());
      } catch {
        // ignore
      }
      if (data.session) {
        setSignedIn(true);
        setMessage(
          "Account created — you are signed in. Add a passkey now to sign in with Face ID or fingerprint next time, or continue to the films.",
        );
      } else {
        setMessage(
          "Account created — check your email to confirm it, then sign in.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onAddPasskey() {
    setPasskeyBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    try {
      const { error: err } = await supabase.auth.registerPasskey();
      if (err) throw err;
      setPasskeyAdded(true);
      setMessage("Passkey added. Next time, sign in with Face ID or fingerprint.");
    } catch (err) {
      if (isPasskeyDisabledError(err)) {
        setError(PASSKEY_DISABLED_MESSAGE);
      } else {
        const text = err instanceof Error ? err.message : "";
        setError(
          text ||
            "Could not add a passkey. You can add one later from your profile.",
        );
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <h1>Create an account</h1>
      <p className="auth-intro">
        Watching is free and needs no account. An account is only for
        comments, your watchlist, and continue watching.
      </p>

      {signedIn ? (
        <div className="auth-form">
          {message ? (
            <p className="form-note" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {!passkeyAdded ? (
            <button
              type="button"
              className="btn-passkey"
              onClick={() => void onAddPasskey()}
              disabled={passkeyBusy}
            >
              {passkeyBusy ? "Waiting for your device…" : "Add a passkey"}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            onClick={goNext}
          >
            Continue to the films
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="The name shown on your comments"
              maxLength={60}
              required
              autoComplete="nickname"
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="form-note" role="status">
              {message}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Please wait…" : "Create account"}
          </button>
        </form>
      )}

      <p className="auth-foot">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
      <p className="auth-foot">
        <Link href="/">← Back to films</Link>
      </p>
    </div>
  );
}
