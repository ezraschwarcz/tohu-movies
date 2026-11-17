import * as Sentry from "@sentry/nextjs";

/** Error tracking in visitors' browsers. Off until NEXT_PUBLIC_SENTRY_DSN is
 *  set in Vercel. Errors only: no session recordings, no personal data. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0,
    // Privacy: no user details, cookies, headers, request bodies or query
    // strings are sent; only the error and where it happened.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // Noise from browser extensions and ad scripts, not from Tohu.
    ignoreErrors: ["ResizeObserver loop", "Non-Error promise rejection captured"],
    denyUrls: [
      /^(chrome|moz|safari-web)-extension:\/\//i,
      /^chrome:\/\//i,
      /^https:\/\/([a-z0-9-]+\.)*googlesyndication\.com\//i,
      /^https:\/\/([a-z0-9-]+\.)*doubleclick\.net\//i,
    ],
  });
}
