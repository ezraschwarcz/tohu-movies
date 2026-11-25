import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import JsonLd from "@/components/JsonLd";
import { LICENSOR, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ: free movies on Tohu, accounts and playback | Tohu Movies",
  description:
    "Answers about Tohu Movies: is it really free, is it legal, do I need an account, which devices work, and what to do if a film will not play.",
  alternates: { canonical: `${SITE_URL}/faq` },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is Tohu Movies really free?",
    a: "Yes. Every film is free to watch in full. There is no subscription, no trial and no card. Tohu is supported by advertising.",
  },
  {
    q: "Is it legal?",
    a: `Yes. Every film on Tohu is licensed to Tohu Entertainment, LLC for streaming by ${LICENSOR}.`,
  },
  {
    q: "Do I need an account?",
    a: "No. You can watch everything without one. A free account adds a watchlist, remembers where you stopped on any device, and lets you comment.",
  },
  {
    q: "How do I sign in? I do not have a password.",
    a: "Enter your email on the sign-in page and we send you a link and a 6-digit code. Either one signs you in. You can also continue with Google, and after your first sign-in you can turn on Face ID or fingerprint for one-tap sign-in.",
  },
  {
    q: "Which devices can I watch on?",
    a: "Any modern phone, tablet or computer with an up-to-date browser. On an iPhone, iPad or Mac you can send a film to an Apple TV with AirPlay from the player.",
  },
  {
    q: "A film will not play. What should I do?",
    a: "Reload the page first. If it still will not start, try a different browser or switch between Wi-Fi and mobile data, and turn off any ad blocker for tohumovies.com. If the problem stays, email hello@tohumovies.com with the film and your device.",
  },
  {
    q: "Why does the picture look soft at the start?",
    a: "The player matches picture quality to your connection. It usually sharpens within a few seconds. Films stream at up to 720p.",
  },
  {
    q: "Why am I asked my age on some films?",
    a: "R rated films ask once whether you are 17 or older. Your answer is kept on your device.",
  },
  {
    q: "How do comments work?",
    a: "Sign in to comment. New comments are reviewed before they appear. You can report a comment or block a member from the menu beside any comment.",
  },
  {
    q: "What emails will I get?",
    a: "Only sign-in emails, unless you choose more. The Friday Pick and new-film alerts are opt-in, and every one has an unsubscribe link. You can change your choices in your profile under Preferences.",
  },
  {
    q: "How do I delete my account?",
    a: "Open your profile, choose Preferences, and use Delete my account. It removes your account and everything tied to it.",
  },
  {
    q: "Can I suggest or submit a film?",
    a: "Yes. Email hello@tohumovies.com with the title and, if it is your film, how to reach you.",
  },
];

export default function FaqPage() {
  return (
    <LegalPage
      title="Frequently asked questions"
      meta="Watching, accounts and playback"
      intro="Short answers to the questions we hear most."
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      {FAQ.map((item) => (
        <section key={item.q}>
          <h2>{item.q}</h2>
          <p>{item.a}</p>
        </section>
      ))}
    </LegalPage>
  );
}
