import type { NextConfig } from "next";

// Security headers, sent with every page and file.
//
// Enforced: rules that cannot break the site (it cannot be shown inside
// another site's frame, no plugins, HTTPS only, no guessing file types).
// Report-only: the full list of where scripts, styles, images and video may
// come from. Browsers report what it would block without blocking it; once
// the reports are clean for a few weeks it can be switched to enforced by
// renaming the header. Set CSP_REPORT_URI (Sentry's security endpoint) in
// Vercel to collect the reports.
const reportOnlyPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.googletagservices.com https://*.google.com https://*.gstatic.com https://va.vercel-scripts.com https://*.sentry.io",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https://*.mux.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.mux.com https://*.litix.io https://accounts.google.com https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.sentry.io https://*.ingest.sentry.io https://vitals.vercel-insights.com",
  "frame-src https://accounts.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.CSP_REPORT_URI ? [`report-uri ${process.env.CSP_REPORT_URI}`] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; upgrade-insecure-requests" },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Google sign-in opens a popup, so popups keep their link back to the page.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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

  // The share card reads its fonts from disk; make sure they ship with
  // the route so a card for a newly added film can be drawn on demand.
  outputFileTracingIncludes: {
    "/films/[slug]/card.png": ["./assets/fonts/*"],
  },
};

export default nextConfig;
