"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { revalidateFilms } from "@/app/admin/actions";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { muxStillUrl } from "@/lib/films";
import { OFFICIAL_POSTERS } from "@/lib/posters";
import Avatar from "./Avatar";

/** The admin control room. Five tabs:
 *
 *  - Overview: the numbers that matter and what admins did lately.
 *  - Films: add, edit, hide, delete, upload cover art, with a check
 *    that everything search engines and share cards need is filled in.
 *  - Comments: approve, reject, delete; search every comment.
 *  - Members: counts, search, ban and unban. Super admins give admin
 *    access; any admin can remove a regular admin; a super admin's
 *    access cannot be changed from the site.
 *  - Log: everything admins did, newest first. Read-only.
 *  - Tools: the email check.
 *
 *  Every action goes through a database function that checks the
 *  caller is an admin (supabase/migrations/20261116_control_room.sql),
 *  so nothing here can be done by anyone else, whatever the page shows. */

type Tab = "overview" | "films" | "comments" | "members" | "log" | "tools";

type Overview = {
  members: number;
  members_7d: number;
  members_30d: number;
  admins: number;
  banned: number;
  films: number;
  hidden_films: number;
  comments: number;
  pending_comments: number;
  views_7d: number;
  views_30d: number;
  views_all: number;
  top_films: { slug: string; title: string; views: number }[];
  sources?: { source: string; members: number }[];
  recent: {
    action: string;
    target: string | null;
    detail: string | null;
    created_at: string;
    admin: string;
  }[];
};

type AdminFilm = {
  slug: string;
  title: string;
  year: number;
  genre: string;
  director: string;
  cast_text: string;
  rating: string;
  runtime_minutes: number;
  synopsis: string;
  warnings: string;
  playback_id: string;
  is_hidden: boolean;
  poster_url: string | null;
  created_at: string;
  views: number;
  comments: number;
};

type AdminComment = {
  id: string;
  film_slug: string;
  film_title: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  user_id: string;
  display_name: string;
  is_banned: boolean;
  created_at: string;
};

type Member = {
  id: string;
  email: string;
  display_name: string;
  avatar_preset: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  is_super_admin?: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  comments: number;
};

type MemberCounts = {
  total: number;
  new_7d: number;
  admins: number;
  super_admins: number;
  banned: number;
};

type LogRow = {
  id: number;
  action: string;
  target: string | null;
  detail: string | null;
  created_at: string;
  admin: string;
};

const RATINGS = ["PG", "PG 13", "R", "NR", "TV PG"] as const;
const SETUP_NOTE =
  "This part needs the control-room database update. Run the file supabase/migrations/20261116_control_room.sql in the Supabase SQL Editor once, then reload this page.";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function day(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function explain(err: { message?: string; code?: string } | null): string {
  const text = err?.message ?? "";
  if (
    err?.code === "PGRST202" ||
    /could not find the function|schema cache/i.test(text)
  ) {
    return SETUP_NOTE;
  }
  return text || "Something went wrong. Try again.";
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getBrowserSupabase().rpc(fn, args);
  if (error) throw new Error(explain(error));
  return data as T;
}

export default function AdminPanel({
  adminId,
  isSuperAdmin = false,
}: {
  adminId: string;
  isSuperAdmin?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, setPending] = useState<number | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "films", label: "Films" },
    { id: "comments", label: "Comments" },
    { id: "members", label: "Members" },
    { id: "log", label: "Log" },
    { id: "tools", label: "Tools" },
  ];

  return (
    <div className="cr">
      <div className="cr-tabs" role="tablist" aria-label="Control room sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`cr-tab${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "comments" && pending ? (
              <span className="cr-badge">{pending}</span>
            ) : null}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <OverviewTab onPending={setPending} goTo={setTab} />
      ) : null}
      {tab === "films" ? <FilmsTab /> : null}
      {tab === "comments" ? <CommentsTab onPending={setPending} /> : null}
      {tab === "members" ? (
        <MembersTab adminId={adminId} isSuperAdmin={isSuperAdmin} />
      ) : null}
      {tab === "log" ? <LogTab /> : null}
      {tab === "tools" ? <ToolsTab /> : null}
    </div>
  );
}

