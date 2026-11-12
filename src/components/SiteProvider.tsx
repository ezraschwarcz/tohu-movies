"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Site-wide UI state shared between the header search and the home grid.
 *  Kept in a client context (not in the URL) so the home page stays
 *  statically prerendered: reading search params on the server would make
 *  the page dynamic, and useSearchParams in the grid would stream the grid
 *  out of the initial HTML. The query is still mirrored into ?q= (debounced)
 *  so a search is shareable, and a ?q= link is picked up on mount. */

type SiteContextValue = {
  query: string;
  setQuery: (q: string) => void;
  /** Hide R rated films from the home grid. A per-browser preference
   *  (localStorage "tohu-hide-r-rated"), set on the profile page. */
  hideRRated: boolean;
  setHideRRated: (hide: boolean) => void;
};

const HIDE_R_KEY = "tohu-hide-r-rated";

const SiteContext = createContext<SiteContextValue>({
  query: "",
  setQuery: () => {},
  hideRRated: false,
  setHideRRated: () => {},
});

export function SiteProvider({ children }: { children: ReactNode }) {
  const [query, setQueryState] = useState("");
  const [hideRRated, setHideRRatedState] = useState(false);

  // Pick up a ?q= link on first mount (client side only).
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) setQueryState(q);
    } catch {
      // ignore
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read the saved R-rated preference once on mount (client only).
  useEffect(() => {
    try {
      setHideRRatedState(
        window.localStorage.getItem(HIDE_R_KEY) === "1",
      );
    } catch {
      // ignore
    }
  }, []);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
  }, []);

  const setHideRRated = useCallback((hide: boolean) => {
    setHideRRatedState(hide);
    try {
      if (hide) {
        window.localStorage.setItem(HIDE_R_KEY, "1");
      } else {
        window.localStorage.removeItem(HIDE_R_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ query, setQuery, hideRRated, setHideRRated }),
    [query, setQuery, hideRRated, setHideRRated],
  );
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSiteSearch(): SiteContextValue {
  return useContext(SiteContext);
}
