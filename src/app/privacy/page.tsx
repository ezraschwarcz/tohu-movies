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
      meta="Last updated: November 15, 2026"
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
          generated in your browser. Ratings are not connected to an
          account, and we cannot link a rating to you.
        </li>
        <li>
          <strong>Account information (optional).</strong> You never need
          an account to watch. If you choose to create one, we collect your
          email address and the display name you pick. If you set a
          password, it is stored in protected (hashed) form by our
          authentication provider and we cannot read it. You may also add
          a profile photo or avatar and choose favorite genres.
        </li>
        <li>
          <strong>Comments.</strong> If you post a comment while signed in,
          we store its text. Once approved, it is shown publicly on the
          film&apos;s page with your display name and profile photo. Likes
          you give to comments are stored with your account.
        </li>
        <li>
          <strong>Watchlist and viewing progress.</strong> If you are
          signed in, we store the films you save to your watchlist and how
          far you have watched a film, so you can pick up where you left
          off on any device. Only you can see these.
        </li>
        <li>
          <strong>Email choices.</strong> We store which optional emails
          you have asked to receive (see section 6).
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
          <strong>View counts.</strong> When a film has played for about 30
          seconds, we record one view of that film so we can show which
          films are popular. If you are signed in, the view is stored with
          your account identifier; otherwise it is stored with no
          identifier at all. Only totals are ever shown.
        </li>
        <li>
          <strong>Visit statistics.</strong> We use Vercel Web Analytics to
          count visits and see which pages are popular, which sites send us
          visitors, and what kinds of devices are used. It does not use
          cookies and is not used to identify you.
        </li>
        <li>
          <strong>Advertising data.</strong> Our advertising partners Google
          AdSense and Google Ad Manager use cookies and similar identifiers
          to serve ads and to measure how they perform. See our{" "}
          <Link href="/cookies">Cookie Notice</Link> for details, and section
          8 below for your advertising choices.
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
          Provide account features you choose to use: your profile,
          comments, watchlist, and continue watching.
        </li>
        <li>
          Send you emails: account emails you request, and optional emails
          only if you opt in (see section 6).
        </li>
        <li>Understand which films and pages are popular.</li>
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
          <strong>Vercel</strong> (website hosting and visit statistics) and{" "}
          <strong>Supabase</strong> (sign-in, and database hosting for film
          information, ratings, accounts, comments, watchlists, and viewing
          progress).
        </li>
        <li>
          <strong>Resend</strong> (email delivery). If you have an account,
          Resend receives your email address and the content of each email
          in order to deliver it.
        </li>
      </ul>
      <p>
        These providers process information only to provide their services to
        us. We may also disclose information if required by law or to protect
        the safety and rights of our users and the Service.
      </p>

      <h2>6. Emails we send</h2>
      <p>We only email people who have created an account.</p>
      <ul>
        <li>
          <strong>Account emails.</strong> Messages you ask for or that
          your account needs to work: confirming your email address,
          sign-in links, password resets, and a one-time welcome message.
        </li>
        <li>
          <strong>Optional emails.</strong> A weekly film recommendation
          and alerts about newly added films are sent only if you opt in.
          Emails about activity on your own comments and reminders about
          films you started can be switched off at any time.
        </li>
      </ul>
      <p>
        Every optional email includes an unsubscribe link that works
        without signing in, and you can change all of your email choices
        in your profile under Preferences.
      </p>

      <h2>7. Cookies and similar technologies</h2>
      <p>
        We and our partners use cookies and local storage for the purposes
        described in this policy, including keeping you signed in, keeping
        your age confirmation, your own star ratings, and your player
        settings on your device, and serving and measuring ads.
        Our <Link href="/cookies">Cookie Notice</Link> explains each type and
        how to control them.
      </p>

      <h2>8. Your choices</h2>
      <ul>
        <li>
          <strong>Your account.</strong> You can change your display name,
          photo, favorite genres, and email choices in your profile at any
          time. To delete your account and the information stored with it,
          write to privacy@tohumovies.com from the email address on the
          account.
        </li>
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

      <h2>9. How long we keep information</h2>
      <p>
        We keep film ratings and the anonymous identifiers attached to them
        only as long as needed to show average ratings. Account information,
        comments, watchlists, viewing progress, and email choices are kept
        until you delete them or ask us to delete your account. View records
        are kept so we can show which films are popular. Server logs are kept
        for a short period and then deleted. Messages you send us are kept
        only as long as needed to reply.
      </p>

      <h2>10. Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect
        information, including encrypted connections (HTTPS) and access
        controls at our providers. No method of transmission or storage is
        completely secure, and we cannot guarantee absolute security.
      </p>

      <h2>11. Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct,
        or delete personal information about you, or to object to certain
        uses. If you watch without an account, we hold very little that can
        be linked to you. If you have an account, you can see and change
        most of your information in your profile. For anything else,
        including a copy of your information or deleting your account, write
        to privacy@tohumovies.com and we will respond.
      </p>

      <h2>12. Changes to this policy</h2>
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
