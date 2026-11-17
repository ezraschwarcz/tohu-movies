"use client";

import { useCallback, useEffect, useState } from "react";
import { call, type LogRow } from "./shared";

export default function LogTab() {
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

/* ------------------------------- Emails ------------------------------- */
