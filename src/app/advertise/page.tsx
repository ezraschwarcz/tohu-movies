import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Advertise on Tohu Movies",
  description:
    "Reach people who watch free independent film. Sponsorships, film promotion and direct placements on Tohu Movies.",
  alternates: { canonical: `${SITE_URL}/advertise` },
};

export default function AdvertisePage() {
  return (
    <LegalPage
      title="Advertise on Tohu Movies"
      meta="Sponsorships and direct placements"
      intro="Tohu is a free, ad-supported home for independent film. If you want to reach people in the middle of movie night, we would like to hear from you."
    >
      <h2>What we offer</h2>
      <ul>
        <li>
          <strong>The Friday Pick.</strong> Sponsor our weekly email, sent to
          members who asked for a film recommendation every Friday.
        </li>
        <li>
          <strong>Collections.</strong> Sponsor a themed collection, such
          as family movie night or midnight horror.
        </li>
        <li>
          <strong>Film promotion.</strong> If your film is on Tohu, we can
          feature it on the home page and across our social accounts.
        </li>
        <li>
          <strong>Direct placements.</strong> Display and video placements
          alongside films, sold directly.
        </li>
      </ul>
      <h2>What we do not accept</h2>
      <p>
        Ads that are misleading, that promote piracy, gambling or adult
        services, or that would not be appropriate beside a family film.
      </p>
      <h2>Get in touch</h2>
      <p>
        Email{" "}
        <a href="mailto:hello@tohumovies.com?subject=Advertising">
          hello@tohumovies.com
        </a>{" "}
        with what you would like to promote, your timing and your budget,
        and we will reply with current audience numbers and options.
      </p>
      <p>
        Have a film to offer instead? See{" "}
        <Link href="/submit">Submit your film</Link>.
      </p>
    </LegalPage>
  );
}
