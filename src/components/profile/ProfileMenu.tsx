"use client";

import Link from "next/link";
import Avatar from "../Avatar";
import { MenuIcon } from "./MenuIcon";
import type { ProfileSettings } from "./useProfileSettings";

export default function ProfileMenu({ s }: { s: ProfileSettings }) {
  const {
    avatarHint,
    avatarPreset,
    avatarUrl,
    completion,
    email,
    isAdmin,
    savedName,
    setView,
    signOut,
    watchlistCount,
  } = s;
  return (
    <>
        <>
          <div className="profile-id-card">
            <Avatar
              preset={avatarPreset}
              url={avatarUrl}
              name={savedName || email}
              size={56}
            />
            <span className="profile-id-text">
              <span className="profile-id-name">
                {savedName || "Your profile"}
              </span>
              <span className="profile-id-email">{email}</span>
            </span>
          </div>

          <div className="menu-group" role="list">
            <Link className="menu-row" href="/watchlist" role="listitem">
              <span className="menu-icon">
                <MenuIcon name="play" />
              </span>
              <span className="menu-label">
                Continue watching
                <span className="menu-hint">
                  Pick up where you left off
                </span>
              </span>
              <span className="menu-chev" aria-hidden="true">
                ›
              </span>
            </Link>
            <Link className="menu-row" href="/watchlist" role="listitem">
              <span className="menu-icon">
                <MenuIcon name="list" />
              </span>
              <span className="menu-label">
                My watchlist
                <span className="menu-hint">
                  {watchlistCount} film{watchlistCount === 1 ? "" : "s"}{" "}
                  saved
                </span>
              </span>
              <span className="menu-chev" aria-hidden="true">
                ›
              </span>
            </Link>
            <button
              type="button"
              className="menu-row"
              onClick={() => setView("activity")}
            >
              <span className="menu-icon">
                <MenuIcon name="star" />
              </span>
              <span className="menu-label">
                Your activity
                <span className="menu-hint">
                  Films you rated on this device
                </span>
              </span>
              <span className="menu-chev" aria-hidden="true">
                ›
              </span>
            </button>
          </div>

          <div className="menu-group" role="list">
            <button
              type="button"
              className="menu-row"
              onClick={() => setView("complete")}
            >
              <span className="menu-icon">
                <MenuIcon name="target" />
              </span>
              <span className="menu-label">
                {completion.complete ? "Favorite genres" : "Finish your profile"}
                <span className="menu-hint">
                  {completion.complete
                    ? completion.genres.join(", ")
                    : "A display name and your favorite genres"}
                </span>
              </span>
              {completion.complete ? null : (
                <span className="menu-badge">{completion.percent}%</span>
              )}
              <span className="menu-chev" aria-hidden="true">
                ›
              </span>
            </button>
            <button
              type="button"
              className="menu-row"
              onClick={() => setView("name")}
            >
              <span className="menu-icon">
                <MenuIcon name="user" />
              </span>
              <span className="menu-label">Name and email</span>
              <span className="menu-chev" aria-hidden="true">
                ›
              </span>
            </button>
            <button
              type="button"
              className="menu-row"
              onClick={() => setView("avatar")}
            >
              <span className="menu-icon">
                <MenuIcon name="camera" />
              </span>
              <span className="menu-label">
                Profile photo
                <span className="menu-hint">{avatarHint}</span>
              </span>
              <span className="menu-chev" aria-hidden="true">
                ›
              </span>
            </button>
            <button
              type="button"
              className="menu-row"
              onClick={() => setView("security")}
            >
              <span className="menu-icon">
                <MenuIcon name="key" />
              </span>
              <span className="menu-label">
                Sign-in &amp; Security
                <span className="menu-hint">Password and passkeys</span>
              </span>
              <span className="menu-chev" aria-hidden="true">
                ›
              </span>
            </button>
            <button
              type="button"
              className="menu-row"
              onClick={() => setView("preferences")}
            >
              <span className="menu-icon">
                <MenuIcon name="sliders" />
              </span>
              <span className="menu-label">Preferences</span>
              <span className="menu-chev" aria-hidden="true">
                ›
              </span>
            </button>
            {isAdmin ? (
              <button
                type="button"
                className="menu-row"
                onClick={() => setView("admin")}
              >
                <span className="menu-icon">
                  <MenuIcon name="shield" />
                </span>
                <span className="menu-label">Admin</span>
                <span className="menu-chev" aria-hidden="true">
                  ›
                </span>
              </button>
            ) : null}
          </div>

          <div className="menu-group" role="list">
            <button
              type="button"
              className="menu-row"
              onClick={() => void signOut()}
            >
              <span className="menu-icon">
                <MenuIcon name="logout" />
              </span>
              <span className="menu-label">Sign out</span>
            </button>
          </div>

          <p className="auth-foot">
            <Link href="/">← Back to films</Link>
          </p>
        </>
    </>
  );
}
