/** Passkeys are off in the Supabase project (Authentication → Passkeys
 *  in the dashboard), so signInWithPasskey / registerPasskey fail. The
 *  server returns the `passkey_disabled` error code; the message is
 *  matched too, since the exact code is a server detail and the user
 *  has already seen the words "passkeys are disabled". */

export function isPasskeyDisabledError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  const text = err instanceof Error ? err.message : "";
  return (
    code === "passkey_disabled" ||
    /passkey.*disabled|passkeys are disabled/i.test(text)
  );
}

/** Friendly message shown in the form when passkeys are off, instead
 *  of a raw error code. It points the visitor at the working options. */
export const PASSKEY_DISABLED_MESSAGE =
  "Passkeys are not turned on for this site yet. Use an email link or password instead.";
