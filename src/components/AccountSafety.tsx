"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Blocked members and Delete my account, at the bottom of
 *  Preferences. Deleting is permanent and is done by a database
 *  function that removes the member's comments, likes, watchlist,
 *  progress, email choices and profile, then the account itself. */
export default function AccountSafety({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const [blocked, setBlocked] = useState<{ id: string; name: string }[] | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getBrowserSupabase();
      const { data, error: err } = await supabase
        .from("member_blocks")
        .select("blocked_id")
        .eq("blocker_id", userId);
      if (cancelled || err || !data) return;
      const ids = (data as { blocked_id: string }[]).map((r) => r.blocked_id);
      if (ids.length === 0) {
        setBlocked([]);
        return;
      }
      const names = await supabase.from("profiles").select("id,display_name").in("id", ids);
      if (cancelled) return;
      const byId = new Map(
        ((names.data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]),
      );
      setBlocked(ids.map((id) => ({ id, name: byId.get(id) ?? "A member" })));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function unblock(id: string) {
    const { error: err } = await getBrowserSupabase()
      .from("member_blocks")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", id);
    if (!err) setBlocked((prev) => (prev ?? []).filter((b) => b.id !== id));
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    try {
      // The photo is a file, which the database function cannot remove.
      await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`]);
    } catch {
      // No photo, or storage unavailable: carry on.
    }
    const { error: err } = await supabase.rpc("delete_my_account");
    if (err) {
      setBusy(false);
      setError(
        /could not find the function/i.test(err.message)
          ? "Account deletion is not switched on yet. Please contact us and we will delete it for you."
          : err.message,
      );
      return;
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // The account is gone; the session is already invalid.
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full reload on purpose: nothing of the deleted account may stay in memory
    window.location.assign("/?account=deleted");
  }

  return (
    <>
      {blocked && blocked.length > 0 ? (
        <div className="safety-block">
          <h3 className="profile-h3">Blocked members</h3>
          <p className="profile-line">You do not see comments from these members.</p>
          <ul className="profile-list">
            {blocked.map((b) => (
              <li key={b.id} className="profile-row">
                <span>{b.name}</span>
                <button type="button" className="linklike" onClick={() => void unblock(b.id)}>
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="safety-block">
        <h3 className="profile-h3">Delete my account</h3>
        {isAdmin ? (
          <p className="profile-line">
            Admin accounts cannot be deleted here. Have your admin access
            removed first.
          </p>
        ) : !open ? (
          <>
            <p className="profile-line">
              Permanently removes your account, profile, comments, likes,
              watchlist and viewing progress. This cannot be undone.
            </p>
            <button type="button" className="btn-ghost danger" onClick={() => setOpen(true)}>
              Delete my account…
            </button>
          </>
        ) : (
          <>
            <label className="field">
              <span>Type DELETE to confirm</span>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
              />
            </label>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="safety-actions">
              <button
                type="button"
                className="btn-ghost danger"
                disabled={busy || confirmText.trim().toUpperCase() !== "DELETE"}
                onClick={() => void deleteAccount()}
              >
                {busy ? "Deleting…" : "Delete my account for good"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => { setOpen(false); setConfirmText(""); }}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
