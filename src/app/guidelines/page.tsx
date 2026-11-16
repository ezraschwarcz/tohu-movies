import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Community Guidelines | Tohu Movies",
  description:
    "The rules for comments and profiles on Tohu Movies, how to report a problem, and what happens when the rules are broken.",
  alternates: { canonical: `${SITE_URL}/guidelines` },
};

export default function GuidelinesPage() {
  return (
    <LegalPage
      title="Community Guidelines"
      meta="Last updated: November 16, 2026"
      intro="Tohu is for people who like talking about films. These rules cover comments, replies, display names, bios and profile photos. They apply to everyone, including us."
    >
      <h2>1. Talk about the film, not the person</h2>
      <p>
        Disagree as strongly as you like about a film. Do not insult,
        threaten, harass or bully other members, and do not post about
        people&apos;s private lives.
      </p>
      <h2>2. No hate</h2>
      <p>
        No attacks on people for their race, ethnicity, national origin,
        religion, sex, gender identity, sexual orientation, age, disability
        or serious illness. No slurs, in comments, names or bios.
      </p>
      <h2>3. Keep it safe for a general audience</h2>
      <p>
        No sexually explicit material, no graphic violence beyond discussing
        what is in a film, nothing that sexualizes minors in any way, and no
        encouragement of self-harm or dangerous acts.
      </p>
      <h2>4. No spam, scams or advertising</h2>
      <p>
        No links to pirate sites, no promotion of products or channels, no
        repeated or off-topic posts, and no impersonating another person,
        a filmmaker, or Tohu.
      </p>
      <h2>5. Mark spoilers</h2>
      <p>
        If you reveal an ending or a twist, start your comment with
        &quot;Spoiler:&quot; so others can choose whether to read on.
      </p>
      <h2>6. Nothing illegal, and nothing that is not yours to share</h2>
      <p>
        Do not post anything unlawful, or anyone else&apos;s private
        information or copyrighted work. See our{" "}
        <Link href="/copyright">Copyright page</Link>.
      </p>
      <h2>How moderation works</h2>
      <ul>
        <li>New comments are reviewed before they appear.</li>
        <li>
          You can report any comment, or block a member so you no longer
          see what they post, from the menu beside the comment.
        </li>
        <li>
          Comments that break these rules are removed. Members who break
          them seriously or repeatedly are banned from commenting; they can
          still watch films.
        </li>
        <li>
          If you think a decision about your comment or account was wrong,
          write to{" "}
          <a href="mailto:hello@tohumovies.com?subject=Moderation%20appeal">
            hello@tohumovies.com
          </a>{" "}
          and a person will look again.
        </li>
      </ul>
      <h2>Under 13</h2>
      <p>
        Accounts are for people aged 13 and over. See the{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
