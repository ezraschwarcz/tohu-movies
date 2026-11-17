"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { revalidateFilms } from "@/app/admin/actions";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { muxStillUrl } from "@/lib/films";
import { OFFICIAL_POSTERS } from "@/lib/posters";
import { RATINGS, SETUP_NOTE, slugify, day, call, settle, type AdminFilm, type Loaded } from "./shared";

type FilmDraft = {
  original: string | null;
  slug: string;
  slugTouched: boolean;
  title: string;
  year: string;
  genre: string;
  director: string;
  cast_text: string;
  rating: string;
  runtime_minutes: string;
  synopsis: string;
  warnings: string;
  playback_id: string;
  is_hidden: boolean;
  poster_url: string | null;
};

const EMPTY_DRAFT: FilmDraft = {
  original: null,
  slug: "",
  slugTouched: false,
  title: "",
  year: "",
  genre: "",
  director: "",
  cast_text: "",
  rating: "NR",
  runtime_minutes: "",
  synopsis: "",
  warnings: "",
  playback_id: "",
  is_hidden: false,
  poster_url: null,
};

function draftFrom(f: AdminFilm): FilmDraft {
  return {
    original: f.slug,
    slug: f.slug,
    slugTouched: true,
    title: f.title,
    year: String(f.year),
    genre: f.genre,
    director: f.director,
    cast_text: f.cast_text,
    rating: f.rating,
    runtime_minutes: String(f.runtime_minutes),
    synopsis: f.synopsis,
    warnings: f.warnings,
    playback_id: f.playback_id,
    is_hidden: f.is_hidden,
    poster_url: f.poster_url,
  };
}

