// Site-wide constants. The Supabase anon key and the Mux Data env key are
// public client keys, meant to be embedded in the app (the same keys the
// live static site already ships in its HTML). Never put the Supabase
// service_role key or a database password in this codebase.

export const SITE_URL = "https://www.tohumovies.com";
export const SITE_NAME = "Tohu Movies";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://fsyctibngbqjswizwuww.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_APwY3mhnSdBlq1lAIOkA3Q_8CrpMsa5";

// Mux Data (analytics). Client-side key, safe to embed.
export const MUX_DATA_ENV_KEY = "29p9bv2jmen9ll64po09ue8id";
export const MUX_PLAYER_NAME = "Tohu Player";

// Google AdSense publisher id. The verification script is in the layout.
export const ADSENSE_CLIENT = "ca-pub-2404619225929909";

export const TAGLINE =
  "Bold stories, hidden gems, and voices you will not find anywhere else. Handpicked independent cinema for people who love film, press play and discover your next favorite.";

export const FOOTER_PROMO =
  "Independent cinema, handpicked for people who love film. Bold voices, unforgettable stories, and a new favorite waiting for you tonight, streaming free, always.";
