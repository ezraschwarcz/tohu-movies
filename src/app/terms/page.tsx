import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service | Tohu Movies",
  description:
    "Terms of Service for Tohu Movies: the rules for using the service, and the limits of what we promise.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      meta="Last updated: November 9, 2026"
      intro="These Terms of Service (“Terms”) govern your use of tohumovies.com (the “Service”). By using the Service, you agree to these Terms. If you do not agree, please do not use the Service. If you have any questions, write to privacy@tohumovies.com."
      footerNote={
        <>
          See also our <Link href="/privacy">Privacy Policy</Link> and{" "}
          <Link href="/cookies">Cookie Notice</Link>.
        </>
      }
    >
      <h2>1. What the Service is</h2>
      <p>
        Tohu Movies is a free, ad-supported streaming service offering
        handpicked independent films. Watching films on the Service is free.
        We may change, add, or remove films, features, or pages at any time
        without notice.
      </p>

      <h2>2. Who can use the Service</h2>
      <p>
        You must be at least 13 years old to use the Service, or have a
        parent or guardian’s permission. Some films are rated R and are
        restricted to viewers 18 or older. To watch an R rated film, you will
        be asked to enter your date of birth or to confirm that you are 18 or
        older. Your date of birth is checked on your device and is never sent
        to us.
      </p>

      <h2>3. What you can do with films</h2>
      <p>
        You may watch films on the Service for your own personal,
        non-commercial viewing. You may not:
      </p>
      <ul>
        <li>
          Copy, download, record, distribute, or publicly perform any film,
          except where your browser’s normal caching is involved.
        </li>
        <li>
          Share your access to the Service in a way that lets others bypass
          the age check for R rated films.
        </li>
        <li>
          Use the Service, or any film on it, for a commercial purpose without
          our written permission.
        </li>
        <li>
          Remove, alter, or obscure any copyright notice, trademark, or other
          notice on the Service or on any film.
        </li>
      </ul>

      <h2>4. Ratings</h2>
      <p>
        You may rate a film by tapping a star. Your rating is stored with a
        random anonymous identifier and helps other viewers see how a film was
        received. Ratings are not a review or a recommendation, and we do not
        promise that a rating will remain displayed.
      </p>

      <h2>5. Advertising</h2>
      <p>
        The Service is supported by advertising. By using the Service, you
        agree that ads may be shown before and during films. We do not control
        the content of third-party ads, and an ad’s appearance does not mean
        we endorse the product or service advertised. For more about how ads
        work on the Service, see our <Link href="/privacy">Privacy Policy</Link>{" "}
        and <Link href="/cookies">Cookie Notice</Link>.
      </p>

      <h2>6. Content warnings and sensitive material</h2>
      <p>
        Some films contain mature themes, violence, sexual content, substance
        use, or other material that some viewers may find distressing. Where a
        film deals with suicide or self-harm, we show a warning and the
        contact details for the 988 Suicide and Crisis Lifeline (call or text
        988 in the United States). Warnings are provided for guidance only;
        we cannot guarantee that every instance of sensitive content is
        flagged, and we encourage you to use the age rating and the synopsis
        to decide what to watch.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The films, artwork, text, logos, and other content on the Service are
        owned by Tohu Movies or by the rights holders who licensed them to
        us, and are protected by copyright and trademark law. The Tohu Movies
        name and logo are trademarks of Tohu Movies. Nothing in these Terms
        gives you any ownership or other rights in the films or in the
        Service, other than the limited personal viewing license in section 3.
      </p>

      <h2>8. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Use the Service in any way that breaks the law or infringes anyone’s
          rights.
        </li>
        <li>
          Try to gain unauthorized access to the Service, its servers, or any
          account or system connected to it.
        </li>
        <li>
          Interfere with or disrupt the Service, including by introducing
          malware or by scraping, crawling, or overloading it.
        </li>
        <li>
          Misrepresent your age or help a minor access R rated films.
        </li>
      </ul>

      <h2>9. Availability and changes</h2>
      <p>
        We aim to keep the Service available, but we do not guarantee
        uninterrupted access. The Service may be unavailable from time to time
        for maintenance, updates, or reasons beyond our control. We may modify
        or discontinue the Service, or any part of it, at any time without
        notice.
      </p>

      <h2>10. Disclaimers and limits of liability</h2>
      <p>
        The Service is provided “as is” and “as available”, without warranties
        of any kind, whether express or implied, including warranties of
        merchantability, fitness for a particular purpose, or non-infringement.
        We do not warrant that films will be available, that playback will be
        uninterrupted or error-free, or that the Service will be free of
        viruses or other harmful components.
      </p>
      <p>
        To the maximum extent permitted by law, Tohu Movies and its owners,
        licensors, and service providers will not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or for any
        loss of profits, revenue, data, or use, arising out of or related to
        your use of the Service. Our total liability for any claim arising out
        of or related to the Service will not exceed one hundred dollars
        ($100).
      </p>

      <h2>11. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. When we do, we will
        update the “Last updated” date at the top of this page. Your continued
        use of the Service after a change means you accept the updated Terms.
        If you do not agree to a change, please stop using the Service.
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
