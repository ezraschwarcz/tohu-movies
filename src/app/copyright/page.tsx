import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Copyright and takedown requests | Tohu Movies",
  description:
    "How rights holders can report a copyright concern about a film or other content on Tohu Movies, and what a notice needs to include.",
  alternates: { canonical: `${SITE_URL}/copyright` },
};

export default function CopyrightPage() {
  return (
    <LegalPage
      title="Copyright and takedown requests"
      meta="Last updated: November 16, 2026"
      intro="Every film on Tohu Movies is licensed for streaming. If you believe a film, image, or member comment on Tohu infringes your copyright, tell us and we will act on it promptly."
    >
      <h2>How to send a notice</h2>
      <p>
        Email{" "}
        <a href="mailto:hello@tohumovies.com?subject=Copyright%20notice">
          hello@tohumovies.com
        </a>{" "}
        with the subject &quot;Copyright notice&quot;, or write to:
      </p>
      <p>
        Copyright Agent
        <br />
        Tohu Entertainment, LLC
        <br />
        9854 National Blvd. #302
        <br />
        Los Angeles, CA 90034
      </p>
      <h2>What to include</h2>
      <ul>
        <li>The work you own or represent (for example the film&apos;s title and year).</li>
        <li>
          Where it appears on Tohu: the page address, such as
          tohumovies.com/films/example.
        </li>
        <li>Your name, company if any, email address, phone number and postal address.</li>
        <li>
          A statement that you believe in good faith that the use is not
          authorized by the copyright owner, its agent, or the law.
        </li>
        <li>
          A statement that the information in your notice is accurate and,
          under penalty of perjury, that you are the owner or are
          authorized to act for the owner.
        </li>
        <li>Your physical or electronic signature (typing your full name is enough).</li>
      </ul>
      <h2>What happens next</h2>
      <p>
        We review every complete notice. Where it is valid, we remove or
        disable the material and, if it was posted by a member, tell that
        member. Accounts of members who repeatedly infringe are closed.
      </p>
      <h2>Counter-notice</h2>
      <p>
        If your material was removed and you believe that was a mistake or
        a misidentification, you can reply to the same address with: what
        was removed and where it was, a statement under penalty of perjury
        that you believe in good faith it was removed by mistake, your
        name, address and phone number, your consent to the jurisdiction of
        the federal court for your district (or, outside the United States,
        for Los Angeles, California), and your signature.
      </p>
      <h2>Licensing questions</h2>
      <p>
        If you are a filmmaker or distributor and have a question about how
        your title is licensed or presented on Tohu, write to the same
        address; a notice is not required to start a conversation.
      </p>
    </LegalPage>
  );
}
