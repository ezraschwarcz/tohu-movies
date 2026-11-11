import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Notice | Tohu Movies",
  description:
    "Cookie Notice for Tohu Movies: which cookies and local storage we and our partners use, and how to control them.",
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Notice"
      meta="Last updated: November 11, 2026"
      intro="This Cookie Notice explains how Tohu Movies and our partners use cookies and similar technologies — including browser local storage — when you use tohumovies.com. It should be read with our Privacy Policy. If you have any questions, write to privacy@tohumovies.com."
      footerNote={
        <>
          See also our <Link href="/privacy">Privacy Policy</Link> and{" "}
          <Link href="/terms">Terms of Service</Link>.
        </>
      }
    >
      <h2>1. What cookies and local storage are</h2>
      <p>
        A cookie is a small text file that a website stores on your device.
        Local storage is a similar place in your browser where a website can
        store small pieces of information. Both let a site remember things
        between visits — for example, that you have confirmed you are 18 or
        older, or the star ratings you gave — without asking you again.
      </p>

      <h2>2. How we use them</h2>
      <p>We and our partners use cookies and local storage for:</p>
      <ul>
        <li>
          <strong>Keeping the Service working.</strong> Remembering your age
          confirmation and your own star ratings on your device.
        </li>
        <li>
          <strong>Measuring playback.</strong> Our video provider Mux and its
          Mux Data analytics measure playback quality (such as buffering and
          errors) so we can keep films playing smoothly.
        </li>
        <li>
          <strong>Advertising.</strong> Our advertising partners Google
          AdSense and Google Ad Manager use cookies and similar identifiers
          to show ads, to limit how often you see the same ad, and to measure
          how ads perform. They may use information about your visits to this
          and other sites to show ads that are more relevant to you.
        </li>
      </ul>

      <h2>3. The types we use</h2>
      <h3>Strictly necessary</h3>
      <p>
        These are needed for the Service to work at all. They include the
        local storage flags that remember your age confirmation and your own
        star ratings. Because they are stored only on your device and are not
        sent to us, clearing your browser data removes them.
      </p>
      <h3>Performance and analytics</h3>
      <p>
        Mux Data measures playback quality using an anonymous viewer
        identifier. This helps us find and fix playback problems. It does not
        identify you by name or email address.
      </p>
      <h3>Advertising</h3>
      <p>
        Google AdSense and Google Ad Manager set cookies and use advertising
        identifiers to serve ads and to measure their performance. These may
        be used for personalized advertising unless you opt out (see section
        4 below). Google’s own policies explain how it uses this information;
        see Google’s Privacy and Terms at policies.google.com/technologies.
      </p>

      <h2>4. Your choices</h2>
      <ul>
        <li>
          <strong>Browser settings.</strong> Most browsers let you block or
          delete cookies, and clear local storage. Blocking strictly necessary
          storage may mean you are asked to confirm your age again, and your
          own star ratings may not be remembered.
        </li>
        <li>
          <strong>Advertising opt-out.</strong> You can opt out of
          personalized advertising from Google by visiting Google’s Ad
          Settings (myadcenter.google.com). You can also opt out of
          personalized ads from many providers at youradchoices.com and at
          the Network Advertising Initiative (optout.networkadvertising.org).
        </li>
        <li>
          <strong>Device settings.</strong> On a mobile device you can reset
          your advertising identifier or limit ad tracking in your device’s
          privacy settings.
        </li>
        <li>
          <strong>Do Not Track.</strong> Our site does not currently respond
          to Do Not Track signals, but the advertising opt-outs above remain
          available to you.
        </li>
      </ul>

      <h2>5. Third-party cookies</h2>
      <p>
        Some cookies are set by third parties whose services we use — in
        particular Google (AdSense and Ad Manager) and Mux (video hosting and
        Mux Data analytics). We do not control those cookies, and this notice
        does not cover how those third parties use them. Please check their
        own privacy policies for details.
      </p>

      <h2>6. How long cookies last</h2>
      <p>
        How long a cookie lasts depends on its type. Session cookies expire
        when you close your browser. Persistent cookies and local storage
        entries stay on your device until they expire or you delete them. The
        advertising cookies set by our partners have their own lifetimes,
        which are set by those partners.
      </p>

      <h2>7. Changes to this notice</h2>
      <p>
        We may update this notice from time to time, for example when we add
        a feature or a service provider. When we do, we will update the “Last
        updated” date at the top of this page. Continued use of the Service
        after a change means you accept the updated notice.
      </p>

      <h2>Contact us</h2>
      <p>
        Tohu Movies
        <br />
        Email: privacy@tohumovies.com
      </p>
    </LegalPage>
  );
}
