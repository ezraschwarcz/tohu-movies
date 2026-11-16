import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { formatRuntime, genresOf, getFilmBySlug, posterUrl } from "@/lib/films";

/** The share card for a film link (iMessage, WhatsApp, Facebook, X,
 *  Slack, Discord…): the film's still, darkened, with the title, the
 *  key facts, and "Watch free", in the site's own typefaces and logo.
 *  1200x630 is the size every major app expects. The bottom strip is
 *  left clear because X lays the page title over that corner. If the still cannot be fetched, the card
 *  still renders on a plain dark background, so a share never shows
 *  a broken image. */
const size = { width: 1200, height: 630 };

const LOGO =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#16130e"/><g fill="none" stroke="#e9a83a" stroke-width="10"><path d="M9 16h46"/><path d="M14 16v36M50 16v36M32 16v36"/><path d="M14 25l18 18 18-18"/></g></svg>',
  ).toString("base64");

function font(file: string): Promise<Buffer> {
  return readFile(join(process.cwd(), "assets/fonts", file));
}

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

export async function renderShareCard(slug: string): Promise<ImageResponse> {
  const [film, narrowBold, medium, bold] = await Promise.all([
    getFilmBySlug(slug),
    font("archivo-narrow-latin-700-normal.woff"),
    font("archivo-latin-500-normal.woff"),
    font("archivo-latin-700-normal.woff"),
  ]);
  const title = film?.title ?? "Tohu Movies";
  const facts = film
    ? [
        String(film.year),
        formatRuntime(film.runtime_minutes),
        film.rating,
        genresOf(film).slice(0, 3).join(", "),
      ].filter(Boolean)
    : ["Free independent movies"];
  const still = film ? await stillAsDataUrl(posterUrl(film, 960)) : null;
  const titleSize = title.length > 26 ? 84 : title.length > 15 ? 108 : 140;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0c0b09",
          color: "#f2eee3",
          fontFamily: "Archivo",
        }}
      >
        {still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={still}
            alt=""
            width={1200}
            height={630}
            style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
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
              "linear-gradient(to top, rgba(12,11,9,0.97) 0%, rgba(12,11,9,0.78) 50%, rgba(12,11,9,0.35) 100%)",
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
            padding: "52px 60px 96px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="" width={60} height={60} />
            <div
              style={{
                display: "flex",
                marginLeft: 18,
                fontFamily: "Archivo Narrow",
                fontWeight: 700,
                fontSize: 40,
                letterSpacing: 1,
              }}
            >
              <span>TOHU</span>
              <span style={{ color: "#e9a83a", marginLeft: 12 }}>MOVIES</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Archivo Narrow",
                fontWeight: 700,
                fontSize: titleSize,
                lineHeight: 0.98,
                textTransform: "uppercase",
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 28,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "13px 30px",
                  borderRadius: 999,
                  background: "#e9a83a",
                  color: "#1a1405",
                  fontSize: 30,
                  fontWeight: 700,
                }}
              >
                <svg width="22" height="24" viewBox="0 0 22 24" style={{ marginRight: 12 }}>
                  <path d="M2 1.5v21L20.5 12z" fill="#1a1405" />
                </svg>
                Watch free
              </div>
              <div style={{ display: "flex", marginLeft: 26, fontSize: 30, fontWeight: 500, color: "#d9d2c0" }}>
                {facts.join("  ·  ")}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo Narrow", data: narrowBold, weight: 700, style: "normal" },
        { name: "Archivo", data: medium, weight: 500, style: "normal" },
        { name: "Archivo", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
