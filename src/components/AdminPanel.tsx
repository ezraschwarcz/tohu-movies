"use client";

import { useState } from "react";
import OverviewTab from "./admin/OverviewTab";
import FilmsTab from "./admin/FilmsTab";
import InsightsTab from "./admin/InsightsTab";
import CommentsTab from "./admin/CommentsTab";
import MembersTab from "./admin/MembersTab";
import LogTab from "./admin/LogTab";
import EmailsTab from "./admin/EmailsTab";
import ToolsTab from "./admin/ToolsTab";
import type { Tab } from "./admin/shared";

/** The admin control room. Each tab lives in its own file in ./admin:
 *
 *  - Overview: the numbers that matter and what admins did lately.
 *  - Films: add, edit, hide, delete, upload cover art, with a check
 *    that everything search engines and share cards need is filled in.
 *  - Comments: approve, reject, delete; search every comment.
 *  - Members: counts, search, ban and unban. Super admins give admin
 *    access; any admin can remove a regular admin; a super admin's
 *    access cannot be changed from the site.
 *  - Log: everything admins did, newest first. Read-only.
 *  - Tools: the email check.
 *
 *  Every action goes through a database function that checks the
 *  caller is an admin (supabase/migrations/20261116_control_room.sql),
 *  so nothing here can be done by anyone else, whatever the page shows. */

export default function AdminPanel({
  adminId,
  isSuperAdmin = false,
}: {
  adminId: string;
  isSuperAdmin?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, setPending] = useState<number | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "insights", label: "Insights" },
    { id: "films", label: "Films" },
    { id: "comments", label: "Comments" },
    { id: "members", label: "Members" },
    { id: "emails", label: "Emails" },
    { id: "log", label: "Log" },
    { id: "tools", label: "Tools" },
  ];

  return (
    <div className="cr">
      <div className="cr-tabs" role="tablist" aria-label="Control room sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`cr-tab${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "comments" && pending ? (
              <span className="cr-badge">{pending}</span>
            ) : null}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <OverviewTab onPending={setPending} goTo={setTab} />
      ) : null}
      {tab === "insights" ? <InsightsTab /> : null}
      {tab === "films" ? <FilmsTab /> : null}
      {tab === "comments" ? <CommentsTab onPending={setPending} /> : null}
      {tab === "members" ? (
        <MembersTab adminId={adminId} isSuperAdmin={isSuperAdmin} />
      ) : null}
      {tab === "emails" ? <EmailsTab /> : null}
      {tab === "log" ? <LogTab /> : null}
      {tab === "tools" ? <ToolsTab /> : null}
    </div>
  );
}

/* ------------------------------ Overview ------------------------------ */
