import type { BrowserContext, Page } from "@playwright/test";

/** The stand-in database's address (see tests/mock/server.mjs). */
export const MOCK_URL = "http://127.0.0.1:54321";

/** Sign the browser in as a sample member or admin by giving it the
 *  session cookie Supabase would set. The stand-in database recognises
 *  the token; the real one never would. */
export async function signIn(context: BrowserContext, who: "member" | "admin", baseURL: string) {
  const ref = new URL(MOCK_URL).hostname.split(".")[0];
  const session = {
    access_token: `test-${who}`,
    refresh_token: "test-refresh",
    token_type: "bearer",
    expires_in: 3600 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    user: { id: who === "admin" ? "00000000-0000-0000-0000-000000000001" : "00000000-0000-0000-0000-000000000002" },
  };
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  await context.addCookies([{ name: `sb-${ref}-auth-token`, value, url: baseURL }]);
}

/** Video and poster images come from Mux, which the tests do not reach. */
export async function blockMux(page: Page) {
  await page.route(/(image|stream)\.mux\.com/, (route) => route.abort());
}
