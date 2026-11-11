# Tohu Movies (Next.js)

The Tohu Movies streaming site as a real web app: Next.js (App Router,
TypeScript), films read from Supabase at runtime, Video.js playback with
Mux HLS and Mux Data, shared star ratings, an R film age gate, and per-film
pages with their own sharing tags.

Free to watch, no sign-in to watch. This is Phases 1 and 2 of the
migration from the single static page. Phase 2 adds sign-in, comments,
the admin panel, watchlist, and continue watching.

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

## What is built (Phase 2)

- **Sign-in `/login`**: magic link by email (primary) or password, plus
  sign-up (email, display name, password). The display name is stored on
  the profile row that the database trigger creates at sign-up. The
  magic-link / email-confirmation landing page is `/auth/callback`
  (exchanges the code for a session, then sends the visitor on to where
  they were going). The header shows Sign in when signed out, and the
  display name plus Sign out (and My watchlist, and Admin for admins)
  when signed in. Watching stays free; no login is needed to watch.
- **Comments**: on each film page. Approved comments are listed with the
  commenter's display name. A signed-in user can submit one; it is saved
  as pending and does not appear until an admin approves it. A signed-out
  user sees a prompt to sign in. A note says comments are reviewed before
  they appear.
- **Admin panel `/admin`**: lists pending comments (film, commenter,
  text, date) with Approve, Reject, and Delete, and an Add film form
  (title, year, genre, director, cast, rating, runtime, synopsis,
  warnings, Mux playback ID) that inserts a row into the films table, so
  the film's page appears automatically. The page checks
  `profiles.is_admin` on every load; non-admins and signed-out visitors
  get a 404, so the route does not reveal itself.
- **Watchlist**: a Watchlist button on each film page and on each film
  card. `/watchlist` lists the signed-in user's saved films. Signed-out
  visitors see a prompt to sign in.
- **Continue watching**: the player records the playback position
  (throttled to at most once every 15 seconds, plus a save on pause) for
  signed-in users only, and resumes where they stopped when the film page
  opens. The home page shows a Continue watching row for signed-in users
  with a progress bar and a Resume button. Finishing a film removes it.
- **Auth plumbing**: `@supabase/ssr` cookie-based clients (browser and
  server), `src/proxy.ts` (Next.js 16 proxy, the `middleware` convention
  renamed) refreshing the session on every request, and
  `src/components/AuthProvider.tsx` for signed-in state in the header,
  film pages, and player. No service_role key or database password
  anywhere in the repo.

### Before Phase 2 works on the live site

1. Run `../files/tohu-supabase-phase2.sql` in the Supabase SQL Editor
   (after the auth SQL, which already ran). It adds: an admin-only read
   policy on comments (so the admin panel can list pending ones), an
   admin-only insert policy and grant on films (the Add film form), the
   grants the `authenticated` role needs to keep reading films and
   rating once signed in, and a delete policy so clearing a star rating
   works. Safe to re-run; every statement is guarded.
2. In Supabase (Authentication, URL Configuration), set the Site URL to
   `https://www.tohumovies.com` and add
   `https://www.tohumovies.com/auth/callback` to the Redirect URLs.
   Without this, magic-link and confirmation emails point at the wrong
   place and sign-in fails. (Locally, `http://localhost:3000` is already
   allowed by default.)
3. Make the admin account: sign up on the live site, then in the SQL
   Editor run the bootstrap line at the bottom of
   `../files/tohu-supabase-auth.sql` (it sets `is_admin = true` for that
   email). Only after that does `/admin` open for that account.

## What is NOT built yet (later phases)

View counting for a Most viewed sort (a views table plus the player
recording a view); that is why there is no Most viewed sort option yet.
The mobile app (iOS and Android) comes after the web app. Ads: the
AdSense verification script is in the head, but no ad tag is wired into
the player yet; that comes with the Google Ad Manager setup.

## Data

Films come from Supabase at request time (server components), never from
a baked-in array. A film added to the `films` table appears on the home
page within about 60 seconds and gets its own `/films/[slug]` page on
first visit, with no rebuild and no code change.

