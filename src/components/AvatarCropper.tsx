"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHydrated, useViewportSize } from "@/lib/clientState";

/** Photo cropper for the profile picture: drag the photo to position
 *  it, use the slider (or pinch / scroll) to zoom, and save. The circle
 *  shows exactly what other members will see. Everything happens on the
 *  device; only the finished 512px square is uploaded. */

const MAX_VIEW = 280; // on-screen crop square on a roomy screen, px
const OUT = 512; // saved image, px
const MAX_ZOOM = 4;

export default function AvatarCropper({
  file,
  busy,
  onCancel,
  onSave,
}: {
  file: Blob;
  busy: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}) {
  // A temporary address for the chosen photo, released when it changes.
  const src = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  // Drawn on <body> in the browser only.
  const mounted = useHydrated();
  /** The crop square shrinks to fit a small or short phone screen, so
   *  the buttons under it are always reachable. */
  const viewport = useViewportSize();
  const VIEW = Math.round(
    Math.max(170, Math.min(MAX_VIEW, viewport.width - 78, viewport.height - 330)),
  );
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Keep the page behind the cropper from scrolling while it is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // The photo always covers the square: at zoom 1 its shorter side
  // exactly fills it.
  const base = natural ? VIEW / Math.min(natural.w, natural.h) : 1;
  const shown = natural
    ? { w: natural.w * base * zoom, h: natural.h * base * zoom }
    : { w: VIEW, h: VIEW };

  const clamp = useCallback(
    (next: { x: number; y: number }, z: number) => {
      if (!natural) return next;
      const w = natural.w * base * z;
      const h = natural.h * base * z;
      const maxX = Math.max(0, (w - VIEW) / 2);
      const maxY = Math.max(0, (h - VIEW) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [natural, base, VIEW],
  );

  function changeZoom(next: number) {
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    setZoom(z);
    setOffset((o) => clamp(o, z));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0) {
        changeZoom(pinch.current.zoom * (dist / pinch.current.dist));
      }
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { id: d.id, x: e.clientX, y: e.clientY };
    setOffset((o) => clamp({ x: o.x + dx, y: o.y + dy }, zoom));
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 20 : 6;
    let handled = true;
    if (e.key === "ArrowLeft") setOffset((o) => clamp({ x: o.x + step, y: o.y }, zoom));
    else if (e.key === "ArrowRight") setOffset((o) => clamp({ x: o.x - step, y: o.y }, zoom));
    else if (e.key === "ArrowUp") setOffset((o) => clamp({ x: o.x, y: o.y + step }, zoom));
    else if (e.key === "ArrowDown") setOffset((o) => clamp({ x: o.x, y: o.y - step }, zoom));
    else if (e.key === "+" || e.key === "=") changeZoom(zoom + 0.1);
    else if (e.key === "-") changeZoom(zoom - 0.1);
    else handled = false;
    if (handled) e.preventDefault();
  }

  async function save() {
    const img = imgRef.current;
    if (!img || !natural) return;
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not process that photo.");
      // The visible square, expressed in the photo's own pixels.
      const scale = base * zoom;
      const side = VIEW / scale;
      const sx = natural.w / 2 - offset.x / scale - side / 2;
      const sy = natural.h / 2 - offset.y / scale - side / 2;
      ctx.fillStyle = "#16130e";
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, side, side, 0, 0, OUT, OUT);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.88),
      );
      if (!blob) throw new Error("Could not process that photo.");
      onSave(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that photo.");
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="cropper-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cropper-title"
    >
      <div className="cropper-panel">
        <h2 id="cropper-title">Position your photo</h2>
        <p className="cropper-hint">
          Drag to move. Pinch or use the slider to zoom. The circle is what others see.
        </p>
        <div
          className="cropper-stage"
          style={{ width: VIEW, height: VIEW }}
          tabIndex={0}
          role="group"
          aria-label="Photo position. Use the arrow keys to move and plus or minus to zoom."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          onWheel={(e) => changeZoom(zoom - e.deltaY * 0.0015)}
        >
          {src ? (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ w: el.naturalWidth, h: el.naturalHeight });
              }}
              onError={() => setError("That file could not be opened as a photo.")}
              style={{
                width: shown.w,
                height: shown.h,
                left: (VIEW - shown.w) / 2 + offset.x,
                top: (VIEW - shown.h) / 2 + offset.y,
                visibility: natural ? "visible" : "hidden",
              }}
            />
          ) : null}
          <span className="cropper-mask" aria-hidden="true" />
        </div>
        <label className="cropper-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            disabled={!natural}
          />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="cropper-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="play-btn"
            onClick={() => void save()}
            disabled={busy || !natural}
          >
            {busy ? "Saving…" : "Save photo"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
