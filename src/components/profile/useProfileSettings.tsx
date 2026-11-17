"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isPasskeyDisabledError, PASSKEY_DISABLED_MESSAGE } from "@/lib/passkeyError";
import { computeProfileCompletion } from "@/lib/profile";
import { avatarPresetById } from "@/lib/avatars";
import { uploadAvatarPhoto } from "@/lib/photo";
import { useAuth } from "../AuthProvider";
import { useSiteSearch } from "../SiteProvider";

/** Everything the profile screens share: what is saved, what is being
 *  typed, and the actions that save it. ProfileForm picks the screen;
 *  each screen lives in its own file in this folder. */

export const VOTER_KEY = "tohu-voter-id-v1";

export type RatedFilm = {
  film_slug: string;
  stars: number;
  title: string;
};

export type PasskeyItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

export type ProfileProps = {
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
};

export function useProfileSettings({
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
}: ProfileProps) {
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
  /** The photo being positioned in the cropper, or null. */
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
    // The profile header is drawn by the server: redraw it.
    router.refresh();
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

  /** Upload the square the member framed in the cropper. Throws on
   *  failure, so the photo control can show what went wrong. */
  async function onAvatarCropped(blob: Blob) {
    setAvatarBusy(true);
    setAvatarError(null);
    setAvatarSaved(null);
    try {
      const url = await uploadAvatarPhoto(getBrowserSupabase(), userId, blob);
      const { error: saveErr, fallback } = await persistAvatar(null, url);
      if (saveErr) throw new Error(saveErr);
      setAvatarSaved(fallback ? AVATAR_FALLBACK_NOTE : "Photo saved.");
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const [view, setViewState] = useState<ProfileView>("menu");
  /** Open a section and keep the address in step, so the buttons in
   *  the profile header (which are links) always land where they say. */
  const setView = useCallback((next: ProfileView) => {
    setViewState(next);
    try {
      window.history.replaceState(
        null,
        "",
        next === "menu" ? "/profile?tab=settings" : `/profile?view=${next}`,
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  // Links such as /profile?view=security (the account menu, emails,
  // the buttons in the profile header) open that section. Followed
  // every time the address changes, not only on first load.
  const [followedView, setFollowedView] = useState<string | null | undefined>(
    undefined,
  );
  if (requestedView !== followedView) {
    setFollowedView(requestedView);
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
      requestedView &&
      (valid as string[]).includes(requestedView) &&
      (requestedView !== "admin" || isAdmin)
    ) {
      setViewState(requestedView as ProfileView);
    } else if (!requestedView) {
      setViewState("menu");
    }
  }

  const viewTitles: Record<Exclude<ProfileView, "menu">, string> = {
    complete: completion.complete ? "Favorite genres" : "Finish your profile",
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
      // The my_film_ratings function returns only this device's own
      // ratings. If it is not there yet (privacy hardening SQL not
      // run), read the table directly, as before.
      let data: unknown[] | null = null;
      const viaFunction = await supabase.rpc("my_film_ratings", {
        p_voter: voterId,
      });
      if (!viaFunction.error && Array.isArray(viaFunction.data)) {
        data = (viaFunction.data as { film_slug: string; stars: number; title: string }[]).map(
          (r) => ({ film_slug: r.film_slug, stars: r.stars, films: { title: r.title } }),
        );
      } else {
        const direct = await supabase
          .from("ratings")
          .select("film_slug,stars,films(title)")
          .eq("voter_id", voterId)
          .order("created_at", { ascending: false });
        data = direct.data;
      }
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

  // Optional public bio. Loaded and saved forgivingly: before the
  // control-room database update has run there is no bio column, and
  // the display name must still save.
  const [bio, setBio] = useState("");
  const [bioReady, setBioReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: err } = await getBrowserSupabase()
        .from("profiles")
        .select("bio")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || err) return;
      setBio(((data as { bio?: string | null } | null)?.bio ?? "") as string);
      setBioReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
      .update(
        bioReady
          ? { display_name: trimmed, bio: bio.trim() || null }
          : { display_name: trimmed },
      )
      .eq("id", userId);
    setBusy(false);
    if (err) {
      setError(
        /row-level security|violates/i.test(err.message)
          ? "Your profile could not be saved. If this keeps happening, contact us."
          : err.message,
      );
      return;
    }
    await refreshProfile();
    setSavedName(trimmed);
    router.refresh();
    setSaved("Saved.");
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

  return {
    AVATAR_FALLBACK_NOTE,
    allGenres,
    avatarBusy,
    avatarError,
    avatarHint,
    avatarPreset,
    avatarSaved,
    avatarTouched,
    avatarUrl,
    bio,
    bioReady,
    busy,
    completion,
    confirmPassword,
    displayName,
    email,
    error,
    favGenres,
    followedView,
    genreBusy,
    genreError,
    genreSaved,
    hasPasskey,
    hideRRated,
    initialAvatarPreset,
    initialAvatarUrl,
    initialGenres,
    initialPasswordSet,
    isAdmin,
    name,
    newPassword,
    onAddPasskey,
    onAvatarCropped,
    onChoosePreset,
    onRemoveAvatar,
    onRemovePasskey,
    onSaveGenres,
    onSaveName,
    onSetPassword,
    passkeyBusy,
    passkeyError,
    passkeyMessage,
    passkeys,
    passwordBusy,
    passwordError,
    passwordIsSet,
    passwordSaved,
    persistAvatar,
    rated,
    refreshProfile,
    requestedView,
    router,
    saved,
    savedName,
    searchParams,
    setAvatarBusy,
    setAvatarError,
    setAvatarPreset,
    setAvatarSaved,
    setAvatarUrl,
    setBio,
    setBioReady,
    setBusy,
    setConfirmPassword,
    setError,
    setFavGenres,
    setFollowedView,
    setGenreBusy,
    setGenreError,
    setGenreSaved,
    setHideRRated,
    setName,
    setNewPassword,
    setPasskeyBusy,
    setPasskeyError,
    setPasskeyMessage,
    setPasskeys,
    setPasswordBusy,
    setPasswordError,
    setPasswordIsSet,
    setPasswordSaved,
    setRated,
    setSaved,
    setSavedName,
    setView,
    setViewState,
    signOut,
    toggleGenre,
    userId,
    view,
    viewTitles,
    watchlistCount,
  };
}

export type ProfileSettings = ReturnType<typeof useProfileSettings>;
