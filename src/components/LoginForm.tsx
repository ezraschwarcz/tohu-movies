"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Sign in only. Watching is free and needs no account; an account is
 *  only for comments, watchlist, and continue watching.
 *
 *  The primary option is a passkey (Face ID / fingerprint / device
 *  biometric, via Supabase auth.signInWithPasskey). Magic link and
 *  password sign-in stay as secondary options. Sign-up lives on its own
 *  page (/signup); this form has no create-account tab.
 *
 *  The last-used email is remembered in localStorage ("tohu-last-email")
 *  and pre-filled here, so a returning visitor does not have to type it
 *  again.
 *
 *  `next` and `urlError` come from the server page (search params), so
 *  the form renders in the initial HTML instead of waiting on JS. */

const LAST_EMAIL_KEY = "tohu-last-email";

type Mode = "signin-magic" | "signin-password";

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
}: {
  next: string;
  urlError: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin-magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
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

  function callbackUrl(): string {
    const dest = next.startsWith("/") ? next : "/";
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}`;
  }

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
      if (
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = getBrowserSupabase();
    try {
      if (mode === "signin-magic") {
        const { error: err } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: callbackUrl() },
        });
        if (err) throw err;
        rememberEmail(email);
        setMessage(
          "Check your email — we sent you a sign-in link. It signs you in when you click it.",
        );
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        rememberEmail(email);
        goNext();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: Mode; label: string }[] = [
    { key: "signin-magic", label: "Email me a sign-in link" },
    { key: "signin-password", label: "Sign in with password" },
  ];

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
        <span>or sign in with email</span>
      </div>

      <div className="auth-tabs" role="tablist" aria-label="Sign in options">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            className={`auth-tab${mode === key ? " active" : ""}`}
            onClick={() => {
              setMode(key);
              setError(null);
              setMessage(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>

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
        {mode === "signin-password" ? (
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
        ) : null}
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
          {busy
            ? "Please wait…"
            : mode === "signin-magic"
              ? "Email me a sign-in link"
              : "Sign in"}
        </button>
      </form>

      <p className="auth-foot">
        New here? <Link href="/signup">Create an account</Link>
      </p>
      <p className="auth-foot">
        <Link href="/">← Back to films</Link>
      </p>
    </div>
  );
}
