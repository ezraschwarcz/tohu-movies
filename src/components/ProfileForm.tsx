"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  isPasskeyDisabledError,
  PASSKEY_DISABLED_MESSAGE,
} from "@/lib/passkeyError";
import { computeProfileCompletion } from "@/lib/profile";
import { AVATAR_PRESETS, avatarPresetById } from "@/lib/avatars";
import Avatar from "./Avatar";
import { useAuth } from "./AuthProvider";
import { useSiteSearch } from "./SiteProvider";

/** Profile: display name, email, preferences, your activity, passkeys,
 *  and sign out. Ratings are anonymous per browser (voter id in
 *  localStorage), so "films you rated" means films rated on this device.
 *
 *  The display name saves to profiles.display_name. The update policy
 *  lets a user update only their own row, and is_admin can never be
 *  changed this way (the policy's WITH CHECK blocks self-promotion).
 *  The "Hide R rated films" toggle is a per-browser preference in
 *  localStorage, shared with the home grid through the site context. */

const VOTER_KEY = "tohu-voter-id-v1";

type RatedFilm = {
  film_slug: string;
  stars: number;
  title: string;
};

type PasskeyItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

/** Menu icons for the profile hub, in the Facebook menu style: a
 *  simple stroke glyph inside a soft circle. */
const MENU_ICONS: Record<string, React.ReactNode> = {
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  list: (
    <>
      <path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20" />
      <circle cx="5" cy="6.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  star: (
    <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.6 20.4c.8-3.7 3.8-5.4 7.4-5.4s6.6 1.7 7.4 5.4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.5" r="4.5" />
      <path d="M11.4 12.1L20 3.5M16.6 6.9l3 3" />
    </>
  ),
  camera: (
    <>
      <path d="M8.6 8.4 10.2 5.6h3.6L15.4 8.4" />
      <rect x="3" y="8.4" width="18" height="11.2" rx="1.8" />
      <circle cx="12" cy="14" r="3.3" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 8h8.5M18 8h2M4 16h2.5M12 16h8" />
      <circle cx="15.2" cy="8" r="2.2" />
      <circle cx="9.2" cy="16" r="2.2" />
    </>
  ),
  shield: (
    <path d="M12 3.5l7 2.6v5.4c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6.1z" />
  ),
  logout: (
    <>
      <path d="M9 20.5H6.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2H9" />
      <path d="M15.5 16.5L20.5 12l-5-4.5M20.5 12H9" />
    </>
  ),
};

function MenuIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {MENU_ICONS[name]}
    </svg>
  );
}

/** Center-crop an image file to a square and shrink it to a 256px
 *  JPEG for the avatars bucket: one small file per user, overwritten
 *  on every change. Runs entirely on the device; the original photo
 *  is never uploaded. */
async function fileToSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that photo.");
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, 256, 256);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("Could not process that photo.");
    return blob;
  } finally {
    bitmap.close();
  }
}

