import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { getFilms } from "@/lib/films";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Tohu Movies",
  description:
    "Tohu Movies is a free streaming home for independent film: licensed feature films and documentaries, no subscription and no sign-up needed.",
  alternates: { canonical: `${SITE_URL}/about` },
};

export default async function AboutPage() {
  let count = 0;
  try {
    count = (await getFilms()).length;
  } catch {
    // shown without the number
  }
  return (
    <LegalPage
      title="About Tohu Movies"
      meta="Free independent film"
      intro="Tohu Movies is a free streaming home for independent film. Press play and watch: there is no subscription, no card, and no account needed."
    >
      <h2>What you will find here</h2>
      <p>
        {count > 0 ? `${count} feature films and documentaries` : "Feature films and documentaries"}{" "}
        across horror, comedy, drama, romance, family, sport and more. They
        are independent productions, many with actors you will recognize,
        that deserve a bigger audience than they got. Every film on Tohu is
        licensed for streaming.
      </p>
      <h2>How it is free</h2>
      <p>
        Tohu is supported by advertising. That is what lets every film stay
        free for everyone, with nothing to sign up for and nothing to
        cancel.
      </p>
      <h2>Accounts are optional</h2>
      <p>
        You never need an account to watch. A free account adds a watchlist,
        lets you pick up where you left off on any device, and lets you
        comment and reply to other viewers. You can{" "}
        <Link href="/signup">join with just an email</Link>, and delete your
        account at any time from your profile.
      </p>
      <h2>For filmmakers and rights holders</h2>
      <p>
        If you made or represent a film and would like it on Tohu, or you
        have a question about a title that is already here, write to{" "}
        <a href="mailto:hello@tohumovies.com">hello@tohumovies.com</a>.
      </p>
      <h2>Who runs Tohu</h2>
      <p>
        Tohu Movies is operated by Tohu Entertainment, LLC, 9854 National
        Blvd. #302, Los Angeles, CA 90034. See the{" "}
        <Link href="/contact">contact page</Link> for how to reach us.
      </p>
    </LegalPage>
  );
}
