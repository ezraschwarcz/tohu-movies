import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Tohu Movies",
  description:
    "Privacy Policy for Tohu Movies: what we collect, how we use it, and the choices you have.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      meta="Last updated: November 11, 2026"
      intro="Tohu Movies is a free, ad-supported streaming service. We believe privacy should be simple to understand, so this policy explains in plain language what we collect, why we collect it, and the choices you have. If you have any questions, write to privacy@tohumovies.com."
      footerNote={
        <>
          See also our <Link href="/terms">Terms of Service</Link> and{" "}
          <Link href="/cookies">Cookie Notice</Link>.
        </>
      }
    >
      <h2>1. Who we are</h2>
      <p>
        Tohu Movies (“we”, “us”, “our”) is a free streaming service offering
        handpicked independent films. We are based in the United States. When
        this policy says “the Service”, it means tohumovies.com and any
        related pages we publish.
      </p>

      <h2>2. Information we collect</h2>
      <p>We collect only what is needed to run the Service.</p>
      <h3>2.1 Information you give us</h3>
      <ul>
        <li>
          <strong>Age confirmation.</strong> Some films are rated R. To watch
          one, we ask you to enter your date of birth or confirm that you are
          18 or older. Your date of birth is checked on your device and is
          never sent to our servers. We store only a flag on your device that
          you have passed the check.
        </li>
        <li>
          <strong>Film ratings.</strong> When you tap a star, your rating is
          stored in our database along with a random anonymous identifier
          generated in your browser. We do not ask for your name or email
          address, and we cannot link a rating to you.
        </li>
        <li>
          <strong>Messages you send us.</strong> If you write to
          privacy@tohumovies.com, we keep your message and your email address
          only for as long as needed to reply.
        </li>
      </ul>
      <h3>2.2 Information collected automatically</h3>
      <ul>
        <li>
          <strong>Usage and performance data.</strong> Our video host Mux and
          our video analytics provider Mux Data measure playback quality (for
          example, buffering, playback errors, and how much of a film was
          watched) so we can keep playback smooth. This data is tied to an
          anonymous viewer identifier, not to your identity.
        </li>
        <li>
          <strong>Advertising data.</strong> Our advertising partners Google
          AdSense and Google Ad Manager use cookies and similar identifiers
          to serve ads and to measure how they perform. See our{" "}
          <Link href="/cookies">Cookie Notice</Link> for details, and section
          7 below for your advertising choices.
        </li>
        <li>
          <strong>Server logs.</strong> Like almost every website, our
          hosting provider keeps short-term logs (such as IP address, browser
          type, and the page requested) for security and debugging. Logs are
          kept for a limited period and then deleted.
        </li>
      </ul>

      <h2>3. How we use information</h2>
      <p>We use the information above to:</p>
      <ul>
        <li>Stream films to you and keep playback working well.</li>
        <li>Show the average star rating for each film.</li>
        <li>
          Restrict R rated films to adults, as described in section 2.1.
        </li>
        <li>Serve ads so the Service can remain free.</li>
        <li>Reply to messages you send us.</li>
        <li>
          Detect abuse, protect the Service, and comply with legal
          obligations.
        </li>
      </ul>

      <h2>4. What we do not do</h2>
      <ul>
        <li>We do not sell your personal information.</li>
        <li>
          We do not require an account, a sign-in, or an email address to
          watch films.
        </li>
        <li>
          We do not build advertising profiles about you ourselves. Any
          ad-related identifiers are set by our advertising partners, as
          described in the Cookie Notice.
        </li>
        <li>
          We do not knowingly collect personal information from children
          under 13. The Service is intended for general audiences; R rated
          films are restricted to adults.
        </li>
      </ul>

      <h2>5. Information we share</h2>
      <p>
        We share limited information with the service providers that run the
        Service on our behalf:
      </p>
      <ul>
        <li>
          <strong>Mux</strong> (video hosting and playback analytics) and{" "}
          <strong>Mux Data</strong> (playback quality measurement).
        </li>
        <li>
          <strong>Google AdSense and Google Ad Manager</strong> (advertising
          and ad measurement).
        </li>
        <li>
          <strong>Vercel</strong> (website hosting) and{" "}
          <strong>Supabase</strong> (database hosting for film information and
          ratings).
        </li>
      </ul>
      <p>
        These providers process information only to provide their services to
        us. We may also disclose information if required by law or to protect
        the safety and rights of our users and the Service.
      </p>

      <h2>6. Cookies and similar technologies</h2>
      <p>
        We and our partners use cookies and local storage for the purposes
        described in this policy, including keeping your age confirmation and
        your own star ratings on your device, and serving and measuring ads.
        Our <Link href="/cookies">Cookie Notice</Link> explains each type and
        how to control them.
      </p>

      <h2>7. Your choices</h2>
      <ul>
        <li>
          <strong>Advertising.</strong> You can opt out of personalized
          advertising by visiting Google’s Ad Settings
          (myadcenter.google.com), by using the opt-out tools at
          youradchoices.com or the Network Advertising Initiative, or by
          adjusting your browser or device settings.
        </li>
        <li>
          <strong>Cookies.</strong> Most browsers let you block or delete
          cookies. Clearing your browser data also clears the age confirmation
          and your own star ratings stored on your device.
        </li>
        <li>
          <strong>Do Not Track.</strong> Our site does not currently respond
          to Do Not Track signals, but the advertising opt-outs above remain
          available to you.
        </li>
      </ul>

      <h2>8. How long we keep information</h2>
      <p>
        We keep film ratings and the anonymous identifiers attached to them
        only as long as needed to show average ratings. Server logs are kept
        for a short period and then deleted. Messages you send us are kept
        only as long as needed to reply.
      </p>

      <h2>9. Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect
        information, including encrypted connections (HTTPS) and access
        controls at our providers. No method of transmission or storage is
        completely secure, and we cannot guarantee absolute security.
      </p>

      <h2>10. Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct,
        or delete personal information about you, or to object to certain
        uses. Because the Service does not collect names, email addresses, or
        accounts, in most cases there is no personal information for us to
        retrieve. If you believe we hold information about you, write to
        privacy@tohumovies.com and we will respond.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this policy from time to time, for example when we add
        a feature or a service provider. When we do, we will update the “Last
        updated” date at the top of this page. Continued use of the Service
        after a change means you accept the updated policy.
      </p>

      <h2>Contact us</h2>
      <p>
        Tohu Movies — Privacy
        <br />
        Email: privacy@tohumovies.com
      </p>
    </LegalPage>
  );
}
