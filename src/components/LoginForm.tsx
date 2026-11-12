"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  isPasskeyDisabledError,
  PASSKEY_DISABLED_MESSAGE,
} from "@/lib/passkeyError";

/** Sign in only. Watching is free and needs no account; an account is
 *  only for comments, watchlist, and continue watching.
 *
 *  The primary option is a passkey (Face ID / fingerprint / device
 *  biometric, via Supabase auth.signInWithPasskey). Password sign-in is
 *  the second option, with a "Forgot password?" link. There is no magic
 *  link sign-in: sign-in is passkey plus password only. (Sign-up still
 *  sends an email confirmation; that is account confirmation, not
 *  magic link sign-in, and it still goes through /auth/callback.)
 *
 *  The last-used email is remembered in localStorage ("tohu-last-email")
 *  and pre-filled here, so a returning visitor does not have to type it
 *  again.
 *
 *  `next` and `urlError` come from the server page (search params), so
 *  the form renders in the initial HTML instead of waiting on JS.
 *  `urlMessage` is a success note the same way (e.g. after a password
 *  reset lands here); only known codes are shown, nothing is reflected
 *  from the URL verbatim.
 *
 *  Forgot password: the password form has a "Forgot password?" link. It
 *  sends a reset email (resetPasswordForEmail) whose link lands on
 *  /auth/callback?next=/auth/reset-password, where the code is
 *  exchanged for a recovery session and the visitor sets a new
 *  password. */

const LAST_EMAIL_KEY = "tohu-last-email";

function rememberEmail(email: string) {
  try {
    window.localStorage.setItem(LAST_EMAIL_KEY, email.trim());
  } catch {
    // ignore
  }
}

export default function LoginForm({
  next,
  urlError,
  urlMessage,
}: {
  next: string;
  urlError: string | null;
  urlMessage: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(true);
  const [forgot, setForgot] = useState(false);
  const [message, setMessage] = useState<string | null>(
    urlMessage === "password-reset"
      ? "Your password has been set. Sign in with your new password."
      : null,
  );
  const [error, setError] = useState<string | null>(
    urlError ? decodeURIComponent(urlError) : null,
  );

  // Pre-fill the remembered email, and check whether this browser can
  // do passkeys at all (client side only).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      // ignore
    }
    if (
      typeof window === "undefined" ||
      typeof window.PublicKeyCredential === "undefined"
    ) {
      setPasskeySupported(false);
    }
  }, []);

  function goNext() {
    router.push(next.startsWith("/") ? next : "/");
    router.refresh();
  }

  async function onPasskey() {
    setPasskeyBusy(true);
    setError(null);
    setMessage(null);
    const supabase = getBrowserSupabase();
    try {
      const { data, error: err } = await supabase.auth.signInWithPasskey();
      if (err) throw err;
      if (data.session) {
        if (data.user?.email) rememberEmail(data.user.email);
        goNext();
      } else {
        throw new Error("Passkey sign-in did not create a session.");
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      const text = err instanceof Error ? err.message : "";
      if (isPasskeyDisabledError(err)) {
        setError(PASSKEY_DISABLED_MESSAGE);
      } else if (
        code === "ERROR_CEREMONY_ABORTED" ||
        /cancel|abort/i.test(text)
      ) {
        setError(
          "Passkey sign-in was cancelled. Try again, or use an email link instead.",
        );
      } else {
        setError(
          text ||
            "Passkey sign-in did not work. Try again, or use an email link instead.",
        );
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = getBrowserSupabase();
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
        },
      );
      if (err) throw err;
      rememberEmail(email);
      setMessage(
        "Check your email — we sent you a password reset link. It takes you to a page where you set a new password.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = getBrowserSupabase();
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      rememberEmail(email);
      goNext();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <h1>Sign in</h1>
      <p className="auth-intro">
        Watching is free and needs no account. An account is only for
        comments, your watchlist, and continue watching.
      </p>

      <button
        type="button"
        className="btn-passkey"
        onClick={() => void onPasskey()}
        disabled={passkeyBusy || !passkeySupported}
      >
        {passkeyBusy
          ? "Waiting for your device…"
          : "Sign in with passkey"}
      </button>
      <p className="passkey-hint">
        {passkeySupported
          ? "Face ID, fingerprint, or your device PIN. No password to remember."
          : "Passkeys are not supported in this browser. Use an email link or password below."}
      </p>

      <div className="auth-divider" role="separator">
        <span>or sign in with password</span>
      </div>

      {forgot ? (
        <form className="auth-form" onSubmit={onForgot}>
          <p className="auth-intro">
            Enter your email and we will send you a link to set a new
            password.
          </p>
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
            {busy ? "Please wait…" : "Send reset link"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setForgot(false);
              setError(null);
              setMessage(null);
            }}
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={onSubmit}>
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
              placeholder="Your password"
              required
              minLength={6}
              autoComplete="current-password"
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
            {busy ? "Please wait…" : "Sign in"}
          </button>
          <p className="auth-foot">
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setForgot(true);
                setError(null);
                setMessage(null);
              }}
            >
              Forgot password?
            </button>
          </p>
        </form>
      )}

      <p className="auth-foot">
        New here? <Link href="/signup">Create an account</Link>
      </p>
      <p className="auth-foot">
        <Link href="/">← Back to films</Link>
      </p>
    </div>
  );
}