export default function ProfileForm({
  userId,
  email,
  displayName,
  watchlistCount,
  isAdmin,
  initialPasswordSet,
  initialGenres,
  allGenres,
  initialAvatarPreset,
  initialAvatarUrl,
}: {
  userId: string;
  email: string;
  displayName: string;
  watchlistCount: number;
  /** Admins reach /admin from here on mobile, where the header nav
   *  pills row is hidden behind the bottom tab bar. */
  isAdmin: boolean;
  /** password_set flag from auth user metadata (server read). */
  initialPasswordSet: boolean;
  /** favorite_genres from auth user metadata (server read). */
  initialGenres: string[];
  /** Every genre in the catalog, for the completion picker. */
  allGenres: string[];
  /** Avatar choice from auth user metadata (server read), if any.
   *  The profiles columns are the real home (Phase 5.2); the client
   *  load below reconciles the two on mount. */
  initialAvatarPreset?: string | null;
  initialAvatarUrl?: string | null;
}) {
  const { signOut, refreshProfile } = useAuth();
  const { hideRRated, setHideRRated } = useSiteSearch();
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [rated, setRated] = useState<RatedFilm[] | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyItem[] | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  // Profile completion state: the saved name (not the in-progress
  // input), the password flag, and the picked genres.
  const [savedName, setSavedName] = useState(displayName);
  const [passwordIsSet, setPasswordIsSet] = useState(initialPasswordSet);
  const [favGenres, setFavGenres] = useState<string[]>(initialGenres);
  const [genreBusy, setGenreBusy] = useState(false);
  const [genreSaved, setGenreSaved] = useState<string | null>(null);
  const [genreError, setGenreError] = useState<string | null>(null);
  // Profile photo (Phase 5.2): a preset id and/or an uploaded photo
  // URL. Lives on the profiles row once the Phase 5.2 SQL has run;
  // before that, choices are mirrored into auth user metadata so the
  // signed-in UI still reflects them (see persistAvatar).
  const [avatarPreset, setAvatarPreset] = useState<string | null>(
    initialAvatarPreset ?? null,
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialAvatarUrl ?? null,
  );
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarTouched = useRef(false);

  const avatarHint = avatarUrl
    ? "Uploaded photo"
    : avatarPreset
      ? (avatarPresetById(avatarPreset)?.label ?? "Preset avatar")
      : "Initials";

  // Load the saved avatar on mount: the profiles columns first
  // (tolerant — they exist only after the Phase 5.2 SQL), then the
  // auth metadata (a preset picked at sign-up, or a pre-SQL choice).
  // A metadata-only choice is synced into profiles best-effort, so
  // comments pick it up too once the columns exist.
  useEffect(() => {
    let cancelled = false;
    async function loadAvatar() {
      const supabase = getBrowserSupabase();
      let metaPreset: string | null = null;
      let metaUrl: string | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        const md = (data.user?.user_metadata ?? {}) as Record<
          string,
          unknown
        >;
        if (typeof md.avatar_preset === "string") {
          metaPreset = md.avatar_preset;
        }
        if (typeof md.avatar_url === "string") {
          metaUrl = md.avatar_url;
        }
      } catch {
        // ignore: metadata is only a fallback source
      }
      let profPreset: string | null = null;
      let profUrl: string | null = null;
      let columnsOk = false;
      try {
        const { data, error: err } = await supabase
          .from("profiles")
          .select("avatar_preset,avatar_url")
          .eq("id", userId)
          .maybeSingle();
        if (!err && data) {
          columnsOk = true;
          const row = data as {
            avatar_preset?: string | null;
            avatar_url?: string | null;
          };
          profPreset = row.avatar_preset ?? null;
          profUrl = row.avatar_url ?? null;
        }
      } catch {
        // Columns not there yet (pre-SQL): metadata only.
      }
      if (cancelled || avatarTouched.current) return;
      if (columnsOk && (profPreset || profUrl)) {
        setAvatarPreset(profPreset);
        setAvatarUrl(profUrl);
        return;
      }
      if (metaPreset || metaUrl) {
        setAvatarPreset(metaPreset);
        setAvatarUrl(metaUrl);
        if (columnsOk) {
          // Best-effort sync into profiles so other people see this
          // avatar on comments; failure here is not worth surfacing.
          try {
            await supabase
              .from("profiles")
              .update({ avatar_preset: metaPreset, avatar_url: metaUrl })
              .eq("id", userId);
            void refreshProfile();
          } catch {
            // ignore
          }
        }
      }
    }
    void loadAvatar();
    return () => {
      cancelled = true;
    };
    // refreshProfile is stable; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /** Save an avatar choice. Profiles first; if that write fails
   *  (the Phase 5.2 columns do not exist yet), mirror the choice into
   *  auth user metadata so it is not lost, and flag the fallback so
   *  the caller can word its status line honestly. */
  async function persistAvatar(
    nextPreset: string | null,
    nextUrl: string | null,
  ): Promise<{ error: string | null; fallback: boolean }> {
    const supabase = getBrowserSupabase();
    const { error: err } = await supabase
      .from("profiles")
      .update({ avatar_preset: nextPreset, avatar_url: nextUrl })
      .eq("id", userId);
    let fallback = false;
    if (err) {
      const { error: metaErr } = await supabase.auth.updateUser({
        data: { avatar_preset: nextPreset, avatar_url: nextUrl },
      });
      if (metaErr) return { error: metaErr.message, fallback: false };
      fallback = true;
    }
    avatarTouched.current = true;
    setAvatarPreset(nextPreset);
    setAvatarUrl(nextUrl);
    await refreshProfile();
    return { error: null, fallback };
  }

  const AVATAR_FALLBACK_NOTE =
    "Saved. It will appear on your comments once the latest site update is finished.";

  async function onChoosePreset(id: string) {
    setAvatarBusy(true);
    setAvatarError(null);
    setAvatarSaved(null);
    const { error: err, fallback } = await persistAvatar(id, null);
    setAvatarBusy(false);
    if (err) {
      setAvatarError(err);
    } else {
      setAvatarSaved(fallback ? AVATAR_FALLBACK_NOTE : "Profile photo saved.");
    }
  }

  async function onRemoveAvatar() {
    setAvatarBusy(true);
    setAvatarError(null);
    setAvatarSaved(null);
    const { error: err, fallback } = await persistAvatar(null, null);
    setAvatarBusy(false);
    if (err) {
      setAvatarError(err);
    } else {
      setAvatarSaved(
        fallback
          ? AVATAR_FALLBACK_NOTE
          : "Profile photo removed. Your initials will show.",
      );
    }
  }

  async function onAvatarFile(file: File) {
    setAvatarBusy(true);
    setAvatarError(null);
    setAvatarSaved(null);
    try {
      const blob = await fileToSquareJpeg(file);
      const supabase = getBrowserSupabase();
      const path = `${userId}/avatar.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadErr) {
        if (/bucket|not found/i.test(uploadErr.message)) {
          throw new Error(
            "Photo upload needs the Phase 5.2 database update — presets still work.",
          );
        }
        throw new Error(uploadErr.message);
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // The cache-buster makes the new photo show at once: the URL is
      // stable per user, so browsers would otherwise keep the old one.
      const url = `${data.publicUrl}?v=${Date.now()}`;
      const { error: saveErr, fallback } = await persistAvatar(null, url);
      if (saveErr) {
        throw new Error(saveErr);
      }
      setAvatarSaved(fallback ? AVATAR_FALLBACK_NOTE : "Photo uploaded.");
    } catch (err) {
      setAvatarError(
        err instanceof Error ? err.message : "Could not upload that photo.",
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  const completion = computeProfileCompletion({
    displayName: savedName,
    passwordSet: passwordIsSet,
    favoriteGenres: favGenres,
  });
  const hasPasskey = passkeys !== null && passkeys.length > 0;

  // Facebook-style navigation: the profile opens as a menu, and
  // each row drills into its own screen with a back button, instead
  // of one long scrolling page.
  type ProfileView =
    | "menu"
    | "complete"
    | "name"
    | "avatar"
    | "security"
    | "activity"
    | "preferences"
    | "admin";
  const [view, setView] = useState<ProfileView>("menu");

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  // Deep links from the header account menu: /profile?view=security
  // opens that section directly. Read once on mount (the component
  // remounts per navigation); admin only opens for admins.
  useEffect(() => {
    try {
      const requested = new URLSearchParams(window.location.search).get(
        "view",
      );
      const valid: ProfileView[] = [
        "menu",
        "complete",
        "name",
        "avatar",
        "security",
        "activity",
        "preferences",
        "admin",
      ];
      if (
        requested &&
        (valid as string[]).includes(requested) &&
        (requested !== "admin" || isAdmin)
      ) {
        setView(requested as ProfileView);
      }
    } catch {
      // ignore: no deep link
    }
  }, [isAdmin]);

  const viewTitles: Record<Exclude<ProfileView, "menu">, string> = {
    complete: "Complete your profile",
    name: "Name and email",
    avatar: "Profile photo",
    security: "Sign-in & Security",
    activity: "Your activity",
    preferences: "Preferences",
    admin: "Admin",
  };

  function toggleGenre(genre: string) {
    setGenreSaved(null);
    setGenreError(null);
    setFavGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((g) => g !== genre);
      if (prev.length >= 3) return prev;
      return [...prev, genre];
    });
  }

  async function onSaveGenres() {
    setGenreBusy(true);
    setGenreError(null);
    setGenreSaved(null);
    const supabase = getBrowserSupabase();
    const { error: err } = await supabase.auth.updateUser({
      data: { favorite_genres: favGenres },
    });
    setGenreBusy(false);
    if (err) {
      setGenreError(err.message);
      return;
    }
    setGenreSaved("Favorite genres saved.");
  }

  // Films rated on this device (anonymous voter id in localStorage).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let voterId: string | null = null;
      try {
        voterId = window.localStorage.getItem(VOTER_KEY);
      } catch {
        // ignore
      }
      if (!voterId) {
        if (!cancelled) setRated([]);
        return;
      }
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from("ratings")
        .select("film_slug,stars,films(title)")
        .eq("voter_id", voterId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const rows = (data ?? []) as unknown as {
        film_slug: string;
        stars: number;
        films: { title: string } | { title: string }[] | null;
      }[];
      setRated(
        rows.map((r) => {
          const film = Array.isArray(r.films) ? r.films[0] : r.films;
          return {
            film_slug: r.film_slug,
            stars: r.stars,
            title: film?.title ?? r.film_slug,
          };
        }),
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Registered passkeys for this account.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = getBrowserSupabase();
      const { data, error: err } = await supabase.auth.passkey.list();
      if (cancelled) return;
      if (err) {
        setPasskeyError("Could not load your passkeys.");
        setPasskeys([]);
        return;
      }
      setPasskeys(data ?? []);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSaveName(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a display name.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    const supabase = getBrowserSupabase();
    const { error: err } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", userId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshProfile();
    setSavedName(trimmed);
    setSaved("Display name saved.");
  }

  async function onAddPasskey() {
    setPasskeyBusy(true);
    setPasskeyError(null);
    setPasskeyMessage(null);
    const supabase = getBrowserSupabase();
    try {
      const { error: err } = await supabase.auth.registerPasskey();
      if (err) throw err;
      setPasskeyMessage("Passkey added.");
      const { data } = await supabase.auth.passkey.list();
      setPasskeys(data ?? []);
    } catch (err) {
      if (isPasskeyDisabledError(err)) {
        setPasskeyError(PASSKEY_DISABLED_MESSAGE);
      } else {
        const text = err instanceof Error ? err.message : "";
        setPasskeyError(
          text || "Could not add a passkey. Try again.",
        );
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  /** Set (or change) a password while signed in. This is how a
   *  magic-link-only account gets a password: updateUser adds one to
   *  the account, and the visitor can sign in with it next time. */
  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError("Your password needs at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The two passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordSaved(null);
    const supabase = getBrowserSupabase();
    const { error: err } = await supabase.auth.updateUser({
      password: newPassword,
      data: { password_set: true },
    });
    setPasswordBusy(false);
    if (err) {
      setPasswordError(err.message);
      return;
    }
    setPasswordIsSet(true);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(
      "Password set. You can sign in with it next time.",
    );
  }

  async function onRemovePasskey(id: string, label: string) {
    if (
      !window.confirm(`Remove the passkey “${label}”? You can add a new one any time.`)
    ) {
      return;
    }
    setPasskeyError(null);
    setPasskeyMessage(null);
    const supabase = getBrowserSupabase();
    const { error: err } = await supabase.auth.passkey.delete({
      passkeyId: id,
    });
    if (err) {
      setPasskeyError(err.message);
      return;
    }
    setPasskeys((list) => (list ?? []).filter((p) => p.id !== id));
    setPasskeyMessage("Passkey removed.");
  }

  return (
    <div className="auth-wrap profile-hub">
      {view === "menu" ? (
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
                Complete your profile
                <span className="menu-hint">
                  {completion.complete
                    ? "All set"
                    : "Name, password, and favorite genres"}
                </span>
              </span>
              {completion.complete ? (
                <span className="menu-badge-done" aria-label="Complete">
                  ✓
                </span>
              ) : (
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
      ) : (
        <>
          <button
            type="button"
            className="profile-back"
            onClick={() => setView("menu")}
          >
            <span aria-hidden="true">‹</span> Profile
          </button>
          <h1 className="profile-view-title">{viewTitles[view]}</h1>
          <div className="profile-card">
      {view === "complete" ? (
      <section aria-label="Complete your profile" id="complete">
        <h2 className="profile-h2">Complete your profile</h2>
        {completion.complete ? (
          <p className="form-note" role="status">
            Profile complete. Your name, password, and favorite genres
            are all set. You can change your genres any time below.
          </p>
        ) : (
          <>
            <div
              className="wizard-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion.percent}
              aria-label="Profile completion"
            >
              <span style={{ width: `${completion.percent}%` }} />
            </div>
            <p className="profile-line">
              {completion.percent}% complete. Three quick steps:
            </p>
            <ul className="wizard-steps">
              <li>
                <span aria-hidden="true">
                  {completion.hasName ? "✓" : "○"}
                </span>{" "}
                Display name{" "}
                {completion.hasName ? (
                  <span className="toggle-hint">Done</span>
                ) : (
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => setView("name")}
                  >
                    Add yours
                  </button>
                )}
              </li>
              <li>
                <span aria-hidden="true">
                  {completion.hasPassword ? "✓" : "○"}
                </span>{" "}
                Password{" "}
                {completion.hasPassword ? (
                  <span className="toggle-hint">Done</span>
                ) : (
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => setView("security")}
                  >
                    Set one in Sign-in &amp; Security
                  </button>
                )}
              </li>
              <li>
                <span aria-hidden="true">
                  {completion.genres.length > 0 ? "✓" : "○"}
                </span>{" "}
                Favorite genres (pick up to 3)
              </li>
              <li>
                <span aria-hidden="true">{hasPasskey ? "✓" : "○"}</span>{" "}
                Passkey{" "}
                <span className="toggle-hint">
                  Optional bonus, never required.{" "}
                  {hasPasskey ? "Added." : ""}
                </span>
                {hasPasskey ? null : (
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => setView("security")}
                  >
                    Add one in Sign-in &amp; Security
                  </button>
                )}
              </li>
            </ul>
          </>
        )}
        <div>
            <div
              className="chips"
              role="group"
              aria-label="Pick up to 3 favorite genres"
            >
              {allGenres.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="chip"
                  aria-pressed={favGenres.includes(g)}
                  onClick={() => toggleGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            {genreError ? (
              <p className="form-error" role="alert">
                {genreError}
              </p>
            ) : null}
            {genreSaved ? (
              <p className="form-note" role="status">
                {genreSaved}
              </p>
            ) : null}
            <button
              type="button"
              className="btn-primary"
              onClick={() => void onSaveGenres()}
              disabled={genreBusy}
            >
              {genreBusy ? "Saving…" : "Save favorite genres"}
            </button>
        </div>
      </section>

      ) : null}

      {view === "name" ? (
      <section aria-label="Name and email" id="name">
        <h2 className="profile-h2">Name and email</h2>
        <form className="auth-form" onSubmit={onSaveName}>
          <label className="field">
            <span>Display name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="The name shown on your comments"
              maxLength={60}
              required
              autoComplete="nickname"
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} disabled readOnly />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="form-note" role="status">
              {saved}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save display name"}
          </button>
        </form>
      </section>

      ) : null}

      {view === "avatar" ? (
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
        <label className="field">
          <span>Photo file (cropped square, shrunk to 256px)</span>
          <input
            type="file"
            accept="image/*"
            disabled={avatarBusy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onAvatarFile(file);
            }}
          />
        </label>

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

      ) : null}

      {view === "security" ? (
      <section aria-label="Sign-in and security" id="security">
        <h2 className="profile-h2">Sign-in &amp; Security</h2>
        <h3 className="profile-h3">Set a password</h3>
        <p className="profile-line">
          If you signed up with an email link, you have no password yet.
          Set one here to sign in with a password as well.
        </p>
        <form className="auth-form" onSubmit={onSetPassword}>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Type it again"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          {passwordError ? (
            <p className="form-error" role="alert">
              {passwordError}
            </p>
          ) : null}
          {passwordSaved ? (
            <p className="form-note" role="status">
              {passwordSaved}
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={passwordBusy}>
            {passwordBusy ? "Saving…" : "Set password"}
          </button>
        </form>
      </section>

      ) : null}

      {view === "admin" && isAdmin ? (
        <section aria-label="Admin" id="admin">
          <h2 className="profile-h2">Admin</h2>
          <p className="profile-line">
            <Link href="/admin">Open the admin panel</Link> to moderate
            comments and add films.
          </p>
        </section>
      ) : null}

      {view === "preferences" ? (
      <section aria-label="Preferences" id="preferences">
        <h2 className="profile-h2">Preferences</h2>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={hideRRated}
            onChange={(e) => setHideRRated(e.target.checked)}
          />
          <span>
            Hide R rated films
            <span className="toggle-hint">
              R rated films will not appear in the film rows or the
              Browse all films grid on this device.
            </span>
          </span>
        </label>
      </section>

      ) : null}

      {view === "activity" ? (
      <section aria-label="Your activity" id="activity">
        <h2 className="profile-h2">Your activity</h2>
        <h3 className="profile-h3">Films you rated on this device</h3>
        {rated === null ? (
          <p className="profile-line">Loading your ratings…</p>
        ) : rated.length === 0 ? (
          <p className="profile-line">
            You have not rated any films yet on this device. Tap the stars
            on any film to rate it.
          </p>
        ) : (
          <ul className="profile-list">
            {rated.map((r) => (
              <li key={r.film_slug} className="profile-row">
                <Link href={`/films/${r.film_slug}`}>{r.title}</Link>
                <span
                  className="profile-stars"
                  aria-label={`${r.stars} out of 5 stars`}
                >
                  {"★".repeat(r.stars)}
                  {"☆".repeat(5 - r.stars)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      ) : null}

      {view === "security" ? (
      <section aria-label="Passkeys" id="passkeys">
        <h2 className="profile-h2">Passkeys</h2>
        <p className="profile-line">
          Passkeys let you sign in with Face ID, fingerprint, or your
          device PIN instead of a password.
        </p>
        {passkeyError ? (
          <p className="form-error" role="alert">
            {passkeyError}
          </p>
        ) : null}
        {passkeyMessage ? (
          <p className="form-note" role="status">
            {passkeyMessage}
          </p>
        ) : null}
        {passkeys === null ? (
          <p className="profile-line">Loading your passkeys…</p>
        ) : passkeys.length === 0 ? (
          <p className="profile-line">No passkeys yet.</p>
        ) : (
          <ul className="profile-list">
            {passkeys.map((p) => (
              <li key={p.id} className="profile-row">
                <span>
                  {p.friendly_name || "Passkey"}
                  <span className="toggle-hint">
                    Added{" "}
                    {new Date(p.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {p.last_used_at
                      ? ` · Last used ${new Date(p.last_used_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`
                      : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn-ghost danger"
                  onClick={() =>
                    void onRemovePasskey(p.id, p.friendly_name || "Passkey")
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn-passkey"
          onClick={() => void onAddPasskey()}
          disabled={passkeyBusy}
        >
          {passkeyBusy ? "Waiting for your device…" : "Add a passkey"}
        </button>
      </section>

      ) : null}
          </div>
        </>
      )}
    </div>
  );
}
