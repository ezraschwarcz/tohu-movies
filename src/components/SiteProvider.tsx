"use client";

import { rememberFirstTouch } from "@/lib/attribution";
import { useQueryParam, useStoredValue, writeStoredValue } from "@/lib/clientState";
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
  // The search box starts from a ?q= link, if any; once the visitor
  // types, their text wins (null means "not typed yet").
  const linkedQuery = useQueryParam("q");
  const [typedQuery, setTypedQuery] = useState<string | null>(null);
  const query = typedQuery ?? linkedQuery;
  // The "hide R-rated films" choice is kept in this browser.
  const hideRRated = useStoredValue(HIDE_R_KEY) === "1";

  // Note once where this visitor first came from (see lib/attribution).
  useEffect(() => {
    rememberFirstTouch();
  }, []);

  const setQuery = useCallback((q: string) => {
    setTypedQuery(q);
  }, []);

  const setHideRRated = useCallback((hide: boolean) => {
    writeStoredValue(HIDE_R_KEY, hide ? "1" : null);
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
