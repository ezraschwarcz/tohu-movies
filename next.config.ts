import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remote posters are Mux stills (image.mux.com). next/image optimizes
  // them on demand; the pattern below is the only external image host.
  images: {
    remotePatterns: [new URL("https://image.mux.com/**")],
  },
  // NOTE: cacheComponents is deliberately NOT enabled. The classic ISR
  // model is used instead, because dynamicParams (new film slugs rendering
  // on demand) is not available when Cache Components is on. See the
  // Next.js docs in node_modules/next/dist/docs (caching-without-cache-
  // components) and the revalidate exports on the pages.
};

export default nextConfig;
