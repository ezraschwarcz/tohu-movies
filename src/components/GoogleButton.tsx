"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Google's own sign-in button, run from tohumovies.com.
 *
 *  With the ordinary redirect, Google's screen says "Sign in to
 *  <project>.supabase.co", because that is where Google sends the
 *  visitor back to. Here Google instead hands this page a signed proof
 *  of who the visitor is, and the page passes it to the database. The
 *  visitor never leaves tohumovies.com, and Google's window names
 *  Tohu Movies.
 *
 *  Needs the Google client ID in NEXT_PUBLIC_GOOGLE_CLIENT_ID (it is
 *  public, not a secret) and https://www.tohumovies.com listed under
 *  "Authorized JavaScript origins" for that client in Google Cloud. */

type GoogleId = {
  initialize: (options: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.getElementById("google-gsi") as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("blocked")));
    if (!existing) {
      script.id = "google-gsi";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export default function GoogleButton({
  onStart,
  onSignedIn,
  onError,
  onUnavailable,
}: {
  onStart: () => void;
  onSignedIn: (user: User | null) => void;
  onError: (message: string) => void;
  /** Google's script could not load (blocked): fall back to the redirect. */
  onUnavailable: () => void;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const handlers = useRef({ onStart, onSignedIn, onError, onUnavailable });
  useEffect(() => {
    handlers.current = { onStart, onSignedIn, onError, onUnavailable };
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadScript();
        const id = window.google?.accounts?.id;
        if (cancelled || !id || !holder.current) return;
        const nonce = crypto.randomUUID() + crypto.randomUUID();
        id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: await sha256Hex(nonce),
          use_fedcm_for_prompt: true,
          callback: async (response: { credential?: string }) => {
            if (!response.credential) return;
            handlers.current.onStart();
            setBusy(true);
            const { data, error } = await getBrowserSupabase().auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce,
            });
            if (error || !data.session) {
              setBusy(false);
              handlers.current.onError(
                "Google sign-in did not finish. Try again, or continue with your email.",
              );
              return;
            }
            handlers.current.onSignedIn(data.user);
          },
        });
        const width = Math.min(400, Math.max(220, holder.current.clientWidth));
        id.renderButton(holder.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          width,
        });
      } catch {
        if (!cancelled) handlers.current.onUnavailable();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="google-holder" aria-busy={busy}>
      <div ref={holder} />
      {busy ? <p className="form-note">Signing you in…</p> : null}
    </div>
  );
}
