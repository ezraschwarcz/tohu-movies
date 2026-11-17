"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { day, call, type Tab, type Overview } from "./shared";

export default function OverviewTab({
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
