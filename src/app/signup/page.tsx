import type { Metadata } from "next";
import SignupForm from "@/components/SignupForm";

export const metadata: Metadata = {
  title: "Create an account — Tohu Movies",
  description:
    "Create a Tohu Movies account to comment, save films to your watchlist, and pick up where you left off. Watching is free and needs no account.",
  robots: { index: false, follow: true },
};

/** Sign-up page. A server component: it reads the search params (where
 *  to go after sign-up) and passes them to the form, so the form renders
 *  in the initial HTML instead of waiting on JavaScript. */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <SignupForm next={params.next ?? "/"} />;
}
