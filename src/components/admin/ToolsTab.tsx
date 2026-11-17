"use client";

import { useCallback, useEffect, useState } from "react";
import { day, call, settle, type Loaded } from "./shared";

type Submission = {
  id: number;
  title: string;
  year: number | null;
  role: string | null;
  name: string;
  email: string;
  link: string | null;
  rights: string | null;
  message: string | null;
  status: "new" | "reviewed" | "accepted" | "declined";
  created_at: string;
};

function SubmissionsSection() {
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback((result: Loaded<Submission[]>) => {
    if ("data" in result) {
      setRows(result.data);
      setError(null);
    } else {
      setError(
        /database update/.test(result.error)
          ? "Film submissions need the submissions database update (supabase/migrations/20261119_submissions.sql)."
          : result.error,
      );
    }
  }, []);
  /** Reload the list after a change. */
  const load = useCallback(async () => show(await settle(call<Submission[]>("admin_list_submissions"))), [show]);
  useEffect(() => {
    let cancelled = false;
    void settle(call<Submission[]>("admin_list_submissions")).then((r) => !cancelled && show(r));
    return () => {
      cancelled = true;
    };
  }, [show]);

  async function mark(id: number, status: Submission["status"]) {
    try {
      await call("admin_set_submission_status", { p_id: id, p_status: status });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section>
      <h3 className="cr-h3">
        Film submissions
        {rows ? ` (${rows.filter((r) => r.status === "new").length} new)` : ""}
      </h3>
      {error ? <p className="form-note">{error}</p> : null}
      {rows && rows.length === 0 ? (
        <p className="cr-empty">None yet. They arrive from the Submit your film page.</p>
      ) : null}
      {rows && rows.length > 0 ? (
        <ul className="cr-list">
          {rows.map((r) => (
            <li key={r.id} className={`cr-item${r.status === "new" ? "" : " dim"}`}>
              <div className="cr-item-main">
                <p className="cr-item-title">
                  {r.title} {r.year ? <span className="cr-muted">({r.year})</span> : null}
                  <span className={`cr-pill${r.status === "new" ? " warn" : ""}`}>{r.status}</span>
                </p>
                <p className="cr-muted">
                  {r.name}
                  {r.role ? `, ${r.role}` : ""} · <a href={`mailto:${r.email}`}>{r.email}</a> · {day(r.created_at)}
                </p>
                {r.link ? <p className="cr-muted">Watch: {r.link}</p> : null}
                {r.rights ? <p className="cr-muted">Rights: {r.rights}</p> : null}
                {r.message ? <p className="cr-body">{r.message}</p> : null}
              </div>
              <div className="cr-item-actions">
                {(["reviewed", "accepted", "declined"] as const)
                  .filter((st) => st !== r.status)
                  .map((st) => (
                    <button key={st} type="button" className="btn-ghost" onClick={() => void mark(r.id, st)}>
                      Mark {st}
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function ToolsTab() {
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
      <SubmissionsSection />
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
