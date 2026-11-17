"use client";

import { useCallback, useEffect, useState } from "react";
import { day, call, settle, type AdminFilm, type Loaded } from "./shared";

type EmailOverview = {
  members: number;
  friday_pick: number;
  new_films: number;
  replies: number;
  sent_7d: Record<string, number>;
  sent_today: number;
  picks: {
    send_date: string;
    film_slug: string;
    title: string;
    note: string | null;
    auto: boolean;
    sent: number;
  }[];
};

/** The next Friday (today counts until its email has gone), YYYY-MM-DD. */
function fetchEmailTab() {
  return Promise.all([
    call<EmailOverview>("admin_email_overview"),
    call<AdminFilm[]>("admin_list_films"),
  ]);
}

function upcomingFriday(): string {
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    if (day.getDay() === 5) {
      const m = String(day.getMonth() + 1).padStart(2, "0");
      return `${day.getFullYear()}-${m}-${String(day.getDate()).padStart(2, "0")}`;
    }
  }
  return "";
}

export default function EmailsTab() {
  const [data, setData] = useState<EmailOverview | null>(null);
  const [films, setFilms] = useState<AdminFilm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(upcomingFriday);
  const [slug, setSlug] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"friday_pick" | "new_films" | "reply">("friday_pick");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const show = useCallback((result: Loaded<[EmailOverview, AdminFilm[]]>) => {
    if ("data" in result) {
      const [o, f] = result.data;
      setData(o);
      setFilms(f.filter((x) => !x.is_hidden).sort((a, b) => a.title.localeCompare(b.title)));
      setError(null);
    } else {
      setError(
        /database update/.test(result.error)
          ? "This tab needs the emails database update. Run supabase/migrations/20261118_emails.sql in the Supabase SQL Editor once, then reload."
          : result.error,
      );
    }
  }, []);
  /** Reload the numbers after a change. */
  const load = useCallback(async () => show(await settle(fetchEmailTab())), [show]);
  useEffect(() => {
    let cancelled = false;
    void settle(fetchEmailTab()).then((r) => !cancelled && show(r));
    return () => {
      cancelled = true;
    };
  }, [show]);

  // Show what is already chosen for the selected Friday (adjusted while
  // drawing, whenever the date or the saved pick changes).
  const chosen = data?.picks.find((p) => p.send_date === date);
  const chosenKey = chosen ? `${date}|${chosen.film_slug}|${chosen.note ?? ""}` : null;
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  if (chosen && chosenKey !== filledFrom) {
    setFilledFrom(chosenKey);
    setSlug(chosen.film_slug);
    setNote(chosen.note ?? "");
  }

  async function savePick() {
    setBusy(true);
    setMessage(null);
    try {
      await call("admin_set_friday_pick", { p_date: date, p_slug: slug, p_note: note });
      await load();
      setMessage({ ok: true, text: "Saved. It goes out that Friday morning." });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setMessage({ ok: out.ok === true, text: out.message ?? "No answer from the site." });
      if (body.action === "run") await load();
    } catch {
      setMessage({ ok: false, text: "Could not reach the site." });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="form-error">{error}</p>;
  if (!data) return <p className="cr-loading">Loading…</p>;

  const previewUrl = `/api/admin/emails?kind=${kind}&slug=${encodeURIComponent(slug)}&note=${encodeURIComponent(note)}&v=${previewKey}`;
  const tiles = [
    { label: "Friday Pick subscribers", value: data.friday_pick },
    { label: "New-film alert subscribers", value: data.new_films },
    { label: "Reply emails on", value: data.replies },
    { label: "Optional emails sent, last 24 hours", value: data.sent_today },
  ];

  return (
    <div className="cr-stack">
      <div className="cr-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="cr-tile">
            <span className="cr-tile-value">{t.value.toLocaleString("en-US")}</span>
            <span className="cr-tile-label">{t.label}</span>
          </div>
        ))}
      </div>
      <p className="form-note">
        Emails go out once a day, around 9am Central. The Friday Pick goes to members who asked for it; new-film alerts go out when you add a film; reply emails go when a reply is approved. The free Resend plan sends 100 emails a day, so the site stops at 80 and sends the rest the next day.
      </p>

      <section className="cr-editor">
        <h3 className="cr-h3">The Friday Pick</h3>
        <p className="toggle-hint">
          Choose the film yourself, or leave it: with no choice, the site picks the most-watched film that has not been a pick in the last 12 weeks.
        </p>
        <div className="cr-row3">
          <label className="field">
            <span>Friday</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field" style={{ gridColumn: "span 2" }}>
            <span>Film</span>
            <select value={slug} onChange={(e) => setSlug(e.target.value)}>
              <option value="">Let the site choose</option>
              {films.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.title} ({f.year})
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Your note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 400))}
            rows={2}
            placeholder="One or two lines on why this film. Shown above it in the email."
          />
        </label>
        <div className="cr-editor-actions">
          <button type="button" className="btn-primary" disabled={busy || !slug || !date} onClick={() => void savePick()}>
            Save this pick
          </button>
        </div>
      </section>

      <section className="cr-editor">
        <h3 className="cr-h3">Preview and test</h3>
        <div className="cr-bar">
          <div className="cr-chips" role="group" aria-label="Which email">
            {(
              [
                ["friday_pick", "Friday Pick"],
                ["new_films", "New film alert"],
                ["reply", "Reply notice"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" className={`cr-chip${kind === k ? " on" : ""}`} onClick={() => setKind(k)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn-ghost" onClick={() => setPreviewKey((n) => n + 1)}>
            Refresh preview
          </button>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void post({ action: "test", kind, slug, note })}>
            Send me a test
          </button>
        </div>
        <iframe className="cr-email-preview" title="Email preview" src={previewUrl} />
      </section>

      {message ? (
        <p className={message.ok ? "form-note" : "form-error"} role="status">
          {message.text}
        </p>
      ) : null}

      <section>
        <h3 className="cr-h3">Recent and upcoming picks</h3>
        {data.picks.length === 0 ? (
          <p className="cr-empty">None yet.</p>
        ) : (
          <ol className="cr-rank">
            {data.picks.map((p) => (
              <li key={p.send_date}>
                <span>
                  {day(`${p.send_date}T12:00:00`)} · {p.title}
                  {p.auto ? " (chosen by the site)" : ""}
                </span>
                <span>{p.sent ? `${p.sent} sent` : "not sent"}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="cr-danger">
          <p className="toggle-hint">
            Run today&apos;s send now instead of waiting for 9am. It only sends what is due and never sends anything twice. Super admins only.
          </p>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Send every email that is due right now?")) void post({ action: "run" });
            }}
          >
            Run today&apos;s send now
          </button>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------- Tools ------------------------------- */
