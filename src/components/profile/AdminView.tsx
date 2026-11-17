"use client";

import Link from "next/link";

export default function AdminView() {
  return (
    <>
        <section aria-label="Admin" id="admin">
          <h2 className="profile-h2">Admin</h2>
          <p className="profile-line">
            <Link href="/admin">Open the admin panel</Link> to moderate
            comments and add films.
          </p>
        </section>
    </>
  );
}
