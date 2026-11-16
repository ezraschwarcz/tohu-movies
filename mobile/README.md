# Tohu Movies — phone app (iPhone and Android)

One codebase, built with Expo (React Native), that produces both the
iPhone app and the Android app. It uses the same database and accounts
as tohumovies.com: sign in here with the email you use on the website
and your watchlist, progress and comments are already there.

## What is in it

- **Home:** a featured film, Continue watching, Trending, New, and rows by genre.
- **Search:** every film, filtered as you type.
- **Film page:** the player (full screen, picture-in-picture, AirPlay,
  keeps playing with the screen locked), watchlist, share, comments.
- **Watchlist** and **Profile**.
- **Sign in:** email, then the 6-digit code from the email. No password.
- R rated films ask once whether the viewer is 17 or older.

## Try it on your own phone (free, about 15 minutes)

1. On the Mac, install Node.js from https://nodejs.org (the LTS button).
2. On the phone, install the free **Expo Go** app from the App Store or Play Store.
3. On the Mac, open the Terminal app and run these lines one at a time:
   ```
   cd ~/Desktop
   git clone https://github.com/ezraschwarcz/tohu-movies.git
   cd tohu-movies/mobile
   npm install
   npx expo start
   ```
4. A QR code appears. Scan it with the phone's camera. The app opens in Expo Go.

Expo Go is for trying it out. Background audio and picture-in-picture
only work in a real build (next section).

## Put it in the App Store and Play Store

You need:
- An **Apple Developer** account ($99 a year) for the App Store.
- A **Google Play Console** account ($25 once) for the Play Store.
- A free **Expo** account (expo.dev). Its free plan includes a limited
  number of cloud builds a month, which is enough to start.

Then, in Terminal, inside the `mobile` folder:

```
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios
eas build --platform android
eas submit --platform ios
eas submit --platform android
```

`eas build` builds the app on Expo's computers (no Xcode needed) and
walks you through signing in to Apple and Google the first time.
`eas submit` sends the finished build to each store for review.

## Before the first store submission

These are store rules, not optional polish:

1. **Delete account inside the app.** Apple requires it for any app
   that lets people create an account. Not built yet.
2. **Report and block for comments.** Both stores require a way to
   report a comment and block a member in apps with user comments.
   Not built yet (the admin ban tools on the website are the other half).
3. **Age rating.** Answer the stores' questionnaires truthfully; with R
   rated horror the app will be rated 17+ / Mature.
4. **Sign in with Apple** is only required if you add Google or
   Facebook sign-in. Email codes alone do not need it.
5. **Ads.** The app has none yet. Ads in apps use Google AdMob (a
   separate product from AdSense) or video ads through Mux/Google IMA.
6. **Real icon and screenshots.** `assets/images/icon.png` is the
   website logo scaled up as a placeholder; replace it with a 1024px original.

## Where things are

- `src/lib/config.ts` — the database address and public key.
- `src/lib/films.ts` — loading films, cover art, video addresses.
- `src/app/` — one file per screen.
- `app.json` — the app's name, icon, and store identifiers
  (`com.tohumovies.app`). Change the identifiers before the first build
  if you want different ones; they cannot be changed after release.
