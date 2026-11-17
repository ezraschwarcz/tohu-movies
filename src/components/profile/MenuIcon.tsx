import type { ReactNode } from "react";


/** Menu icons for the profile hub, in the Facebook menu style: a
 *  simple stroke glyph inside a soft circle. */
const MENU_ICONS: Record<string, ReactNode> = {
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  list: (
    <>
      <path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20" />
      <circle cx="5" cy="6.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  star: (
    <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.6 20.4c.8-3.7 3.8-5.4 7.4-5.4s6.6 1.7 7.4 5.4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.5" r="4.5" />
      <path d="M11.4 12.1L20 3.5M16.6 6.9l3 3" />
    </>
  ),
  camera: (
    <>
      <path d="M8.6 8.4 10.2 5.6h3.6L15.4 8.4" />
      <rect x="3" y="8.4" width="18" height="11.2" rx="1.8" />
      <circle cx="12" cy="14" r="3.3" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 8h8.5M18 8h2M4 16h2.5M12 16h8" />
      <circle cx="15.2" cy="8" r="2.2" />
      <circle cx="9.2" cy="16" r="2.2" />
    </>
  ),
  shield: (
    <path d="M12 3.5l7 2.6v5.4c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6.1z" />
  ),
  logout: (
    <>
      <path d="M9 20.5H6.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2H9" />
      <path d="M15.5 16.5L20.5 12l-5-4.5M20.5 12H9" />
    </>
  ),
};

export function MenuIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {MENU_ICONS[name]}
    </svg>
  );
}
