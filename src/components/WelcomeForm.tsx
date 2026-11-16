"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { AVATAR_PRESETS } from "@/lib/avatars";
import { uploadAvatarPhoto } from "@/lib/photo";
import { isPasskeyDisabledError } from "@/lib/passkeyError";
import { useAuth } from "./AuthProvider";
import Avatar from "./Avatar";
import PhotoPicker from "./PhotoPicker";

/** Finish-your-profile step shown once to a new member. Nothing here
 *  is required: "Skip for now" keeps the placeholder name and goes
 *  straight to the films. */
export default function WelcomeForm({
  userId,
  next,
  initialName,
}: {
  userId: string;
  next: string;
  initialName: string;
}) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(initialName);
  const [preset, setPreset] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [fridayPick, setFridayPick] = useState(false);
  const [newFilms, setNewFilms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyAdded, setPasskeyAdded] = useState(false);
  const [passkeyNote, setPasskeyNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPasskeySupported(typeof window.PublicKeyCredential !== "undefined");
  }, []);

  async function markDone(extra: Record<string, unknown> = {}) {
    try {
      await getBrowserSupabase().auth.updateUser({
        data: { onboarded: true, ...extra },
      });
    } catch {
      // Not worth blocking on: worst case the step is offered again.
    }
  }

  function leave() {
    router.push(next);
    router.refresh();
  }

  async function onPhoto(blob: Blob) {
    setPhotoBusy(true);
    try {
      const url = await uploadAvatarPhoto(getBrowserSupabase(), userId, blob);
      setPhotoUrl(url);
      setPreset(null);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onAddPasskey() {
    setPasskeyBusy(true);
    setPasskeyNote(null);
    try {
      const { error: err } = await getBrowserSupabase().auth.registerPasskey();
      if (err) throw err;
      setPasskeyAdded(true);
      setPasskeyNote("Done. Next time, sign in with Face ID or fingerprint.");
    } catch (err) {
      setPasskeyNote(
        isPasskeyDisabledError(err)
          ? "Passkeys are not switched on for this site yet. You can always sign in with an email code."
          : "That did not finish. You can add one later from your profile; an email code always works.",
      );
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pick a display name, or choose Skip for now.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    try {
      const fields = {
        display_name: trimmed,
        avatar_preset: photoUrl ? null : preset,
        avatar_url: photoUrl,
      };
      const updated = await supabase
        .from("profiles")
        .update(fields)
        .eq("id", userId)
        .select("id");
      if (updated.error) throw new Error(updated.error.message);
      if (!updated.data || updated.data.length === 0) {
        const created = await supabase
          .from("profiles")
          .insert({ id: userId, ...fields });
        if (created.error) throw new Error(created.error.message);
      }
      // Email choices. Forgiving: the row may not exist yet.
      const prefs = {
        friday_pick: fridayPick,
        new_films: newFilms,
        optin_asked_at: new Date().toISOString(),
      };
      const saved = await supabase
        .from("email_prefs")
        .update(prefs)
        .eq("user_id", userId)
        .select("user_id");
      if (!saved.error && (!saved.data || saved.data.length === 0)) {
        await supabase.from("email_prefs").insert({
          user_id: userId,
          replies: true,
          reminders: true,
          ...prefs,
        });
      }
      await markDone({ display_name: trimmed });
      await refreshProfile();
      leave();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save. Try again.",
      );
      setBusy(false);
    }
  }

  async function onSkip() {
    setBusy(true);
    await markDone();
    leave();
  }

  return (
    <div className="auth-wrap welcome-wrap">
      <h1>You&apos;re in</h1>
      <p className="auth-intro">
        Your free account is ready. Take a moment to make it yours, or skip
        this and start watching.
      </p>
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Display name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The name shown on your comments"
            maxLength={60}
            autoComplete="nickname"
            autoFocus
          />
        </label>

        <div className="field">
          <span>
            Profile picture <span className="toggle-hint">(optional)</span>
          </span>
          <div className="welcome-photo">
            <Avatar
              preset={photoUrl ? null : preset}
              url={photoUrl}
              name={name || "You"}
              size={72}
            />
            <PhotoPicker
              busy={busy || photoBusy}
              onPhoto={onPhoto}
              chooseLabel={photoUrl ? "Change photo" : "Upload a photo"}
            />
          </div>
          <div
            className="avatar-grid avatar-grid-signup"
            role="group"
            aria-label="Or pick an avatar"
          >
            {AVATAR_PRESETS.map((p) => {
              const selected = !photoUrl && preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`avatar-choice${selected ? " selected" : ""}`}
                  onClick={() => {
                    setPhotoUrl(null);
                    setPreset(selected ? null : p.id);
                  }}
                  aria-pressed={selected}
                >
                  <Avatar preset={p.id} size={40} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <fieldset className="optin">
          <legend>Emails from Tohu (optional)</legend>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={fridayPick}
              onChange={(e) => setFridayPick(e.target.checked)}
            />
            <span>
              The Friday Pick
              <span className="toggle-hint">
                One handpicked film every Friday.
              </span>
            </span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={newFilms}
              onChange={(e) => setNewFilms(e.target.checked)}
            />
            <span>
              New film alerts
              <span className="toggle-hint">A note when films are added.</span>
            </span>
          </label>
        </fieldset>

        {passkeySupported ? (
          <div className="welcome-passkey">
            <p className="welcome-passkey-title">Skip the email next time</p>
            <p className="toggle-hint">
              Turn on Face ID, fingerprint or your device PIN for one-tap
              sign-in on this device.
            </p>
            {!passkeyAdded ? (
              <button
                type="button"
                className="btn-passkey"
                onClick={() => void onAddPasskey()}
                disabled={passkeyBusy}
              >
                {passkeyBusy ? "Waiting for your device…" : "Turn on one-tap sign-in"}
              </button>
            ) : null}
            {passkeyNote ? (
              <p className="form-note" role="status">
                {passkeyNote}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save and start watching"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void onSkip()}
          disabled={busy}
        >
          Skip for now
        </button>
      </form>
    </div>
  );
}
