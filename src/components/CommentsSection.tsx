"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import Avatar from "./Avatar";
import { postComment, toggleCommentLike } from "@/lib/comments";
import type { ThreadComment } from "@/lib/types";

/** Comments on a film page, YouTube-style (Phase 5.2): each comment
 *  shows the commenter's avatar and name, a relative time, Like and
 *  Reply actions, and replies tucked under their top-level comment
 *  behind an expander. Posted comments and replies stay hidden until
 *  an admin approves them (the review note says so, honestly). Likes
 *  are optimistic: the count moves at once and rolls back if the
 *  write fails. */

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

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago", then
 *  the full date past a month. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return formatDate(iso);
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

function ThumbIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 11v9H4.2A.7.7 0 0 1 3.5 19.3V11.7a.7.7 0 0 1 .7-.7z" />
      <path d="M7 11l3.6-7.2c1.6 0 2.7 1.2 2.5 2.9L12.6 10h6.1a1.8 1.8 0 0 1 1.8 2.2l-1 5.6a2 2 0 0 1-2 1.6H7" />
    </svg>
  );
}

export default function CommentsSection({
  filmSlug,
  initialThreads,
  totalApproved,
}: {
  filmSlug: string;
  initialThreads: ThreadComment[];
  totalApproved: number;
}) {
  const { loading, user, profile } = useAuth();
  const [threads, setThreads] = useState<ThreadComment[]>(initialThreads);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Like error, shown once under whichever comment failed last.
  const [likeError, setLikeError] = useState<string | null>(null);

  // Reply UI: one composer per thread (keyed by the top-level id),
  // an expander state per thread.
  const [openReplyFor, setOpenReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySubmittedFor, setReplySubmittedFor] = useState<string | null>(
    null,
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filmPath = `/films/${filmSlug}`;
  const loginHref = `/login?next=${encodeURIComponent(filmPath)}`;
  const myName = profile?.display_name || user?.email || "You";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await postComment(filmSlug, user.id, text, null);
      // The comment is pending, so it does not join the list yet.
      setBody("");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitReply(e: FormEvent, threadId: string) {
    e.preventDefault();
    if (!user) return;
    const text = replyText.trim();
    if (!text) return;
    setReplyBusy(true);
    setReplyError(null);
    try {
      await postComment(filmSlug, user.id, text, threadId);
      // Pending like every comment: hidden until approved.
      setReplyText("");
      setReplySubmittedFor(threadId);
      setOpenReplyFor(null);
      setExpanded((prev) => ({ ...prev, [threadId]: true }));
    } catch (err) {
      setReplyError(
        err instanceof Error ? err.message : "Could not post the reply.",
      );
    } finally {
      setReplyBusy(false);
    }
  }

  /** Optimistic like/unlike for one comment, wherever it sits. */
  function onToggleLike(target: ThreadComment) {
    if (!user) return;
    const wasLiked = target.liked_by_me === true;
    const delta = wasLiked ? -1 : 1;
    const applyLike = (c: ThreadComment): ThreadComment =>
      c.id === target.id
        ? {
            ...c,
            liked_by_me: !wasLiked,
            like_count: Math.max(0, (c.like_count ?? 0) + delta),
          }
        : c;
    const applyAll = (list: ThreadComment[]): ThreadComment[] =>
      list.map((t) => ({ ...applyLike(t), replies: t.replies.map(applyLike) }));
    setLikeError(null);
    setThreads((prev) => applyAll(prev));
    toggleCommentLike(target.id, user.id, wasLiked).catch((err: unknown) => {
      // Roll back by re-applying the opposite delta.
      const revert = (c: ThreadComment): ThreadComment =>
        c.id === target.id
          ? {
              ...c,
              liked_by_me: wasLiked,
              like_count: Math.max(0, (c.like_count ?? 0) - delta),
            }
          : c;
      setThreads((prev) =>
        prev.map((t) => ({ ...revert(t), replies: t.replies.map(revert) })),
      );
      setLikeError(
        err instanceof Error ? err.message : "Could not save your like.",
      );
    });
  }

  function renderActions(c: ThreadComment, threadId: string) {
    const liked = c.liked_by_me === true;
    const count = c.like_count ?? 0;
    return (
      <div className="comment-actions">
        {user ? (
          <button
            type="button"
            className={`comment-action comment-like${liked ? " liked" : ""}`}
            onClick={() => onToggleLike(c)}
            aria-pressed={liked}
            aria-label={liked ? "Unlike this comment" : "Like this comment"}
          >
            <ThumbIcon filled={liked} />
            {count > 0 ? <span>{count}</span> : null}
          </button>
        ) : (
          <Link
            className="comment-action comment-like"
            href={loginHref}
            aria-label="Sign in to like this comment"
          >
            <ThumbIcon filled={false} />
            {count > 0 ? <span>{count}</span> : null}
          </Link>
        )}
        {user ? (
          <button
            type="button"
            className="comment-action"
            onClick={() => {
              setReplyError(null);
              setReplySubmittedFor(null);
              setOpenReplyFor((cur) => (cur === threadId ? null : threadId));
            }}
          >
            Reply
          </button>
        ) : (
          <Link className="comment-action" href={loginHref}>
            Reply
          </Link>
        )}
      </div>
    );
  }

  function renderComment(c: ThreadComment, threadId: string, isReply: boolean) {
    const name = c.profiles?.display_name ?? "A viewer";
    return (
      <div className={`comment-row${isReply ? " is-reply" : ""}`}>
        <Avatar
          preset={c.avatar_preset}
          url={c.avatar_url}
          name={name}
          size={isReply ? 28 : 36}
        />
        <div className="comment-main">
          <p className="comment-head">
            <strong>{name}</strong>{" "}
            <time dateTime={c.created_at}>{timeAgo(c.created_at)}</time>
          </p>
          <p className="comment-body">{c.body}</p>
          {renderActions(c, threadId)}
        </div>
      </div>
    );
  }

  return (
    <section className="comments" aria-label="Comments">
      <div className="section-head">
        <h2>Comments</h2>
        <p className="now-count">
          {totalApproved} comment{totalApproved === 1 ? "" : "s"}
        </p>
      </div>
      <p className="comments-note">
        Comments are reviewed before they appear.
      </p>

      {loading ? null : user ? (
        <form className="comment-form comment-composer" onSubmit={onSubmit}>
          <Avatar
            preset={profile?.avatar_preset}
            url={profile?.avatar_url}
            name={myName}
            size={36}
          />
          <div className="comment-composer-main">
            <label className="field">
              <span className="sr-only">Add a comment</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What did you think of this film?"
                maxLength={2000}
                rows={3}
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
            <div className="comment-composer-actions">
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Posting…" : "Post comment"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="signin-prompt">
          <Link href={loginHref}>Sign in to comment</Link>
        </p>
      )}

      {likeError ? (
        <p className="form-error comment-like-error" role="alert">
          {likeError}
        </p>
      ) : null}

      {threads.length === 0 ? (
        <p className="empty show">No comments yet. Be the first to share one.</p>
      ) : (
        <ul className="comment-list">
          {threads.map((thread) => {
            const isOpen = expanded[thread.id] === true;
            const replyCount = thread.replies.length;
            return (
              <li key={thread.id} className="comment-thread">
                {renderComment(thread, thread.id, false)}
                {openReplyFor === thread.id && user ? (
                  <form
                    className="comment-form comment-composer reply-composer"
                    onSubmit={(e) => void onSubmitReply(e, thread.id)}
                  >
                    <Avatar
                      preset={profile?.avatar_preset}
                      url={profile?.avatar_url}
                      name={myName}
                      size={28}
                    />
                    <div className="comment-composer-main">
                      <label className="field">
                        <span className="sr-only">Add a reply</span>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Add a reply…"
                          maxLength={2000}
                          rows={2}
                          required
                          autoFocus
                        />
                      </label>
                      {replyError ? (
                        <p className="form-error" role="alert">
                          {replyError}
                        </p>
                      ) : null}
                      <div className="comment-composer-actions">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => setOpenReplyFor(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={replyBusy}
                        >
                          {replyBusy ? "Posting…" : "Reply"}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : null}
                {replySubmittedFor === thread.id ? (
                  <p className="form-note reply-note" role="status">
                    Thanks — your reply is awaiting review and will appear
                    once approved.
                  </p>
                ) : null}
                {replyCount > 0 ? (
                  <>
                    <button
                      type="button"
                      className="replies-toggle"
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [thread.id]: !isOpen,
                        }))
                      }
                      aria-expanded={isOpen}
                    >
                      {isOpen
                        ? "▴ Hide replies"
                        : `▾ ${replyCount} repl${replyCount === 1 ? "y" : "ies"}`}
                    </button>
                    {isOpen ? (
                      <div className="reply-list">
                        {thread.replies.map((reply) => (
                          <div key={reply.id}>
                            {renderComment(reply, thread.id, true)}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
