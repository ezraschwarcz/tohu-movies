/** Preset profile avatars (Phase 5.2). A preset is a solid color disc
 *  with a simple film/fun glyph drawn in a near-white stroke; the
 *  glyph paths live in the Avatar component (GLYPHS), keyed by
 *  `glyph`. Presets are stored on profiles.avatar_preset as the `id`.
 *  No images, no uploads, nothing to host: they render as inline SVG
 *  everywhere (profile, header, comments). */

export type AvatarPreset = {
  id: string;
  label: string;
  /** Solid background hex for the disc. */
  bg: string;
  /** Glyph stroke color, near-white on every background. */
  fg: string;
  /** Key into the Avatar component's glyph set. */
  glyph: string;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "clapper", label: "Clapperboard", bg: "#8c2f26", fg: "#fdf6ec", glyph: "clapper" },
  { id: "popcorn", label: "Popcorn", bg: "#0f766e", fg: "#fdf6ec", glyph: "popcorn" },
  { id: "ticket", label: "Ticket", bg: "#3730a3", fg: "#fdf6ec", glyph: "ticket" },
  { id: "camera", label: "Camera", bg: "#6d28d9", fg: "#fdf6ec", glyph: "camera" },
  { id: "reel", label: "Film reel", bg: "#166534", fg: "#fdf6ec", glyph: "reel" },
  { id: "star", label: "Star", bg: "#1e3a5f", fg: "#fdf6ec", glyph: "star" },
  { id: "screen", label: "TV screen", bg: "#b4530a", fg: "#fdf6ec", glyph: "screen" },
  { id: "heart", label: "Heart", bg: "#475569", fg: "#fdf6ec", glyph: "heart" },
  { id: "bolt", label: "Bolt", bg: "#5f6c11", fg: "#fdf6ec", glyph: "bolt" },
  { id: "music", label: "Music note", bg: "#7f1d3a", fg: "#fdf6ec", glyph: "music" },
];

/** The preset for an id, or null when the id is missing or unknown
 *  (older data, a preset removed later): callers fall back to
 *  initials. */
export function avatarPresetById(id: string | null | undefined): AvatarPreset | null {
  if (!id) return null;
  return AVATAR_PRESETS.find((p) => p.id === id) ?? null;
}
