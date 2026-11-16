"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  isPasskeyDisabledError,
  PASSKEY_DISABLED_MESSAGE,
} from "@/lib/passkeyError";
import {
  LAST_EMAIL_KEY,
  needsWelcome,
  placeholderName,
  safeNext,
} from "@/lib/onboarding";
import { firstTouch } from "@/lib/attribution";

/** One door for signing in and signing up.
 *
 *  Email first: the visitor types an email and gets a message with a
 *  sign-in link and a short code. Either one signs them in, and creates
 *  the account if it is new, so nobody has to know in advance whether
 *  they "have an account", choose a password, or own a passkey. A new
 *  member then lands on /welcome to pick a name and photo and to turn
 *  on Face ID / fingerprint for next time.
 *
 *  The code matters: a link only works in the browser that asked for
 *  it, and mail apps often open links somewhere else. The code works
 *  anywhere.
 *
 *  Returning members can still use a passkey or a password; both sit
 *  below the email step as secondary choices. */

type Step = "email" | "code" | "password" | "forgot";

const RESEND_SECONDS = 30;

function friendly(err: unknown, fallback: string): string {
  const text = err instanceof Error ? err.message : "";
  if (/rate limit|too many|security purposes/i.test(text)) {
    return "Too many emails were requested just now. Wait a minute and try again.";
  }
  if (/expired|invalid.*(token|otp)|otp.*(expired|invalid)/i.test(text)) {
    return "That code is wrong or has expired. Check it, or send a new one.";
  }
  if (/invalid login credentials/i.test(text)) {
    return "That email and password do not match. Try again, or use an email code instead.";
  }
  if (/signups? not allowed|not allowed for otp/i.test(text)) {
    return "New accounts cannot be created right now. Please try again later.";
  }
  return text || fallback;
}

