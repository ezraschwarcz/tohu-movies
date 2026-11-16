import type { Metadata } from "next";
import AuthFlow from "@/components/AuthFlow";

export const metadata: Metadata = {
  title: "Sign in — Tohu Movies",
  description:
    "Sign in to Tohu Movies to comment, save films to your watchlist, and pick up where you left off. Watching is free and needs no account.",
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthFlow
      mode="signin"
      next={params.next ?? "/"}
      urlError={params.error ?? null}
      urlMessage={params.message ?? null}
    />
  );
}