/* ------------------------------ Overview ------------------------------ */

function OverviewTab({
  onPending,
  goTo,
}: {
  onPending: (n: number) => void;
  goTo: (t: Tab) => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    call<Overview>("admin_overview")
      .then((d) => {
        if (cancelled) return;
        setData(d);
        onPending(d.pending_comments);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [onPending]);

  if (error) return <p className="form-error">{error}</p>;
  if (!data) return <p className="cr-loading">Loading…</p>;

  const tiles: { label: string; value: number; hint?: string; to?: Tab }[] = [
    { label: "Members", value: data.members, hint: `+${data.members_7d} this week`, to: "members" },
    { label: "Views, last 7 days", value: data.views_7d, hint: `${data.views_30d.toLocaleString("en-US")} in 30 days` },
    { label: "Views, all time", value: data.views_all },
    { label: "Films live", value: data.films, hint: data.hidden_films ? `${data.hidden_films} hidden` : undefined, to: "films" },
    { label: "Comments waiting", value: data.pending_comments, hint: `${data.comments} approved`, to: "comments" },
    { label: "Banned members", value: data.banned, hint: `${data.admins} admin${data.admins === 1 ? "" : "s"}`, to: "members" },
  ];

  return (
    <div className="cr-stack">
      <div className="cr-tiles">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            className="cr-tile"
            onClick={() => t.to && goTo(t.to)}
            disabled={!t.to}
          >
            <span className="cr-tile-value">{t.value.toLocaleString("en-US")}</span>
            <span className="cr-tile-label">{t.label}</span>
            {t.hint ? <span className="cr-tile-hint">{t.hint}</span> : null}
          </button>
        ))}
      </div>
      <p className="form-note">
        A view is counted once a film has played for about 30 seconds.
      </p>

      <div className="cr-cols">
        <section>
          <h3 className="cr-h3">Most watched, last 30 days</h3>
          {data.top_films.length === 0 ? (
            <p className="cr-empty">No views recorded yet.</p>
          ) : (
            <ol className="cr-rank">
              {data.top_films.map((f) => (
                <li key={f.slug}>
                  <Link href={`/films/${f.slug}`}>{f.title}</Link>
                  <span>{f.views.toLocaleString("en-US")}</span>
                </li>
              ))}
            </ol>
          )}
          {data.sources && data.sources.length > 0 ? (
            <>
              <h3 className="cr-h3">Where new members came from, last 30 days</h3>
              <ol className="cr-rank">
                {data.sources.map((s) => (
                  <li key={s.source}>
                    <span>{s.source}</span>
                    <span>{s.members.toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </section>
        <section>
          <h3 className="cr-h3">Recent admin activity</h3>
          {data.recent.length === 0 ? (
            <p className="cr-empty">Nothing yet. Actions taken here are listed for every admin to see.</p>
          ) : (
            <ul className="cr-log">
              {data.recent.map((r, i) => (
                <li key={i}>
                  <strong>{r.action}</strong>
                  {r.target ? <> · {r.target}</> : null}
                  {r.detail ? <> · {r.detail}</> : null}
                  <span>
                    {r.admin}, {day(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* -------------------------------- Films ------------------------------- */

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

function FilmsTab() {
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

  const load = useCallback(async () => {
    try {
      setFilms(await call<AdminFilm[]>("admin_list_films"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

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
                // eslint-disable-next-line @next/next/no-img-element
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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

function CommentsTab({ onPending }: { onPending: (n: number) => void }) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await call<AdminComment[]>("admin_list_comments", {
        p_status: status,
        p_search: query,
        p_limit: 150,
      });
      setRows(list);
      setError(null);
      if (status === "pending" && !query) onPending(list.length);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [status, query, onPending]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), query ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, query]);

  async function act(c: AdminComment, action: "approved" | "rejected" | "delete") {
    if (action === "delete" && !window.confirm("Delete this comment and any replies to it for good?")) {
      return;
    }
    setBusyId(c.id);
    try {
      await call("admin_moderate_comment", { p_id: c.id, p_action: action });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function ban(c: AdminComment) {
    const reason = window.prompt(
      `Ban ${c.display_name}? They will still be able to watch, but not comment or like. Their existing comments will be taken down.\n\nReason (only admins see it):`,
      "",
    );
    if (reason === null) return;
    setBusyId(c.id);
    try {
      await call("admin_set_banned", {
        p_user: c.user_id,
        p_banned: true,
        p_reason: reason,
        p_hide_comments: true,
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const filters = ["pending", "approved", "rejected", "all"] as const;

  return (
    <div className="cr-stack">
      <div className="cr-bar">
        <div className="cr-chips" role="group" aria-label="Show comments">
          {filters.map((f) => (
            <button key={f} type="button" className={`cr-chip${status === f ? " on" : ""}`} onClick={() => setStatus(f)}>
              {f === "pending" ? "Waiting" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input type="search" className="cr-search" placeholder="Search comments, members or films" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search comments" />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {rows === null && !error ? <p className="cr-loading">Loading…</p> : null}
      {rows && rows.length === 0 ? (
        <p className="cr-empty">
          {status === "pending" ? "Nothing waiting. New comments appear here for review." : "No comments here."}
        </p>
      ) : null}
      {rows && rows.length > 0 ? (
        <ul className="cr-list">
          {rows.map((c) => (
            <li key={c.id} className="cr-item cr-comment">
              <div className="cr-item-main">
                <p className="cr-muted">
                  <Link href={`/u/${c.user_id}`}>{c.display_name}</Link>
                  {c.is_banned ? <span className="cr-pill warn">Banned</span> : null} on{" "}
                  <Link href={`/films/${c.film_slug}`}>{c.film_title}</Link> · {day(c.created_at)}
                  {status === "all" ? <span className={`cr-pill${c.status === "pending" ? " warn" : ""}`}>{c.status}</span> : null}
                </p>
                <p className="cr-body">{c.body}</p>
              </div>
              <div className="cr-item-actions">
                {c.status !== "approved" ? (
                  <button type="button" className="btn-primary" disabled={busyId === c.id} onClick={() => void act(c, "approved")}>
                    Approve
                  </button>
                ) : null}
                {c.status !== "rejected" ? (
                  <button type="button" className="btn-ghost" disabled={busyId === c.id} onClick={() => void act(c, "rejected")}>
                    {c.status === "approved" ? "Take down" : "Reject"}
                  </button>
                ) : null}
                <button type="button" className="btn-ghost danger" disabled={busyId === c.id} onClick={() => void act(c, "delete")}>
                  Delete
                </button>
                {!c.is_banned ? (
                  <button type="button" className="btn-ghost danger" disabled={busyId === c.id} onClick={() => void ban(c)}>
                    Ban member
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------- Members ------------------------------ */

const PAGE = 50;

function MembersTab({
  adminId,
  isSuperAdmin,
}: {
  adminId: string;
  isSuperAdmin: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "admins" | "banned">("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Member[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banning, setBanning] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [hide, setHide] = useState(true);
  const [counts, setCounts] = useState<MemberCounts | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCounts = useCallback(() => {
    call<MemberCounts>("admin_member_counts").then(setCounts, () => {});
  }, []);
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const load = useCallback(
    async (offset: number) => {
      try {
        const list = await call<Member[]>("admin_list_members", {
          p_search: query,
          p_filter: filter,
          p_limit: PAGE,
          p_offset: offset,
        });
        setRows((prev) => (offset === 0 || !prev ? list : [...prev, ...list]));
        setMore(list.length === PAGE);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [query, filter],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void load(0), query ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, query]);

  async function run(id: string, fn: string, args: Record<string, unknown>) {
    setBusyId(id);
    try {
      await call(fn, args);
      setBanning(null);
      setReason("");
      setNotice(null);
      await load(0);
      loadCounts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  /** Access changes go through the site's own endpoint, which makes the
   *  change (the database decides whether it is allowed) and sends the
   *  notification emails. */
  async function setRole(m: Member, role: "member" | "admin" | "super_admin") {
    const who = m.display_name || m.email;
    const question =
      role === "super_admin"
        ? `Make ${who} a super admin?\n\nThey will be able to give admin access to others, and this cannot be undone from the site: a super admin's access can only be changed by hand in the database.`
        : role === "admin"
          ? `Make ${who} an admin?\n\nThey will be able to add, edit and hide films, review comments and ban members. They and every super admin will be emailed.`
          : `Remove admin access from ${who}?\n\nThey and every super admin will be emailed.`;
    if (!window.confirm(question)) return;
    setBusyId(m.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: m.id, role }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "The change was not made.");
      }
      setNotice(data.message ?? "Done.");
      await load(0);
      loadCounts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const filters = ["all", "admins", "banned"] as const;

  return (
    <div className="cr-stack">
      <div className="cr-bar">
        <div className="cr-chips" role="group" aria-label="Show members">
          {filters.map((f) => (
            <button key={f} type="button" className={`cr-chip${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input type="search" className="cr-search" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search members" />
      </div>
      {counts ? (
        <p className="cr-counts" aria-live="polite">
          <strong>{counts.total.toLocaleString("en-US")}</strong> member{counts.total === 1 ? "" : "s"}
          <span>+{counts.new_7d.toLocaleString("en-US")} this week</span>
          <span>
            {counts.admins} admin{counts.admins === 1 ? "" : "s"}
            {counts.super_admins ? ` (${counts.super_admins} super)` : ""}
          </span>
          <span>{counts.banned} banned</span>
        </p>
      ) : null}
      <p className="form-note">
        A banned member can still watch, but cannot comment, like, or change their public profile. Only a super admin can give admin access. Any admin can remove a regular admin. A super admin&apos;s access cannot be changed from the site. Every change is emailed to the member and to all super admins, and is kept in the Log.
      </p>
      {notice ? (
        <p className="form-note" role="status">
          {notice}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {rows === null && !error ? <p className="cr-loading">Loading…</p> : null}
      {rows && rows.length === 0 ? <p className="cr-empty">No members match.</p> : null}
      {rows && rows.length > 0 ? (
        <ul className="cr-list">
          {rows.map((m) => {
            const me = m.id === adminId;
            return (
              <li key={m.id} className="cr-item cr-member">
                <Avatar preset={m.avatar_preset} url={m.avatar_url} name={m.display_name || m.email} size={40} />
                <div className="cr-item-main">
                  <p className="cr-item-title">
                    {m.display_name || "No name yet"}
                    {me ? <span className="cr-pill">You</span> : null}
                    {m.is_super_admin ? (
                      <span className="cr-pill ok">Super admin</span>
                    ) : m.is_admin ? (
                      <span className="cr-pill ok">Admin</span>
                    ) : null}
                    {m.is_banned ? <span className="cr-pill warn">Banned</span> : null}
                  </p>
                  <p className="cr-muted">
                    {m.email} · joined {day(m.created_at)} · last sign-in {day(m.last_sign_in_at)} · {m.comments} comment{m.comments === 1 ? "" : "s"}
                  </p>
                  {m.is_banned && m.banned_reason ? <p className="cr-muted">Reason: {m.banned_reason}</p> : null}
                  {banning === m.id ? (
                    <div className="cr-ban">
                      <label className="field">
                        <span>Reason (only admins see it)</span>
                        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus />
                      </label>
                      <label className="toggle-row">
                        <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
                        <span>Also take down their existing comments</span>
                      </label>
                      <div className="cr-item-actions">
                        <button
                          type="button"
                          className="btn-ghost danger"
                          disabled={busyId === m.id}
                          onClick={() => void run(m.id, "admin_set_banned", { p_user: m.id, p_banned: true, p_reason: reason, p_hide_comments: hide })}
                        >
                          Confirm ban
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => setBanning(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                {!me && banning !== m.id ? (
                  <div className="cr-item-actions">
                    <Link className="btn-ghost" href={`/u/${m.id}`} target="_blank">
                      Profile
                    </Link>
                    {m.is_banned ? (
                      <button type="button" className="btn-ghost" disabled={busyId === m.id} onClick={() => void run(m.id, "admin_set_banned", { p_user: m.id, p_banned: false })}>
                        Lift ban
                      </button>
                    ) : !m.is_admin ? (
                      <button type="button" className="btn-ghost danger" onClick={() => { setBanning(m.id); setReason(""); setHide(true); }}>
                        Ban
                      </button>
                    ) : null}
                    {m.is_super_admin ? null : m.is_admin ? (
                      <>
                        {isSuperAdmin ? (
                          <button type="button" className="btn-ghost" disabled={busyId === m.id} onClick={() => void setRole(m, "super_admin")}>
                            Make super admin
                          </button>
                        ) : null}
                        <button type="button" className="btn-ghost" disabled={busyId === m.id} onClick={() => void setRole(m, "member")}>
                          Remove admin
                        </button>
                      </>
                    ) : isSuperAdmin && !m.is_banned ? (
                      <button type="button" className="btn-ghost" disabled={busyId === m.id} onClick={() => void setRole(m, "admin")}>
                        Make admin
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {more ? (
        <button type="button" className="btn-ghost" onClick={() => void load(rows?.length ?? 0)}>
          Show more
        </button>
      ) : null}
    </div>
  );
}

/* --------------------------------- Log -------------------------------- */

function LogTab() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (offset: number) => {
      try {
        const list = await call<LogRow[]>("admin_list_log", {
          p_search: query,
          p_limit: 100,
          p_offset: offset,
        });
        setRows((prev) => (offset === 0 || !prev ? list : [...prev, ...list]));
        setMore(list.length === 100);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [query],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void load(0), query ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, query]);

  return (
    <div className="cr-stack">
      <div className="cr-bar">
        <input type="search" className="cr-search" placeholder="Search the log by action, name or detail" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the log" />
      </div>
      <p className="form-note">
        Everything admins do in the control room is recorded here, newest first: films, comments, bans, access changes and the emails sent about them. The log is kept in the database and cannot be edited or deleted from the site.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      {rows === null && !error ? <p className="cr-loading">Loading…</p> : null}
      {rows && rows.length === 0 ? <p className="cr-empty">Nothing recorded yet.</p> : null}
      {rows && rows.length > 0 ? (
        <ul className="cr-log cr-log-full">
          {rows.map((r) => (
            <li key={r.id}>
              <strong>{r.action}</strong>
              {r.target ? <> · {r.target}</> : null}
              {r.detail ? <> · {r.detail}</> : null}
              <span>
                {r.admin},{" "}
                {new Date(r.created_at).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {more ? (
        <button type="button" className="btn-ghost" onClick={() => void load(rows?.length ?? 0)}>
          Show more
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------- Tools ------------------------------- */

function ToolsTab() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function sendTestEmail() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/email/test", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
      setResult({
        ok: data.status === "sent",
        message:
          data.message ??
          (res.ok
            ? "No answer from the site. Try again in a moment."
            : "The site refused the request. Make sure you are signed in as an admin."),
      });
    } catch {
      setResult({ ok: false, message: "Could not reach the site. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const links: { label: string; href: string; hint: string }[] = [
    { label: "Mux", href: "https://dashboard.mux.com", hint: "Upload videos and copy playback IDs" },
    { label: "Vercel Analytics", href: "https://vercel.com/tohu1/tohu-movies/analytics", hint: "Visitors, pages, where they came from" },
    { label: "Google Search Console", href: "https://search.google.com/search-console", hint: "How the site shows up on Google" },
    { label: "Google AdSense", href: "https://adsense.google.com", hint: "Ad approval and earnings" },
    { label: "Resend", href: "https://resend.com/emails", hint: "Every email the site sent" },
    { label: "Supabase", href: "https://supabase.com/dashboard", hint: "The database behind the site" },
  ];

  return (
    <div className="cr-stack">
      <section>
        <h3 className="cr-h3">Email check</h3>
        <p className="form-note">Sends a test email to your own address and reports exactly what happened.</p>
        <button type="button" className="btn-primary" onClick={() => void sendTestEmail()} disabled={busy}>
          {busy ? "Sending…" : "Send me a test email"}
        </button>
        {result ? (
          <p className={result.ok ? "form-note" : "form-error"} role="status">
            {result.message}
          </p>
        ) : null}
      </section>
      <section>
        <h3 className="cr-h3">Your other dashboards</h3>
        <ul className="cr-links">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
              <span>{l.hint}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
