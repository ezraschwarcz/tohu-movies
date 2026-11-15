import { ImageResponse } from "next/og";
import { formatRuntime, genresOf, getFilmBySlug, posterUrl } from "@/lib/films";

/** The share card for a film link (iMessage, WhatsApp, Facebook, X,
 *  Slack, Discord…): the film's still, darkened, with the title, the
 *  key facts, and "Watch free on Tohu Movies". 1200x630 is the size
 *  every major app expects. If the still cannot be fetched, the card
 *  still renders on a plain dark background, so a share never shows
 *  a broken image. */
export const alt = "Watch free on Tohu Movies";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

async function stillAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const film = await getFilmBySlug(slug);
  const title = film?.title ?? "Tohu Movies";
  const facts = film
    ? [
        String(film.year),
        formatRuntime(film.runtime_minutes),
        film.rating,
        genresOf(film).join(", "),
      ].filter(Boolean)
    : ["Free independent movies"];
  const still = film ? await stillAsDataUrl(posterUrl(film, 1200)) : null;
  const titleSize = title.length > 28 ? 76 : title.length > 16 ? 96 : 124;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0c0b09",
          color: "#f7f2e7",
          fontFamily: "sans-serif",
        }}
      >
        {still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={still}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              objectFit: "cover",
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            background:
              "linear-gradient(to top, rgba(12,11,9,0.96) 0%, rgba(12,11,9,0.7) 45%, rgba(12,11,9,0.25) 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: 56,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 52,
                height: 52,
                marginRight: 16,
                borderRadius: 12,
                background: "#e9a83a",
                color: "#1a1405",
                fontSize: 24,
              }}
            >
              TM
            </div>
            <span>TOHU&nbsp;</span>
            <span style={{ color: "#e9a83a" }}>MOVIES</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: titleSize,
                fontWeight: 700,
                lineHeight: 1,
                textTransform: "uppercase",
                letterSpacing: -1,
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 26,
                fontSize: 30,
                color: "#d9d2c0",
              }}
            >
              {facts.join("  ·  ")}
            </div>
            <div style={{ display: "flex", marginTop: 30 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 30px",
                  borderRadius: 999,
                  background: "#e9a83a",
                  color: "#1a1405",
                  fontSize: 30,
                  fontWeight: 700,
                }}
              >
                ▶&nbsp;&nbsp;Watch free
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
