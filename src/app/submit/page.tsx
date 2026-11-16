import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import SubmitFilmForm from "@/components/SubmitFilmForm";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Submit your film | Tohu Movies",
  description:
    "Filmmakers and distributors: offer your independent feature or documentary for free, ad-supported streaming on Tohu Movies.",
  alternates: { canonical: `${SITE_URL}/submit` },
};

export default function SubmitPage() {
  return (
    <LegalPage
      title="Submit your film"
      meta="For filmmakers and distributors"
      intro="Tohu streams independent features and documentaries free to viewers, supported by advertising. If you hold the rights to a finished film, tell us about it."
      footerNote={<>Sending this form does not grant us any rights to your film. Nothing is streamed without a signed agreement.</>}
    >
      <h2>What we look for</h2>
      <ul>
        <li>Finished feature films and documentaries, 60 minutes or longer.</li>
        <li>Streaming rights you control, or can put us in touch with whoever does.</li>
        <li>A high-definition master and cover art you can supply.</li>
      </ul>
      <h2>Tell us about it</h2>
      <SubmitFilmForm />
    </LegalPage>
  );
}
