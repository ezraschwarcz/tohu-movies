"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { call } from "./shared";

type FunnelCounts = { open?: number; play?: number; q25?: number; q50?: number; q75?: number; done?: number };
type Insights = {
  days: number;
  viewing: FunnelCounts;
  films: ({ slug: string; title: string } & Required<FunnelCounts>)[];
  signup: Record<string, number>;
  new_accounts: number;
};

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="cr-funnel">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : 0;
        const kept = i > 0 && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label}>
            <span className="cr-funnel-label">{s.label}</span>
            <span className="cr-funnel-track">
              <span className="cr-funnel-bar" style={{ width: `${Math.max(1, (s.value / top) * 100)}%` }} />
            </span>
            <span className="cr-funnel-value">
              {s.value.toLocaleString("en-US")}
              {kept !== null ? <small>{Math.min(kept, 999)}% of step before</small> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function InsightsTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    call<Insights>("admin_insights", { p_days: days })
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e: Error) => !cancelled && setError(e.message.replace("control-room database update. Run the file supabase/migrations/20261116_control_room.sql", "insights database update. Run the file supabase/migrations/20261117_insights_safety.sql")));
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (error) return <p className="form-error">{error}</p>;
  if (!data) return <p className="cr-loading">Loading…</p>;
  const v = data.viewing;
  const s = data.signup;
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");

  return (
    <div className="cr-stack">
      <div className="cr-chips" role="group" aria-label="Period">
        {[7, 30, 90].map((d) => (
          <button key={d} type="button" className={`cr-chip${days === d ? " on" : ""}`} onClick={() => setDays(d)}>
            Last {d} days
          </button>
        ))}
      </div>

      <section>
        <h3 className="cr-h3">Viewing funnel, all films</h3>
        <Funnel
          steps={[
            { label: "Film page opened", value: v.open ?? 0 },
            { label: "Play pressed", value: v.play ?? 0 },
            { label: "Watched 25%", value: v.q25 ?? 0 },
            { label: "Watched 50%", value: v.q50 ?? 0 },
            { label: "Watched 75%", value: v.q75 ?? 0 },
            { label: "Finished", value: v.done ?? 0 },
          ]}
        />
        <p className="form-note">
          Counted once per film per visit, starting from the day this was switched on. Totals only; no record of who watched.
        </p>
      </section>

      <section>
        <h3 className="cr-h3">By film</h3>
        {data.films.length === 0 ? (
          <p className="cr-empty">Nothing recorded yet. Numbers appear as people open and watch films.</p>
        ) : (
          <div className="cr-table-wrap">
            <table className="cr-table">
              <thead>
                <tr>
                  <th>Film</th>
                  <th>Opened</th>
                  <th>Played</th>
                  <th>Play rate</th>
                  <th>25%</th>
                  <th>50%</th>
                  <th>75%</th>
                  <th>Finished</th>
                  <th>Finish rate</th>
                </tr>
              </thead>
              <tbody>
                {data.films.map((f) => (
                  <tr key={f.slug}>
                    <td>
                      <Link href={`/films/${f.slug}`}>{f.title}</Link>
                    </td>
                    <td>{f.open}</td>
                    <td>{f.play}</td>
                    <td>{pct(f.play, f.open)}</td>
                    <td>{f.q25}</td>
                    <td>{f.q50}</td>
                    <td>{f.q75}</td>
                    <td>{f.done}</td>
                    <td>{pct(f.done, f.play)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="form-note">
          Play rate is plays out of page opens: a low one points at the cover art or synopsis. Finish rate is finishes out of plays: where the numbers drop between 25, 50 and 75 percent is where viewers leave, and ad breaks belong before that point.
        </p>
      </section>

      <section>
        <h3 className="cr-h3">Sign-up funnel</h3>
        <Funnel
          steps={[
            { label: "Opened the sign-in page", value: s.page_open ?? 0 },
            { label: "Asked for an email code", value: s.code_requested ?? 0 },
            { label: "Entered the code", value: s.code_verified ?? 0 },
            { label: "Finished the welcome step", value: s.welcome_done ?? 0 },
          ]}
        />
        <p className="form-note">
          New accounts in this period: {data.new_accounts.toLocaleString("en-US")}. Started with Google: {(s.google_started ?? 0).toLocaleString("en-US")}. Skipped the welcome step: {(s.welcome_skipped ?? 0).toLocaleString("en-US")}. The first three steps include returning members signing in, and a code step is not counted when someone taps the link in the email instead.
        </p>
      </section>
    </div>
  );
}
