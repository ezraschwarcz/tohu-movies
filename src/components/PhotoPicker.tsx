"use client";

import { useEffect, useRef, useState } from "react";
import AvatarCropper from "./AvatarCropper";
import { preparePhoto } from "@/lib/photo";

/** Choose (or, on a phone, take) a photo, then position and zoom it.
 *  The same control on desktop and mobile. `onPhoto` receives the
 *  finished 512px square; it should upload it and throw on failure. */
export default function PhotoPicker({
  busy,
  onPhoto,
  chooseLabel = "Choose a photo",
}: {
  busy: boolean;
  onPhoto: (blob: Blob) => Promise<void>;
  chooseLabel?: string;
}) {
  const chooseRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [touch, setTouch] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setTouch(window.matchMedia("(pointer: coarse)").matches);
    } catch {
      // older browsers: just show the one button
    }
  }, []);

  async function onPicked(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      // Read the photo before the field is cleared (see lib/photo.ts).
      setPhoto(await preparePhoto(file));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open that photo.",
      );
    } finally {
      setPreparing(false);
      input.value = "";
    }
  }

  async function onSave(blob: Blob) {
    setSaving(true);
    setError(null);
    try {
      await onPhoto(blob);
      setPhoto(null);
    } catch (err) {
      setPhoto(null);
      setError(
        err instanceof Error ? err.message : "Could not save that photo.",
      );
    } finally {
      setSaving(false);
    }
  }

  const disabled = busy || preparing || saving;

  return (
    <div className="photo-picker">
      <div className="photo-picker-buttons">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => chooseRef.current?.click()}
          disabled={disabled}
        >
          {preparing ? "Opening photo…" : chooseLabel}
        </button>
        {touch ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => cameraRef.current?.click()}
            disabled={disabled}
          >
            Take a photo
          </button>
        ) : null}
      </div>
      <input
        ref={chooseRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void onPicked(e.currentTarget)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void onPicked(e.currentTarget)}
      />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {photo ? (
        <AvatarCropper
          file={photo}
          busy={saving}
          onCancel={() => setPhoto(null)}
          onSave={(blob) => void onSave(blob)}
        />
      ) : null}
    </div>
  );
}
