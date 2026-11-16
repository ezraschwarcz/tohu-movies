import { getFilms } from "@/lib/films";
import { renderShareCard } from "@/lib/shareCard";

/** The share card for a film link, served as an ordinary image file:
 *  built once (at deploy for existing films, on first request for a
 *  new one), then kept on the CDN and refreshed daily.
 *
 *  Why not Next's opengraph-image file: that version was drawn afresh
 *  on every request, took up to two seconds, and was sent without a
 *  stated length. iMessage and Facebook coped; X showed no image. A
 *  finished file with a fixed length and a .png address is what link
 *  preview crawlers handle most reliably. */
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  const films = await getFilms();
  return films.map((film) => ({ slug: film.slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const image = await renderShareCard(slug);
  const bytes = Buffer.from(await image.arrayBuffer());
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
