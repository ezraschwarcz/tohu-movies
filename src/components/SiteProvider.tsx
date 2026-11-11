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
};

const SiteContext = createContext<SiteContextValue>({
  query: "",
  setQuery: () => {},
});

export function SiteProvider({ children }: { children: ReactNode }) {
  const [query, setQueryState] = useState("");

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

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
  }, []);

  const value = useMemo(() => ({ query, setQuery }), [query, setQuery]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSiteSearch(): SiteContextValue {
  return useContext(SiteContext);
}