- Supabase project: `tohu-movies`
  (`https://fsyctibngbqjswizwuww.supabase.co`)
- Tables: `films` (slug, title, year, genre, director, cast_text, rating,
  runtime_minutes, synopsis, warnings, playback_id), `ratings`
  (film_slug, stars, voter_id), `profiles` (id, display_name, is_admin),
  `comments` (film_slug, body, status, user_id), `watchlist`
  (user_id, film_slug), `continue_watching` (user_id, film_slug,
  position_seconds, duration_seconds).
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
   Keep `AGENTS.md` in the repo and commit it with the work; removing it
   only re-creates the uncommitted change (Next.js re-adds it).
2. **First, set the Framework Preset to Next.js** in the Vercel project
   Settings. (The project was created for the old single-file site, so
   its preset is still "Other"; with that preset Vercel deploys the files
   as a static site and the app 404s, even though the build looks Ready.
   This bit Phase 1 on November 11, 2026.) Then commit and push; Vercel
   builds and deploys automatically.
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
   carries its own `og:title` and `og:image`. Phase 2 checks: `/login`
   shows the sign-in form, `/admin` returns 404 while signed out (and
   after the admin bootstrap, opens for the admin account), and a signed-in
   user can comment (it stays pending until approved), save a film to the
   watchlist, and see it on Continue watching after watching part of it.

## Repo layout

```
src/
  app/
    layout.tsx            Root layout: fonts, metadata, AdSense script
    page.tsx              Home (hero + continue watching + grid), revalidate 60s
    globals.css           Design system (light/dark, from the live site)
    films/[slug]/page.tsx Film detail: generateStaticParams + dynamicParams
    login/page.tsx        Sign in / sign up (server page, form in HTML)
    auth/callback/route.ts Magic-link / email-confirmation callback
    admin/page.tsx        Admin panel (404 for non-admins), actions.ts
    watchlist/page.tsx    My watchlist (signed-in users)
    privacy/ terms/ cookies/  Legal pages
    not-found.tsx         404 page
  proxy.ts                Next.js 16 proxy: refreshes the Supabase session
  components/
    Header.tsx            Sticky topbar, wordmark, search, nav, sign in
    AuthProvider.tsx      Signed-in state (user, profile, isAdmin)
    LoginForm.tsx         Sign in (magic link / password) and sign up
    CommentsSection.tsx   Approved comments + submit (signed-in only)
    AdminPanel.tsx        Pending comments + Add film form
    WatchlistButton.tsx   Save / remove a film from the watchlist
    ContinueWatching.tsx  Continue watching row (signed-in users)
    SiteProvider.tsx      Search state shared by header and grid
    Hero.tsx              Rotating hero, 6 most recently added
    FilmGrid.tsx          Genre chips, sort, search, grid
    FilmCard.tsx          Poster card with ratings + watchlist button
    StarRating.tsx        Shared star ratings (Supabase + localStorage)
    Player.tsx            Video.js + videojs-mux (client only), records
                          continue watching for signed-in users
    FilmPlayerSection.tsx Age-gated player wrapper for film pages
    AgeGate.tsx           R film age gate modal + hook
    Logo.tsx              The fused T+M logo (exact SVG)
    Footer.tsx            Footer copy and legal links
    LegalPage.tsx         Shared shell for the legal pages
  lib/
    supabase.ts           Server client + browser singleton (anon key only)
    supabase/client.ts    Browser client via @supabase/ssr (cookies)
    supabase/server.ts    Server client via @supabase/ssr + getServerAuth
    supabase/proxy.ts     Session refresh for the proxy
    films.ts              Cached Supabase queries, poster/stream URLs
    comments.ts           Approved comments query
    types.ts              Film, RatingSummary, Profile, Comment, ...
    site.ts               Public constants (URLs, keys, copy)
    thumbTimes.ts         Poster still times per film (55 entries)
    ageGate.ts            Age verification helpers (localStorage)
public/
  favicon.svg             The logo as an SVG favicon
  logo-512.png            The logo at 512x512 (sharing cards, icons)
```
