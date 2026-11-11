"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { revalidateFilms } from "@/app/admin/actions";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** The admin panel itself (client side). The page already verified the
 *  visitor is an admin; every write here is also enforced by RLS (only
 *  admins can update/delete comments or insert films), so a non-admin
 *  who reached this component could not change anything. */

type PendingComment = {
  id: string;
  film_slug: string;
  body: string;
  created_at: string;
  profiles: { display_name: string } | null;
  films: { title: string } | null;
};

const RATINGS = ["PG", "PG 13", "R", "NR", "TV PG"] as const;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AdminPanel({
  initialPending,
}: {
  initialPending: PendingComment[];
}) {
  const [pending, setPending] = useState<PendingComment[]>(initialPending);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Add film form state.
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [genre, setGenre] = useState("");
  const [director, setDirector] = useState("");
  const [cast, setCast] = useState("");
  const [rating, setRating] = useState<string>("PG 13");
  const [runtime, setRuntime] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [warnings, setWarnings] = useState("");
  const [playbackId, setPlaybackId] = useState("");
  const [filmBusy, setFilmBusy] = useState(false);
  const [filmError, setFilmError] = useState<string | null>(null);
  const [filmAdded, setFilmAdded] = useState<string | null>(null);

  const slug = slugify(title);

  async function moderate(
    id: string,
    action: "approved" | "rejected" | "delete",
  ) {
    setBusyId(id);
    setActionError(null);
    const supabase = getBrowserSupabase();
    let error: { message: string } | null = null;
    if (action === "delete") {
      ({ error } = await supabase.from("comments").delete().eq("id", id));
    } else {
      ({ error } = await supabase
        .from("comments")
        .update({ status: action })
        .eq("id", id));
    }
    setBusyId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    setPending((list) => list.filter((c) => c.id !== id));
  }

  async function addFilm(e: FormEvent) {
    e.preventDefault();
    setFilmBusy(true);
    setFilmError(null);
    setFilmAdded(null);
    const supabase = getBrowserSupabase();
    try {
      if (!slug) throw new Error("The title needs to produce a page address.");
      const yearNum = Number(year);
      const runtimeNum = Number(runtime);
      if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2030) {
        throw new Error("Enter a valid year.");
      }
      if (!Number.isInteger(runtimeNum) || runtimeNum <= 0) {
        throw new Error("Enter a runtime in whole minutes.");
      }
      if (!playbackId.trim()) {
        throw new Error("Enter the Mux playback ID.");
      }
      const { data: existing } = await supabase
        .from("films")
        .select("slug")
        .eq("slug", slug)
        .maybeSingle();
      if (existing) {
        throw new Error(
          `A film already uses the address /films/${slug}. Change the title or pick a different slug.`,
        );
      }
      const { error } = await supabase.from("films").insert({
        slug,
        title: title.trim(),
        year: yearNum,
        genre: genre.trim(),
        director: director.trim(),
        cast_text: cast.trim(),
        rating,
        runtime_minutes: runtimeNum,
        synopsis: synopsis.trim(),
        warnings: warnings.trim(),
        playback_id: playbackId.trim(),
      });
      if (error) throw error;
      await revalidateFilms();
      setFilmAdded(slug);
      setTitle("");
      setYear("");
      setGenre("");
      setDirector("");
      setCast("");
      setRating("PG 13");
      setRuntime("");
      setSynopsis("");
      setWarnings("");
      setPlaybackId("");
    } catch (err) {
      setFilmError(
        err instanceof Error ? err.message : "Could not add the film.",
      );
    } finally {
      setFilmBusy(false);
    }
  }

  return (
    <div className="admin-grid">
      <section aria-label="Pending comments">
        <h3>Pending comments ({pending.length})</h3>
        {actionError ? (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        ) : null}
        {pending.length === 0 ? (
          <p className="empty show">
            Nothing waiting. New comments appear here for review.
          </p>
        ) : (
          <ul className="admin-list">
            {pending.map((c) => (
              <li key={c.id} className="admin-comment">
                <p className="comment-head">
                  <strong>{c.profiles?.display_name ?? "A viewer"}</strong>
                  <span aria-hidden="true"> · </span>
                  <Link href={`/films/${c.film_slug}`}>
                    {c.films?.title ?? c.film_slug}
                  </Link>
                  <span aria-hidden="true"> · </span>
                  <time dateTime={c.created_at}>
                    {formatDate(c.created_at)}
                  </time>
                </p>
                <p className="comment-body">{c.body}</p>
                <p className="admin-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === c.id}
                    onClick={() => void moderate(c.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busyId === c.id}
                    onClick={() => void moderate(c.id, "rejected")}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn-ghost danger"
                    disabled={busyId === c.id}
                    onClick={() => void moderate(c.id, "delete")}
                  >
                    Delete
                  </button>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Add a film">
        <h3>Add a film</h3>
        <p className="comments-note">
          The film appears on the home page and gets its own page at
          /films/[slug] as soon as it is added. The poster still uses the
          default still time unless the still time is added to the code.
        </p>
        <form className="admin-form" onSubmit={addFilm}>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
            />
          </label>
          <p className="field-hint">
            Page address: /films/{slug || "…"}
          </p>
          <div className="field-row">
            <label className="field">
              <span>Year</span>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
                min={1900}
                max={2030}
              />
            </label>
            <label className="field">
              <span>Runtime (minutes)</span>
              <input
                type="number"
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
                required
                min={1}
              />
            </label>
            <label className="field">
              <span>Rating</span>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                {RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Genre (comma-separated)</span>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="Drama, Thriller"
              required
            />
          </label>
          <label className="field">
            <span>Director</span>
            <input
              type="text"
              value={director}
              onChange={(e) => setDirector(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Cast (comma-separated)</span>
            <input
              type="text"
              value={cast}
              onChange={(e) => setCast(e.target.value)}
              placeholder="Actor One, Actor Two"
            />
          </label>
          <label className="field">
            <span>Synopsis</span>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={4}
              required
            />
          </label>
          <label className="field">
            <span>Content warnings</span>
            <textarea
              value={warnings}
              onChange={(e) => setWarnings(e.target.value)}
              rows={2}
              placeholder="What viewers should know before watching"
            />
          </label>
          <label className="field">
            <span>Mux playback ID</span>
            <input
              type="text"
              value={playbackId}
              onChange={(e) => setPlaybackId(e.target.value)}
              placeholder="From the Mux dashboard, playback ID"
              required
            />
          </label>
          {filmError ? (
            <p className="form-error" role="alert">
              {filmError}
            </p>
          ) : null}
          {filmAdded ? (
            <p className="form-note" role="status">
              Film added.{" "}
              <Link href={`/films/${filmAdded}`}>
                View its page
              </Link>
              .
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={filmBusy}>
            {filmBusy ? "Adding…" : "Add film"}
          </button>
        </form>
      </section>
    </div>
  );
}
