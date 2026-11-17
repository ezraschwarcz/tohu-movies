"use client";

import PhotoPicker from "../PhotoPicker";
import Avatar from "../Avatar";
import { AVATAR_PRESETS } from "@/lib/avatars";
import type { ProfileSettings } from "./useProfileSettings";

export default function AvatarView({ s }: { s: ProfileSettings }) {
  const {
    avatarBusy,
    avatarError,
    avatarHint,
    avatarPreset,
    avatarSaved,
    avatarUrl,
    email,
    onAvatarCropped,
    onChoosePreset,
    onRemoveAvatar,
    savedName,
  } = s;
  return (
    <>
      <section aria-label="Profile photo" id="avatar">
        <h2 className="profile-h2">Profile photo</h2>
        <div className="avatar-preview">
          <Avatar
            preset={avatarPreset}
            url={avatarUrl}
            name={savedName || email}
            size={72}
          />
          <div>
            <p className="profile-line">
              <strong>{savedName || "Your profile"}</strong>
            </p>
            <p className="profile-line">
              Currently showing: {avatarHint.toLowerCase()}. Your photo
              appears next to your comments and in the corner of the
              header.
            </p>
          </div>
        </div>

        <h3 className="profile-h3">Choose an avatar</h3>
        <div
          className="avatar-grid"
          role="group"
          aria-label="Choose an avatar"
        >
          {AVATAR_PRESETS.map((p) => {
            const selected = avatarPreset === p.id && !avatarUrl;
            return (
              <button
                key={p.id}
                type="button"
                className={`avatar-choice${selected ? " selected" : ""}`}
                onClick={() => void onChoosePreset(p.id)}
                aria-pressed={selected}
                disabled={avatarBusy}
              >
                <Avatar preset={p.id} size={44} />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        <h3 className="profile-h3">Or upload your own photo</h3>
        <p className="form-note">
          Choose a photo, then drag and zoom to frame it.
        </p>
        <PhotoPicker busy={avatarBusy} onPhoto={onAvatarCropped} />

        {avatarError ? (
          <p className="form-error" role="alert">
            {avatarError}
          </p>
        ) : null}
        {avatarSaved ? (
          <p className="form-note" role="status">
            {avatarSaved}
          </p>
        ) : null}

        {avatarUrl || avatarPreset ? (
          <button
            type="button"
            className="btn-ghost danger"
            onClick={() => void onRemoveAvatar()}
            disabled={avatarBusy}
          >
            Remove photo
          </button>
        ) : null}
      </section>

    </>
  );
}
