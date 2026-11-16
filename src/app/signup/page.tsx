import type { Metadata } from "next";
import AuthFlow from "@/components/AuthFlow";

export const metadata: Metadata = {
  title: "Join free — Tohu Movies",
  description:
    "Join Tohu Movies free to comment, save films to your watchlist, and pick up where you left off. Watching is free and needs no account.",
  robots: { index: false, follow: true },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthFlow
      mode="signup"
      next={params.next ?? "/"}
      urlError={params.error ?? null}
      urlMessage={null}
    />
  );
}
