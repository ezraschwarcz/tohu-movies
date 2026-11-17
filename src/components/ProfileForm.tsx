"use client";

import { useProfileSettings, type ProfileProps } from "./profile/useProfileSettings";
import ProfileMenu from "./profile/ProfileMenu";
import CompleteView from "./profile/CompleteView";
import NameView from "./profile/NameView";
import AvatarView from "./profile/AvatarView";
import SecurityView from "./profile/SecurityView";
import AdminView from "./profile/AdminView";
import PreferencesView from "./profile/PreferencesView";
import ActivityView from "./profile/ActivityView";


/** Profile: display name, email, preferences, your activity, passkeys,
 *  and sign out. Ratings are anonymous per browser (voter id in
 *  localStorage), so "films you rated" means films rated on this device.
 *
 *  The display name saves to profiles.display_name. The update policy
 *  lets a user update only their own row, and is_admin can never be
 *  changed this way (the policy's WITH CHECK blocks self-promotion).
 *  The "Hide R rated films" toggle is a per-browser preference in
 *  localStorage, shared with the home grid through the site context.
 *
 *  Each screen is its own file in ./profile; their shared state and save
 *  actions live in ./profile/useProfileSettings. */
export default function ProfileForm(props: ProfileProps) {
  const s = useProfileSettings(props);
  const { isAdmin, setView, view, viewTitles } = s;
  return (
    <div className="auth-wrap profile-hub">
      {view === "menu" ? (
        <ProfileMenu s={s} />
      ) : (
        <>
          <button
            type="button"
            className="profile-back"
            onClick={() => setView("menu")}
          >
            <span aria-hidden="true">‹</span> Profile
          </button>
          <h1 className="profile-view-title">{viewTitles[view]}</h1>
          <div className="profile-card">
            {view === "complete" ? <CompleteView s={s} /> : null}
            {view === "name" ? <NameView s={s} /> : null}
            {view === "avatar" ? <AvatarView s={s} /> : null}
            {view === "security" ? <SecurityView s={s} /> : null}
            {view === "admin" && isAdmin ? <AdminView /> : null}
            {view === "preferences" ? <PreferencesView s={s} /> : null}
            {view === "activity" ? <ActivityView s={s} /> : null}
          </div>
        </>
      )}
    </div>
  );
}
