"use client";

import { useState, type FormEvent } from "react";

export default function SubmitFilmForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (out.ok) setDone(true);
      else setError(out.message ?? "That did not go through. Try again.");
    } catch {
      setError("Could not reach the site. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="form-note" role="status">
        Thank you. We have your submission and will reply by email. We
        read every one, though it can take a couple of weeks.
      </p>
    );
  }

  return (
    <form className="auth-form submit-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Film title</span>
        <input name="title" type="text" required maxLength={200} />
      </label>
      <label className="field">
        <span>Year released</span>
        <input name="year" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="2019" />
      </label>
      <label className="field">
        <span>Your name</span>
        <input name="name" type="text" required maxLength={120} autoComplete="name" />
      </label>
      <label className="field">
        <span>Your email</span>
        <input name="email" type="email" required maxLength={200} autoComplete="email" />
      </label>
      <label className="field">
        <span>Your role on the film</span>
        <input name="role" type="text" maxLength={80} placeholder="Director, producer, distributor…" />
      </label>
      <label className="field">
        <span>Where we can watch it</span>
        <input name="link" type="text" maxLength={500} placeholder="A private screener link, with the password if it has one" />
      </label>
      <label className="field">
        <span>Who holds the streaming rights?</span>
        <input name="rights" type="text" maxLength={300} placeholder="You, a distributor, a sales agent…" />
      </label>
      <label className="field">
        <span>Anything else we should know</span>
        <textarea name="message" rows={4} maxLength={2000} />
      </label>
      {/* Hidden from people; bots fill it in. */}
      <input name="website" type="text" tabIndex={-1} autoComplete="off" className="visually-hidden" aria-hidden="true" />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "Sending…" : "Send submission"}
      </button>
    </form>
  );
}
