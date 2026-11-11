"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Sign in / sign up form. Watching is free and needs no account; an
 *  account is only for comments, watchlist, and continue watching.
 *
 *  Sign in: magic link (primary, no password to remember) or password.
 *  Sign up: email, display name, and password. The display name is
 *  passed as user metadata, so the database trigger stores it on the
 *  profile row that is created automatically at sign-up.
 *
 *  `next` and `urlError` come from the server page (search params), so
 *  the form renders in the initial HTML instead of waiting on JS. */

type Mode = "signin-magic" | "signin-password" | "signup";

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
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    urlError ? decodeURIComponent(urlError) : null,
  );

  function callbackUrl(): string {
    const dest = next.startsWith("/") ? next : "/";
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}`;
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
        setMessage(
          "Check your email — we sent you a sign-in link. It signs you in when you click it.",
        );
      } else if (mode === "signin-password") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        router.push(next.startsWith("/") ? next : "/");
        router.refresh();
      } else {
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
        if (data.session) {
          router.push(next.startsWith("/") ? next : "/");
          router.refresh();
        } else {
          setMessage(
            "Account created — check your email to confirm it, then sign in.",
          );
        }
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
    { key: "signin-magic", label: "Sign in with email link" },
    { key: "signin-password", label: "Sign in with password" },
    { key: "signup", label: "Create an account" },
  ];

  return (
    <div className="auth-wrap">
      <h1>{mode === "signup" ? "Create an account" : "Sign in"}</h1>
      <p className="auth-intro">
        Watching is free and needs no account. An account is only for
        comments, your watchlist, and continue watching.
      </p>

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
        {mode === "signup" ? (
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
        ) : null}
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
        {mode !== "signin-magic" ? (
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "signup" ? "At least 6 characters" : "Your password"
              }
              required
              minLength={6}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
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
              : mode === "signin-password"
                ? "Sign in"
                : "Create account"}
        </button>
      </form>

      <p className="auth-foot">
        <Link href="/">← Back to films</Link>
      </p>
    </div>
  );
}
