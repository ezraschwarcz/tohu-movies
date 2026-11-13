"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Set a new password after clicking a password reset link.
 *
 *  The reset email points at /auth/callback?next=/auth/reset-password,
 *  which exchanges the code for a recovery session and lands here, so
 *  by the time this page mounts the visitor is signed in on a recovery
 *  session. This form waits for that session (the PASSWORD_RECOVERY
 *  event, or an existing session from the callback), then updateUser
 *  sets the new password. On success it signs out and sends the
 *  visitor to /login with a success note, so they sign in with the new
 *  password. An invalid or expired link shows an error with a way to
 *  request a new one instead of a dead form. */

export default function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled && session) setReady(true);
    }
    void check();

    // The recovery session can also arrive as a PASSWORD_RECOVERY
    // event (hash-based links), so listen for it too.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });

    // If no session shows up, the link was invalid or expired.
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setReady((wasReady) => {
          if (!wasReady) setLinkError(true);
          return wasReady;
        });
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Your password needs at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    setDone(true);
    // Sign out of the recovery session so the visitor lands on the
    // sign-in page signed out, ready to sign in with the new password.
    await supabase.auth.signOut();
    router.push("/login?message=password-reset");
    router.refresh();
  }

  if (linkError) {
    return (
      <div className="auth-wrap">
        <h1>Set a new password</h1>
        <p className="form-error" role="alert">
          This password reset link is invalid or expired. Request a new
          one from the sign-in page.
        </p>
        <p className="auth-foot">
          <Link href="/login">← Back to sign in</Link>
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="auth-wrap">
        <h1>Set a new password</h1>
        <p className="auth-intro">Checking your reset link…</p>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <h1>Set a new password</h1>
      <p className="auth-intro">
        Choose a new password for your account. You will sign in with it
        next time.
      </p>
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="field">
          <span>New password</span>
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
        <label className="field">
          <span>Confirm new password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
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
        {done ? (
          <p className="form-note" role="status">
            Password set — taking you to sign in…
          </p>
        ) : null}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Please wait…" : "Set new password"}
        </button>
      </form>
      <p className="auth-foot">
        <Link href="/login">← Back to sign in</Link>
      </p>
    </div>
  );
}
