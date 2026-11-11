# Tohu Movies (Next.js)

The Tohu Movies streaming site as a real web app: Next.js (App Router,
TypeScript), films read from Supabase at runtime, Video.js playback with
Mux HLS and Mux Data, shared star ratings, an R film age gate, and per-film
pages with their own sharing tags.

Free to watch, no sign-in to watch. This is Phase 1 of the migration from
the single static page.

## What is built (Phase 1)

- **Home `/`**: rotating hero (6 most recently added films), genre filter
  chips with counts, sort (Default, Newest, Top rated, A to Z), search,
  film grid with Mux still posters, shared star ratings, the R film age
  gate, and the 988 Suicide and Crisis Lifeline warning on the two films
  that carry it.
- **Film detail `/films/[slug]`**: one dynamic route, rendered from the
  Supabase films table. The 55 known slugs are pre-rendered at build time;
  a film added later renders on demand and is then cached. Each page has
  its own Open Graph and Twitter tags (title, description, poster image),
  the Video.js player, film details, shared ratings, and the same age gate
  and warnings.
- **Legal pages**: `/privacy`, `/terms`, `/cookies`, with the live site's
  text.

## What is NOT built yet (later phases)

Auth, login-gated comments, the built-in admin panel (comment moderation
and adding films), and watchlist / continue watching. Those need the auth
SQL run first: `../files/tohu-supabase-auth.sql` creates the profiles,
watchlist, and continue_watching tables and the comments user_id column.
Run it in the Supabase SQL Editor, then build the login UI on top of it.
View counting for a Most viewed sort is also a later follow-up (a views
table plus the player recording a view); that is why there is no Most
viewed sort option yet.

## Data

Films come from Supabase at request time (server components), never from
a baked-in array. A film added to the `films` table appears on the home
page within about 60 seconds and gets its own `/films/[slug]` page on
first visit, with no rebuild and no code change.

- Supabase project: `tohu-movies`
  (`https://fsyctibngbqjswizwuww.supabase.co`)
- Tables: `films` (slug, title, year, genre, director, cast_text, rating,
  runtime_minutes, synopsis, warnings, playback_id), `ratings`
  (film_slug, stars, voter_id).
- The anon (publishable) key is a public client key and is safe to embed.
  Never put the service_role key or a database password in this repo.
- Genre chips use the first two genres of each film's `genre` string from
  the database, so the chip list can differ slightly from the old static
  site, which used a hand-curated list.
- Poster still times (thumbTime) are not in the database, so they live in
  `src/lib/thumbTimes.ts` (55 entries, default 900 seconds).

## Video

- Player: Video.js 8.24.1, Mux HLS
  `https://stream.mux.com/<playback_id>.m3u8`.
- Mux Data via `videojs-mux` (env key in `src/lib/site.ts`, player_name
  “Tohu Player”). If Mux Data fails to load, playback still works.
- Posters: Mux stills
  `https://image.mux.com/<playback_id>/thumbnail.jpg?width=800&time=<thumbTime>`.
- Captions: Mux auto-generated English tracks; the player forces every
  captions/subtitles track label to “English CC”.
- Ads: the AdSense verification script is in the head of the root layout
  (publisher `ca-pub-2404619225929909`). No ad tag is wired into the
  player yet; that comes with the Google Ad Manager setup.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (also runs the type check and lint)
npm start
```

Environment variables (optional; the app falls back to the known public
values so it works out of the box):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://fsyctibngbqjswizwuww.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_APwY3mhnSdBlq1lAIOkA3Q_8CrpMsa5
```

## Deploy (Vercel)

The code replaces the single `index.html` in the GitHub repo
`ezraschwarcz/tohu-movies`. Vercel auto-detects Next.js and builds it.

1. In the repo, delete the old `index.html` (and the old `assets/`
   folder, if it is still there) from the root, and copy the contents of
   this folder into the repo root, so `package.json`,
   `next.config.ts`, `src/`, and `public/` sit at the top level.
2. Commit and push. Vercel builds and deploys automatically.
3. Optional but recommended: in the Vercel project, set the environment
   variables `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production, Preview, and
   Development). The app works without them because of the in-code
   fallback, but setting them keeps the values in one place.
4. The old static root files that still belong in the repo root:
   `ads.txt`, `sitemap.xml`, `llms.txt`. (The sitemap and llms.txt were
   written for the single-page site; they are still valid for the
   homepage, and the per-film URLs will be added to them when the film
   pages are live.)
5. After deploy, check: the homepage shows 55 films, a film page such as
   `/films/jinn` loads and plays, and the page source of a film page
   carries its own `og:title` and `og:image`.

## Repo layout

```
src/
  app/
    layout.tsx            Root layout: fonts, metadata, AdSense script
    page.tsx              Home (hero + grid), revalidate 60s
    globals.css           Design system (light/dark, from the live site)
    films/[slug]/page.tsx Film detail: generateStaticParams + dynamicParams
    privacy/ terms/ cookies/  Legal pages
    not-found.tsx         404 page
  components/
    Header.tsx            Sticky topbar, wordmark, search, nav
    SiteProvider.tsx      Search state shared by header and grid
    Hero.tsx              Rotating hero, 6 most recently added
    FilmGrid.tsx          Genre chips, sort, search, grid
    FilmCard.tsx          Poster card with ratings
    StarRating.tsx        Shared star ratings (Supabase + localStorage)
    Player.tsx            Video.js + videojs-mux (client only)
    FilmPlayerSection.tsx Age-gated player wrapper for film pages
    AgeGate.tsx           R film age gate modal + hook
    Logo.tsx              The fused T+M logo (exact SVG)
    Footer.tsx            Footer copy and legal links
    LegalPage.tsx         Shared shell for the legal pages
  lib/
    supabase.ts           Server client + browser singleton (anon key only)
    films.ts              Cached Supabase queries, poster/stream URLs
    types.ts              Film, RatingSummary
    site.ts               Public constants (URLs, keys, copy)
    thumbTimes.ts         Poster still times per film (55 entries)
    ageGate.ts            Age verification helpers (localStorage)
public/
  favicon.svg             The logo as an SVG favicon
  logo-512.png            The logo at 512x512 (sharing cards, icons)
```
