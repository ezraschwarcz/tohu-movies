/** The same database and website the web app uses, so an account made
 *  on tohumovies.com signs in here and the other way round. The key
 *  below is the public (publishable) one that already ships in the
 *  website; it is safe to keep in the app. Never put a secret key here.
 *  (The EXPO_PUBLIC_ overrides exist only for testing against a copy.) */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://www.tohumovies.com';
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://fsyctibngbqjswizwuww.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_APwY3mhnSdBlq1lAIOkA3Q_8CrpMsa5';
