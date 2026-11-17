"use client";

// Small hooks for reading things that only exist in the visitor's
// browser (screen size, saved settings, the address bar) without
// drawing the page twice. Each one returns a safe default while the
// page is drawn on the server, then the real value in the browser.
// They are built on React's useSyncExternalStore, which is the
// supported way to read state that lives outside React.

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** False while the page is drawn on the server and during the first
 *  draw in the browser; true from then on. Use it for anything that can
 *  only be drawn in the browser, such as a dialog placed on <body>. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/** Whether a CSS media query matches, kept up to date as it changes
 *  (window resized, reduced-motion switched on). False on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The viewport's width and height in CSS pixels, kept up to date on
 *  resize. Zero on the server. */
export function useViewportSize(): { width: number; height: number } {
  const key = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("resize", onChange);
      return () => window.removeEventListener("resize", onChange);
    },
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => "0x0",
  );
  const [width, height] = key.split("x").map(Number);
  return { width, height };
}

// ---------- Saved settings (localStorage) ----------

const storageListeners = new Set<() => void>();

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Save a value (or remove it with null) and tell every component that
 *  reads it through useStoredValue. */
export function writeStoredValue(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private browsing or storage full: the setting just is not kept.
  }
  storageListeners.forEach((listener) => listener());
}

/** A value saved in this browser's localStorage, or null. Updates when
 *  it is changed through writeStoredValue here or in another tab. */
export function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    (onChange) => {
      storageListeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        storageListeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => readStorage(key),
    () => null,
  );
}

/** One parameter from the address bar's query string (?q=...), or ""
 *  on the server. Read once per page load. */
export function useQueryParam(name: string): string {
  return useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get(name) ?? "",
    () => "",
  );
}
