"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { day, call, type AdminComment } from "./shared";

export default function CommentsTab({ onPending }: { onPending: (n: number) => void }) {
  const [status, setStatus] = useState<"pending" | "reported" | "approved" | "rejected" | "all">("pending");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (status === "reported") {
        setRows(await call<AdminComment[]>("admin_list_reports"));
        setError(null);
        return;
      }
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

  const filters = ["pending", "reported", "approved", "rejected", "all"] as const;

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
                {c.reports ? (
                  <p className="cr-muted">
                    Reported {c.reports} time{c.reports === 1 ? "" : "s"}
                    {c.reasons && c.reasons.length > 0 ? `: ${c.reasons.join("; ")}` : ""} · currently {c.status}
                  </p>
                ) : null}
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
                {status === "reported" ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busyId === c.id}
                    onClick={() => {
                      setBusyId(c.id);
                      call("admin_close_reports", { p_comment: c.id })
                        .then(() => load())
                        .catch((e: Error) => setError(e.message))
                        .finally(() => setBusyId(null));
                    }}
                  >
                    Dismiss reports
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