export default function AuthFlow({
  mode,
  next,
  urlError,
  urlMessage,
}: {
  mode: "signin" | "signup";
  next: string;
  urlError: string | null;
  urlMessage: string | null;
}) {
  const router = useRouter();
  const dest = safeNext(next);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [message, setMessage] = useState<string | null>(
    urlMessage === "password-reset"
      ? "Your password has been set. Sign in with your new password."
      : null,
  );
  const [error, setError] = useState<string | null>(
    urlError === "signin-link"
      ? "That sign-in link has expired, or it opened in a different browser than the one you asked from. Enter your email for a new one and use the code in the email instead."
      : urlError
        ? decodeURIComponent(urlError)
        : null,
  );
  const finished = useRef(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      // ignore
    }
    setPasskeySupported(typeof window.PublicKeyCredential !== "undefined");
    if (urlMessage === "password-reset") setStep("password");
  }, [urlMessage]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  function finish(user: User | null | undefined) {
    if (finished.current) return;
    finished.current = true;
    try {
      if (user?.email) window.localStorage.setItem(LAST_EMAIL_KEY, user.email);
    } catch {
      // ignore
    }
    const go =
      user && needsWelcome(user) && !dest.startsWith("/auth/")
        ? `/welcome?next=${encodeURIComponent(dest)}`
        : dest;
    router.push(go);
    router.refresh();
  }

  // While the visitor is on the code step, they may tap the link in the
  // email instead. If it opens in this browser, this tab notices the new
  // session and moves on by itself.
  useEffect(() => {
    if (step !== "code") return;
    const supabase = getBrowserSupabase();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) finish(session.user);
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: err } = await getBrowserSupabase().auth.signInWithOtp({
        email: address,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}`,
          // Used only when this creates a new account.
          data: {
            display_name: placeholderName(),
            signup_source: firstTouch(),
          },
        },
      });
      if (err) throw err;
      try {
        window.localStorage.setItem(LAST_EMAIL_KEY, address);
      } catch {
        // ignore
      }
      setCode("");
      setStep("code");
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(friendly(err, "Could not send the email. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Enter the code from the email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await getBrowserSupabase().auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (err) throw err;
      if (!data.session) throw new Error("That code did not sign you in. Send a new one.");
      finish(data.user);
    } catch (err) {
      setError(friendly(err, "That code did not work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function onPasskey() {
    setPasskeyBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: err } =
        await getBrowserSupabase().auth.signInWithPasskey();
      if (err) throw err;
      if (!data.session) throw new Error("Passkey sign-in did not finish.");
      finish(data.user);
    } catch (err) {
      const codeName = (err as { code?: string } | null)?.code;
      const text = err instanceof Error ? err.message : "";
      if (isPasskeyDisabledError(err)) {
        setError(PASSKEY_DISABLED_MESSAGE);
      } else if (
        codeName === "ERROR_CEREMONY_ABORTED" ||
        /cancel|abort|not allowed|timed out/i.test(text)
      ) {
        setError(
          "No passkey was used. If you have not set one up on this device yet, continue with your email above; you can turn on Face ID or fingerprint right after.",
        );
      } else {
        setError(
          "Passkey sign-in did not work. Continue with your email above instead.",
        );
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: err } =
        await getBrowserSupabase().auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      if (err) throw err;
      finish(data.user);
    } catch (err) {
      setError(friendly(err, "Could not sign in. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: err } =
        await getBrowserSupabase().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
        });
      if (err) throw err;
      setMessage(
        "Check your email. We sent a link that takes you to a page where you set a new password.",
      );
    } catch (err) {
      setError(friendly(err, "Could not send the email. Try again."));
    } finally {
      setBusy(false);
    }
  }

  function go(to: Step) {
    setStep(to);
    setError(null);
    setMessage(null);
  }

  const notes = (
    <>
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
    </>
  );

  const emailField = (
    <label className="field">
      <span>Email</span>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
      />
    </label>
  );

  return (
    <div className="auth-wrap">
      <h1>{mode === "signup" ? "Join free" : "Sign in or join"}</h1>

      {step === "email" ? (
        <>
          <p className="auth-intro">
            Watching is always free with no account. Add your email to
            comment, keep a watchlist, and pick up where you left off. No
            password needed.
          </p>
          <form className="auth-form" onSubmit={sendCode}>
            {emailField}
            {notes}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Sending…" : "Continue with email"}
            </button>
            <p className="auth-fine">
              We email you a sign-in link and code. New here? This creates
              your free account. By continuing you agree to the{" "}
              <Link href="/terms">Terms</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </form>

          <div className="auth-divider" role="separator">
            <span>already a member?</span>
          </div>
          <div className="auth-alt">
            {passkeySupported ? (
              <button
                type="button"
                className="btn-passkey"
                onClick={() => void onPasskey()}
                disabled={passkeyBusy}
              >
                {passkeyBusy
                  ? "Waiting for your device…"
                  : "Use Face ID, fingerprint or passkey"}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => go("password")}
            >
              Use a password
            </button>
          </div>
        </>
      ) : null}

      {step === "code" ? (
        <form className="auth-form" onSubmit={verifyCode}>
          <p className="auth-intro">
            We sent an email to <strong>{email.trim()}</strong>. Tap the
            link in it, or type the code from the email here.
          </p>
          <label className="field">
            <span>Code from the email</span>
            <input
              className="code-input"
              type="text"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </label>
          {notes}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
          <p className="auth-fine">
            Nothing after a minute? Check spam or promotions, then{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => void sendCode()}
              disabled={busy || resendIn > 0}
            >
              {resendIn > 0 ? `send again in ${resendIn}s` : "send it again"}
            </button>
            .
          </p>
          <button type="button" className="btn-ghost" onClick={() => go("email")}>
            Use a different email
          </button>
        </form>
      ) : null}

      {step === "password" ? (
        <form className="auth-form" onSubmit={onPassword}>
          {emailField}
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
          {notes}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Please wait…" : "Sign in"}
          </button>
          <p className="auth-foot">
            <button type="button" className="link-btn" onClick={() => go("forgot")}>
              Forgot password?
            </button>
          </p>
          <button type="button" className="btn-ghost" onClick={() => go("email")}>
            Use an email code instead
          </button>
        </form>
      ) : null}

      {step === "forgot" ? (
        <form className="auth-form" onSubmit={onForgot}>
          <p className="auth-intro">
            Enter your email and we will send you a link to set a new
            password.
          </p>
          {emailField}
          {notes}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Please wait…" : "Send reset link"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => go("password")}>
            Back
          </button>
        </form>
      ) : null}

      <p className="auth-foot">
        <Link href="/">← Back to films</Link>
      </p>
    </div>
  );
}
