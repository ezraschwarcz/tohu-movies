import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Posters load DIRECTLY from Mux as plain <img> elements (see
  // posterUrl in src/lib/films.ts and the components that render it).
  // Nothing goes through the /_next/image optimizer: Mux still URLs
  // carry ?width=...&time=... query params, which the optimizer
  // rejects with HTTP 400 INVALID_IMAGE_OPTIMIZE_REQUEST, so every
  // poster was a broken image. Mux already sizes the still, so the
  // optimizer adds nothing. No images.remotePatterns entry is needed.
  // NOTE: cacheComponents is deliberately NOT enabled. The classic ISR
  // model is used instead, because dynamicParams (new film slugs rendering
  // on demand) is not available when Cache Components is on. See the
  // Next.js docs in node_modules/next/dist/docs (caching-without-cache-
  // components) and the revalidate exports on the pages.
};

export default nextConfig;
