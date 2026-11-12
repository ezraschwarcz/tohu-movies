import type { Metadata } from "next";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set a new password — Tohu Movies",
  description:
    "Set a new password for your Tohu Movies account after requesting a password reset.",
  robots: { index: false, follow: true },
};

/** Set a new password after a reset link. The reset email points at
 *  /auth/callback?next=/auth/reset-password, which exchanges the code
 *  for a recovery session and lands here. The form is a client
 *  component because it reads the session from the browser client. */
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
