"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "../Avatar";
import { day, call, type Member, type MemberCounts } from "./shared";

const PAGE = 50;

export default function MembersTab({
  adminId,
  isSuperAdmin,
}: {
  adminId: string;
  isSuperAdmin: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "admins" | "banned">("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Member[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banning, setBanning] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [hide, setHide] = useState(true);
  const [counts, setCounts] = useState<MemberCounts | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCounts = useCallback(() => {
    call<MemberCounts>("admin_member_counts").then(setCounts, () => {});
  }, []);
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const load = useCallback(
    async (offset: number) => {
      try {
        const list = await call<Member[]>("admin_list_members", {
          p_search: query,
          p_filter: filter,
          p_limit: PAGE,
          p_offset: offset,
        });
        setRows((prev) => (offset === 0 || !prev ? list : [...prev, ...list]));
        setMore(list.length === PAGE);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [query, filter],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void load(0), query ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, query]);

  async function run(id: string, fn: string, args: Record<string, unknown>) {
    setBusyId(id);
    try {
      await call(fn, args);
      setBanning(null);
      setReason("");
      setNotice(null);
      await load(0);
      loadCounts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  /** Access changes go through the site's own endpoint, which makes the
   *  change (the database decides whether it is allowed) and sends the
   *  notification emails. */
  async function setRole(m: Member, role: "member" | "admin" | "super_admin") {
    const who = m.display_name || m.email;
    const question =
      role === "super_admin"
        ? `Make ${who} a super admin?\n\nThey will be able to give admin access to others, and this cannot be undone from the site: a super admin's access can only be changed by hand in the database.`
        : role === "admin"
          ? `Make ${who} an admin?\n\nThey will be able to add, edit and hide films, review comments and ban members. They and every super admin will be emailed.`
          : `Remove admin access from ${who}?\n\nThey and every super admin will be emailed.`;
    if (!window.confirm(question)) return;
    setBusyId(m.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: m.id, role }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "The change was not made.");
      }
      setNotice(data.message ?? "Done.");
      await load(0);
      loadCounts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const filters = ["all", "admins", "banned"] as const;

  return (
    <div className="cr-stack">
      <div className="cr-bar">
        <div className="cr-chips" role="group" aria-label="Show members">
          {filters.map((f) => (
            <button key={f} type="button" className={`cr-chip${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input type="search" className="cr-search" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search members" />
      </div>
      {counts ? (
        <p className="cr-counts" aria-live="polite">
          <strong>{counts.total.toLocaleString("en-US")}</strong> member{counts.total === 1 ? "" : "s"}
          <span>+{counts.new_7d.toLocaleString("en-US")} this week</span>
          <span>
            {counts.admins} admin{counts.admins === 1 ? "" : "s"}
            {counts.super_admins ? ` (${counts.super_admins} super)` : ""}
          </span>
          <span>{counts.banned} banned</span>
        </p>
      ) : null}
      <p className="form-note">
        A banned member can still watch, but cannot comment, like, or change their public profile. Only a super admin can give admin access. Any admin can remove a regular admin. A super admin&apos;s access cannot be changed from the site. Every change is emailed to the member and to all super admins, and is kept in the Log.
      </p>
      {notice ? (
        <p className="form-note" role="status">
          {notice}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {rows === null && !error ? <p className="cr-loading">Loading…</p> : null}
      {rows && rows.length === 0 ? <p className="cr-empty">No members match.</p> : null}
      {rows && rows.length > 0 ? (
        <ul className="cr-list">
          {rows.map((m) => {
            const me = m.id === adminId;
            return (
              <li key={m.id} className="cr-item cr-member">
                <Avatar preset={m.avatar_preset} url={m.avatar_url} name={m.display_name || m.email} size={40} />
                <div className="cr-item-main">
                  <p className="cr-item-title">
                    {m.display_name || "No name yet"}
                    {me ? <span className="cr-pill">You</span> : null}
                    {m.is_super_admin ? (
                      <span className="cr-pill ok">Super admin</span>
                    ) : m.is_admin ? (
                      <span className="cr-pill ok">Admin</span>
                    ) : null}
                    {m.is_banned ? <span className="cr-pill warn">Banned</span> : null}
                  </p>
                  <p className="cr-muted">
                    {m.email} · joined {day(m.created_at)} · last sign-in {day(m.last_sign_in_at)} · {m.comments} comment{m.comments === 1 ? "" : "s"}
                  </p>
                  {m.is_banned && m.banned_reason ? <p className="cr-muted">Reason: {m.banned_reason}</p> : null}
                  {banning === m.id ? (
                    <div className="cr-ban">
                      <label className="field">
                        <span>Reason (only admins see it)</span>
                        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus />
                      </label>
                      <label className="toggle-row">
                        <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
                        <span>Also take down their existing comments</span>
                      </label>
                      <div className="cr-item-actions">
                        <button
                          type="button"
                          className="btn-ghost danger"
                          disabled={busyId === m.id}
                          onClick={() => void run(m.id, "admin_set_banned", { p_user: m.id, p_banned: true, p_reason: reason, p_hide_comments: hide })}
                        >
                          Confirm ban
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => setBanning(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                {!me && banning !== m.id ? (
                  <div className="cr-item-actions">
                    <Link className="btn-ghost" href={`/u/${m.id}`} target="_blank">
                      Profile
                    </Link>
                    {m.is_banned ? (
                      <button type="button" className="btn-ghost" disabled={busyId === m.id} onClick={() => void run(m.id, "admin_set_banned", { p_user: m.id, p_banned: false })}>
                        Lift ban
                      </button>
                    ) : !m.is_admin ? (
                      <button type="button" className="btn-ghost danger" onClick={() => { setBanning(m.id); setReason(""); setHide(true); }}>
                        Ban
                      </button>
                    ) : null}
                    {m.is_super_admin ? null : m.is_admin ? (
                      <>
                        {isSuperAdmin ? (
                          <button type="button" className="btn-ghost" disabled={busyId === m.id} onClick={() => void setRole(m, "super_admin")}>
                            Make super admin
                          </button>
                        ) : null}
                        <button type="button" className="btn-ghost" disabled={busyId === m.id} onClick={() => void setRole(m, "member")}>
                          Remove admin
                        </button>
                      </>
                    ) : isSuperAdmin && !m.is_banned ? (
                      <button type="button" className="btn-ghost" disabled={busyId === m.id} onClick={() => void setRole(m, "admin")}>
                        Make admin
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
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

/* --------------------------------- Log -------------------------------- */
