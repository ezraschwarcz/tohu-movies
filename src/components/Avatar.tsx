import type { ReactNode } from "react";
import { avatarPresetById } from "@/lib/avatars";

/** A user's round profile image (Phase 5.2), in priority order:
 *  an uploaded photo (plain <img>, never next/image — same reason as
 *  the film posters), else a chosen preset (solid color disc with a
 *  stroke glyph), else the initials of the display name on the Tohu
 *  amber. Used in the header, the profile page, and comments, so a
 *  person looks the same everywhere. */

const GLYPHS: Record<string, ReactNode> = {
  clapper: (
    <>
      <path d="M3.2 10.2h17.6v8.6a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6z" />
      <path d="M3.6 6.4 20.4 4.2l.5 3.4L4.1 9.8z" />
      <path d="M8.2 5.9l.9 3.2M13.6 5.2l.9 3.2M19 4.5l.9 3.2" />
    </>
  ),
  popcorn: (
    <>
      <path d="M5.6 9.8h12.8l-1.6 9.7a1.7 1.7 0 0 1-1.7 1.4H8.9a1.7 1.7 0 0 1-1.7-1.4z" />
      <path d="M10 9.8l.6 10.8M14 9.8l-.6 10.8" />
      <path d="M7.2 9.8a2.3 2.3 0 1 1 1.9-4A2.7 2.7 0 0 1 12 4.2a2.7 2.7 0 0 1 2.9 1.6 2.3 2.3 0 1 1 1.9 4" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8.2A1.7 1.7 0 0 1 5.7 6.5h12.6A1.7 1.7 0 0 1 20 8.2v1.9a2.6 2.6 0 0 0 0 5.2v1.9a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 17.3V15.4a2.6 2.6 0 0 0 0-5.2z" />
      <path d="M14.8 7.2v1.7M14.8 11v1.7M14.8 14.8v1.7" />
    </>
  ),
  camera: (
    <>
      <path d="M8.6 8 10.2 5.2h3.6L15.4 8" />
      <rect x="3" y="8" width="18" height="11.4" rx="1.8" />
      <circle cx="12" cy="13.7" r="3.4" />
      <circle cx="12" cy="13.7" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  reel: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="7.4" r="1.7" />
      <circle cx="16" cy="14.3" r="1.7" />
      <circle cx="8" cy="14.3" r="1.7" />
    </>
  ),
  star: (
    <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
  ),
  screen: (
    <>
      <rect x="3.4" y="5.8" width="17.2" height="12" rx="1.7" />
      <path d="M12 17.8v2.4M8.4 20.6h7.2" />
    </>
  ),
  heart: (
    <path d="M12 20.2S4.7 15.5 4.7 10.1A4.35 4.35 0 0 1 12 6.9a4.35 4.35 0 0 1 7.3 3.2c0 5.4-7.3 10.1-7.3 10.1z" />
  ),
  bolt: <path d="M13.2 3 5.4 13.6h5.4L9.6 21l8.4-10.8h-5.4z" />,
  music: (
    <>
      <path d="M9.6 18.4V6.2L19.4 4.2v11.6" />
      <circle cx="6.9" cy="18.4" r="2.7" />
      <circle cx="16.7" cy="15.8" r="2.7" />
    </>
  ),
};

/** Up to two initials from a display name (or email): "Ezra S" -> "ES". */
export function initialsFor(name: string | null | undefined): string {
  return (
    (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function Avatar({
  preset,
  url,
  name,
  size = 36,
  className,
}: {
  preset?: string | null;
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const cls = `avatar${className ? ` ${className}` : ""}`;
  const dims = { width: size, height: size };
  const label = name ?? undefined;

  if (url) {
    return (
      // Plain <img>, not next/image: the URL is a Supabase Storage
      // public URL; the optimizer adds nothing here.
      <img
        className={cls}
        src={url}
        alt={label ?? ""}
        width={size}
        height={size}
        style={dims}
        loading="lazy"
      />
    );
  }

  const p = avatarPresetById(preset);
  if (p) {
    const glyphSize = Math.round(size * 0.62);
    return (
      <span
        className={cls}
        style={{ ...dims, background: p.bg, color: p.fg }}
        role="img"
        aria-label={label}
      >
        <svg
          viewBox="0 0 24 24"
          width={glyphSize}
          height={glyphSize}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {GLYPHS[p.glyph]}
        </svg>
      </span>
    );
  }

  return (
    <span
      className={cls}
      style={{
        ...dims,
        background: "var(--accent)",
        color: "var(--accent-ink)",
        fontSize: Math.max(11, Math.round(size * 0.38)),
      }}
      role="img"
      aria-label={label}
    >
      <span aria-hidden="true">{initialsFor(name)}</span>
    </span>
  );
}