/** Shrink a chosen cover image to a sensible size before upload. */
async function coverBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file could not be opened as an image."));
      el.src = url;
    });
    const scale = Math.min(1, 800 / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.9),
    );
    if (!blob) throw new Error("Could not process that image.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function FilmsTab() {
  const [films, setFilms] = useState<AdminFilm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<FilmDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [stillOk, setStillOk] = useState<boolean | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const show = useCallback((result: Loaded<AdminFilm[]>) => {
    if ("data" in result) {
      setFilms(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
  }, []);
  /** Reload the list after a change. */
  const load = useCallback(async () => show(await settle(call<AdminFilm[]>("admin_list_films"))), [show]);
  useEffect(() => {
    let cancelled = false;
    void settle(call<AdminFilm[]>("admin_list_films")).then((r) => !cancelled && show(r));
    return () => {
      cancelled = true;
    };
  }, [show]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const f of films ?? []) {
      for (const g of f.genre.split(",")) {
        const t = g.trim();
        if (t) set.add(t);
      }
    }
    return [...set].sort();
  }, [films]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (films ?? []).filter(
      (f) =>
        !q ||
        f.title.toLowerCase().includes(q) ||
        f.genre.toLowerCase().includes(q) ||
        f.director.toLowerCase().includes(q),
    );
  }, [films, query]);

  function open(next: FilmDraft) {
    setDraft(next);
    setFormError(null);
    setNote(null);
    setDeleteText("");
    setStillOk(null);
    window.setTimeout(
      () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }

  function set<K extends keyof FilmDraft>(key: K, value: FilmDraft[K]) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, [key]: value };
      if (key === "title" && !d.original && !d.slugTouched) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      const slug = await call<string>("admin_save_film", {
        p_original_slug: draft.original,
        p_film: {
          slug: draft.slug,
          title: draft.title,
          year: Number(draft.year) || null,
          genre: draft.genre,
          director: draft.director,
          cast_text: draft.cast_text,
          rating: draft.rating,
          runtime_minutes: Number(draft.runtime_minutes) || null,
          synopsis: draft.synopsis,
          warnings: draft.warnings,
          playback_id: draft.playback_id,
          is_hidden: draft.is_hidden,
          poster_url: draft.poster_url ?? "",
        },
      });
      await revalidateFilms();
      await load();
      setDraft((d) => (d ? { ...d, original: slug, slug, slugTouched: true } : d));
      setNote(
        draft.is_hidden
          ? "Saved. This film is hidden, so only admins can see it."
          : "Saved. It is live on the site now.",
      );
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(f: AdminFilm) {
    try {
      await call("admin_set_film_hidden", { p_slug: f.slug, p_hidden: !f.is_hidden });
      await revalidateFilms();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!draft?.original) return;
    setBusy(true);
    setFormError(null);
    try {
      await call("admin_delete_film", { p_slug: draft.original });
      await revalidateFilms();
      await load();
      setDraft(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onCover(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file || !draft) return;
    if (!draft.slug) {
      setFormError("Enter the title first, so the cover art has a name.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const blob = await coverBlob(file);
      const supabase = getBrowserSupabase();
      const path = `${draft.slug}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("posters")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) {
        throw new Error(
          /bucket|not found/i.test(upErr.message) ? SETUP_NOTE : upErr.message,
        );
      }
      const { data } = supabase.storage.from("posters").getPublicUrl(path);
      set("poster_url", `${data.publicUrl}?v=${Date.now()}`);
      setNote("Cover art uploaded. Press Save to keep it.");
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const builtInArt =
    draft?.original && OFFICIAL_POSTERS.has(draft.original)
      ? `/posters/${draft.original}.jpg`
      : null;
  const art = draft?.poster_url || builtInArt;

  // What search engines, AI assistants and share cards read is built
  // from these fields, so the form says plainly what is still missing.
  const checks = draft
    ? [
        { ok: draft.title.trim().length > 0, text: "Title" },
        { ok: /^\d{4}$/.test(draft.year), text: "Year" },
        { ok: draft.genre.trim().length > 0, text: "At least one genre" },
        { ok: draft.director.trim().length > 0, text: "Director" },
        { ok: draft.cast_text.trim().length > 0, text: "Cast" },
        { ok: Number(draft.runtime_minutes) > 0, text: "Runtime" },
        {
          ok: draft.synopsis.trim().length >= 110,
          text: `Synopsis of 110 characters or more (now ${draft.synopsis.trim().length})`,
        },
        { ok: Boolean(art), text: "Cover art" },
        {
          ok: draft.playback_id.trim().length > 0 && stillOk !== false,
          text: stillOk === false ? "Playback ID that Mux recognises" : "Mux playback ID",
        },
      ]
    : [];
  const missing = checks.filter((c) => !c.ok).length;

  return (
    <div className="cr-stack">
      <div className="cr-bar">
        <input
          type="search"
          className="cr-search"
          placeholder="Search films by title, genre or director"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search films"
        />
        <button type="button" className="btn-primary" onClick={() => open({ ...EMPTY_DRAFT })}>
          Add a film
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}

      {draft ? (
        <form className="cr-editor" onSubmit={save} ref={formRef}>
          <div className="cr-editor-head">
            <h3 className="cr-h3">{draft.original ? `Edit: ${draft.title}` : "Add a film"}</h3>
            <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>
              Close
            </button>
          </div>
          <div className="cr-editor-grid">
            <div className="cr-fields">
              <label className="field">
                <span>Title</span>
                <input type="text" value={draft.title} onChange={(e) => set("title", e.target.value)} required maxLength={160} />
              </label>
              <label className="field">
                <span>Page address</span>
                <input
                  type="text"
                  value={draft.slug}
                  onChange={(e) => {
                    set("slugTouched", true);
                    set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                  disabled={Boolean(draft.original)}
                  required
                />
                <span className="toggle-hint">
                  tohumovies.com/films/{draft.slug || "…"}
                  {draft.original ? " · fixed once a film exists, so shared links keep working" : ""}
                </span>
              </label>
              <div className="cr-row3">
                <label className="field">
                  <span>Year</span>
                  <input type="number" value={draft.year} onChange={(e) => set("year", e.target.value)} min={1900} max={2100} required />
                </label>
                <label className="field">
                  <span>Runtime (min)</span>
                  <input type="number" value={draft.runtime_minutes} onChange={(e) => set("runtime_minutes", e.target.value)} min={1} required />
                </label>
                <label className="field">
                  <span>Rating</span>
                  <select value={draft.rating} onChange={(e) => set("rating", e.target.value)}>
                    {RATINGS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Genres, separated by commas</span>
                <input type="text" value={draft.genre} onChange={(e) => set("genre", e.target.value)} placeholder="Horror, Thriller" list="cr-genres" />
                <datalist id="cr-genres">
                  {genres.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
                <span className="toggle-hint">In use now: {genres.join(", ") || "none yet"}</span>
              </label>
              <label className="field">
                <span>Director</span>
                <input type="text" value={draft.director} onChange={(e) => set("director", e.target.value)} />
              </label>
              <label className="field">
                <span>Cast, separated by commas</span>
                <input type="text" value={draft.cast_text} onChange={(e) => set("cast_text", e.target.value)} />
              </label>
              <label className="field">
                <span>Synopsis</span>
                <textarea value={draft.synopsis} onChange={(e) => set("synopsis", e.target.value)} rows={4} />
                <span className="toggle-hint">
                  The first 155 characters are what Google and share cards show. Lead with the hook.
                </span>
              </label>
              <label className="field">
                <span>Content warnings (optional)</span>
                <input type="text" value={draft.warnings} onChange={(e) => set("warnings", e.target.value)} placeholder="Violence, strong language" />
              </label>
              <label className="field">
                <span>Mux playback ID</span>
                <input
                  type="text"
                  value={draft.playback_id}
                  onChange={(e) => {
                    setStillOk(null);
                    set("playback_id", e.target.value.trim());
                  }}
                  required
                />
                <span className="toggle-hint">
                  In Mux: Video → Assets → open the film → Playback and thumbnails → copy the Playback ID (the access must be Public).
                </span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={draft.is_hidden} onChange={(e) => set("is_hidden", e.target.checked)} />
                <span>
                  Hidden
                  <span className="toggle-hint">Only admins can see a hidden film. Use it to prepare a film, or to take one down without deleting it.</span>
                </span>
              </label>
            </div>

            <aside className="cr-side">
              <p className="cr-side-title">Cover art</p>
              {art ? (
                <img className="cr-cover" src={art} alt="" />
              ) : (
                <div className="cr-cover cr-cover-empty">No cover art yet</div>
              )}
              <button type="button" className="btn-ghost" onClick={() => coverRef.current?.click()} disabled={busy}>
                {art ? "Replace cover art" : "Upload cover art"}
              </button>
              {draft.poster_url && builtInArt ? (
                <button type="button" className="link-btn" onClick={() => set("poster_url", null)}>
                  Go back to the built-in art
                </button>
              ) : null}
              <input ref={coverRef} type="file" accept="image/*" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => void onCover(e.currentTarget)} />
              <p className="toggle-hint">A tall poster (2 wide by 3 high) works best. JPG or PNG.</p>

              {draft.playback_id ? (
                <>
                  <p className="cr-side-title">Video check</p>
                  { }
                  <img
                    className="cr-still"
                    src={muxStillUrl(draft.playback_id, 60, 480)}
                    alt=""
                    onLoad={() => setStillOk(true)}
                    onError={() => setStillOk(false)}
                  />
                  <p className={stillOk === false ? "form-error" : "toggle-hint"}>
                    {stillOk === false
                      ? "Mux does not recognise this playback ID. Check for a missing character, and that playback is Public."
                      : stillOk
                        ? "Mux recognises this ID. This is a frame from the video."
                        : "Checking with Mux…"}
                  </p>
                </>
              ) : null}

              <p className="cr-side-title">Search and share preview</p>
              <div className="cr-serp">
                <span className="cr-serp-url">tohumovies.com › films › {draft.slug || "…"}</span>
                <span className="cr-serp-title">
                  {draft.title || "Title"} {draft.year ? `(${draft.year})` : ""} | Tohu Movies
                </span>
                <span className="cr-serp-desc">
                  {(draft.synopsis.trim() || "The synopsis appears here.").slice(0, 155)}
                  {draft.synopsis.trim().length > 155 ? "…" : ""}
                </span>
              </div>
              <ul className="cr-checks">
                {checks.map((c) => (
                  <li key={c.text} className={c.ok ? "ok" : "todo"}>
                    <span aria-hidden="true">{c.ok ? "✓" : "○"}</span> {c.text}
                  </li>
                ))}
              </ul>
              <p className="toggle-hint">
                {missing === 0
                  ? "Everything search engines, AI assistants and share cards read from this film is filled in."
                  : "The circled items are read by search engines, AI assistants and share cards. You can save without them and fill them in later."}
              </p>
            </aside>
          </div>

          {formError ? <p className="form-error" role="alert">{formError}</p> : null}
          {note ? <p className="form-note" role="status">{note}</p> : null}
          <div className="cr-editor-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Working…" : draft.original ? "Save changes" : "Add film"}
            </button>
            {draft.original ? (
              <Link className="btn-ghost" href={`/films/${draft.original}`} target="_blank">
                Open the film page
              </Link>
            ) : null}
          </div>

          {draft.original ? (
            <div className="cr-danger">
              <p className="cr-side-title">Delete this film</p>
              <p className="toggle-hint">
                This removes the film and its ratings, comments, watchlist entries and view counts for good. Shared links to it stop working. To take it down for now, tick Hidden instead. The video itself stays in Mux.
              </p>
              <label className="field">
                <span>Type the title to confirm: {draft.title}</span>
                <input type="text" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn-ghost danger"
                disabled={busy || deleteText.trim().toLowerCase() !== draft.title.trim().toLowerCase()}
                onClick={() => void remove()}
              >
                Delete film for good
              </button>
            </div>
          ) : null}
        </form>
      ) : null}

      {films === null && !error ? <p className="cr-loading">Loading…</p> : null}
      {films ? (
        <ul className="cr-list">
          {shown.map((f) => (
            <li key={f.slug} className={`cr-item${f.is_hidden ? " dim" : ""}`}>
              <div className="cr-item-main">
                <p className="cr-item-title">
                  {f.title} <span className="cr-muted">({f.year})</span>
                  {f.is_hidden ? <span className="cr-pill warn">Hidden</span> : null}
                  {!f.poster_url && !OFFICIAL_POSTERS.has(f.slug) ? <span className="cr-pill">No cover art</span> : null}
                </p>
                <p className="cr-muted">
                  {f.genre || "No genre"} · {f.rating} · {f.runtime_minutes} min · {f.views.toLocaleString("en-US")} views · {f.comments} comments · added {day(f.created_at)}
                </p>
              </div>
              <div className="cr-item-actions">
                <button type="button" className="btn-ghost" onClick={() => open(draftFrom(f))}>
                  Edit
                </button>
                <button type="button" className="btn-ghost" onClick={() => void toggleHidden(f)}>
                  {f.is_hidden ? "Show" : "Hide"}
                </button>
              </div>
            </li>
          ))}
          {shown.length === 0 ? <li className="cr-empty">No films match.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------ Comments ------------------------------ */

/* ------------------------------ Insights ------------------------------ */
