/** Shared rules for the sign-in flow.
 *
 *  A brand-new account is created with a neutral placeholder name
 *  (never a piece of the email address, which would leak it onto
 *  public comments) and is sent to /welcome once to pick a real name
 *  and photo. `onboarded` in the account's metadata marks that the
 *  welcome step was finished or skipped. */

export const LAST_EMAIL_KEY = "tohu-last-email";

export function placeholderName(): string {
  return `Viewer ${Math.floor(1000 + Math.random() * 9000)}`;
}

export function isPlaceholderName(name: string | null | undefined): boolean {
  return !name || /^Viewer \d{4}$/.test(name.trim());
}

/** True for an account made in the last half hour that has not been
 *  through the welcome step. Older accounts are never sent there. */
export function needsWelcome(user: {
  created_at?: string;
  user_metadata?: Record<string, unknown> | null;
}): boolean {
  if (user.user_metadata?.onboarded === true) return false;
  const created = user.created_at ? Date.parse(user.created_at) : NaN;
  if (!Number.isFinite(created)) return false;
  return Date.now() - created < 30 * 60 * 1000;
}

export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
