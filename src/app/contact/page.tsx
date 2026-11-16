import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Tohu Movies",
  description:
    "How to reach Tohu Movies: general questions, playback problems, film submissions, privacy requests and advertising.",
  alternates: { canonical: `${SITE_URL}/contact` },
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      meta="We read every message"
      intro="The quickest way to reach us is email. Tell us which film and which device if something is not working, and we can help much faster."
    >
      <h2>General questions and feedback</h2>
      <p>
        <a href="mailto:hello@tohumovies.com">hello@tohumovies.com</a>
      </p>
      <h2>A film will not play</h2>
      <p>
        Write to{" "}
        <a href="mailto:hello@tohumovies.com?subject=Playback%20problem">
          hello@tohumovies.com
        </a>{" "}
        with the film&apos;s name, your device (for example iPhone, or
        Chrome on Windows), and what you see. The{" "}
        <Link href="/faq">FAQ</Link> covers the common fixes.
      </p>
      <h2>Filmmakers, distributors and rights questions</h2>
      <p>
        To submit a film, or to raise a question about a film on Tohu, write
        to{" "}
        <a href="mailto:hello@tohumovies.com?subject=Film%20or%20rights%20question">
          hello@tohumovies.com
        </a>
        . Please include the title and your connection to it.
      </p>
      <h2>Privacy requests</h2>
      <p>
        To ask what we hold about you or to have it removed, write to{" "}
        <a href="mailto:privacy@tohumovies.com">privacy@tohumovies.com</a>.
        You can also delete your account yourself under Profile,
        Preferences. See the <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <h2>Advertising and partnerships</h2>
      <p>
        <a href="mailto:hello@tohumovies.com?subject=Advertising">
          hello@tohumovies.com
        </a>
      </p>
      <h2>Mail</h2>
      <p>
        Tohu Entertainment, LLC
        <br />
        9854 National Blvd. #302
        <br />
        Los Angeles, CA 90034
      </p>
    </LegalPage>
  );
}
