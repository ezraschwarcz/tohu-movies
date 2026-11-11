"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Comment } from "@/lib/types";

/** Comments on a film page. Approved comments are listed with the
 *  commenter's display name. A signed-in user can submit one; it is
 *  saved as pending and does not appear until an admin approves it.
 *  A signed-out user sees a prompt to sign in. */

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

export default function CommentsSection({
  filmSlug,
  initial,
}: {
  filmSlug: string;
  initial: Comment[];
}) {
  const { loading, user } = useAuth();
  const [comments, setComments] = useState<Comment[]>(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    const { data, error: err } = await supabase
      .from("comments")
      .insert({ film_slug: filmSlug, body: text, user_id: user.id })
      .select("id,film_slug,body,status,user_id,created_at")
      .single();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    // The comment is pending, so it does not join the list yet. Keep it
    // out of sight and show the review note instead.
    void data;
    setBody("");
    setSubmitted(true);
  }

  return (
    <section className="comments" aria-label="Comments">
      <div className="section-head">
        <h2>Comments</h2>
        <p className="now-count">
          {comments.length} comment{comments.length === 1 ? "" : "s"}
        </p>
      </div>
      <p className="comments-note">
        Comments are reviewed before they appear.
      </p>

      {comments.length === 0 ? (
        <p className="empty show">No comments yet. Be the first to share one.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <p className="comment-head">
                <strong>{c.profiles?.display_name ?? "A viewer"}</strong>
                <span aria-hidden="true"> · </span>
                <time dateTime={c.created_at}>{formatDate(c.created_at)}</time>
              </p>
              <p className="comment-body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {loading ? null : user ? (
        <form className="comment-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Add a comment</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did you think of this film?"
              maxLength={2000}
              rows={4}
              required
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {submitted ? (
            <p className="form-note" role="status">
              Thanks — your comment is awaiting review and will appear once
              approved.
            </p>
          ) : null}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : (
        <p className="signin-prompt">
          <Link href={`/login?next=${encodeURIComponent(`/films/${filmSlug}`)}`}>
            Sign in to comment
          </Link>
        </p>
      )}
    </section>
  );
}
