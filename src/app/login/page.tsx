import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Tohu Movies",
  description:
    "Sign in to Tohu Movies to comment, save films to your watchlist, and pick up where you left off. Watching is free and needs no account.",
  robots: { index: false, follow: true },
};

/** Sign in page. A server component: it reads the search params
 *  (where to go after sign-in, any error from the auth callback, and a
 *  success note such as after a password reset) and passes them to the
 *  form, so the form renders in the initial HTML instead of waiting on
 *  JavaScript. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <LoginForm
      next={params.next ?? "/"}
      urlError={params.error ?? null}
      urlMessage={params.message ?? null}
    />
  );
}
