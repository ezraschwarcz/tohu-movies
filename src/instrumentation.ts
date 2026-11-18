import * as Sentry from "@sentry/nextjs";

/** Error tracking on the server. Off until NEXT_PUBLIC_SENTRY_DSN is set
 *  in Vercel (Settings, Environment Variables); then errors on the server
 *  are sent to Sentry, which emails an alert. */
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? "development",
    // Errors only: no performance tracing, so the free plan's quota lasts.
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
  });
}

export const onRequestError = Sentry.captureRequestError;
