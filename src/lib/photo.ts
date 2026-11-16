import type { SupabaseClient } from "@supabase/supabase-js";

/** Get a chosen photo ready for the cropper.
 *
 *  Two things go wrong with phone photos if the file is used as is:
 *  - Phones hand over very large photos (24 to 48 megapixels). Opening
 *    one at full size can exhaust a phone browser's memory, and the
 *    cropper shows nothing.
 *  - On iPhone the chosen file can be a temporary copy that disappears
 *    once the file field is cleared.
 *  So the photo is read into memory straight away and redrawn at a
 *  sensible working size (longest side 1600px), which is plenty for a
 *  512px profile picture. */
const WORKING_SIDE = 1600;

export async function preparePhoto(file: File): Promise<Blob> {
  let copy: Blob;
  try {
    copy = new Blob([await file.arrayBuffer()], {
      type: file.type || "image/jpeg",
    });
  } catch {
    throw new Error("That photo could not be read. Try choosing it again.");
  }
  const url = URL.createObjectURL(copy);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable"));
      el.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error("unreadable");
    const scale = Math.min(1, WORKING_SIDE / Math.max(w, h));
    if (scale === 1 && copy.size < 4_000_000) return copy;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return copy;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    return out ?? copy;
  } catch {
    throw new Error(
      "That file could not be opened as a photo. Try a JPG or PNG, or take a new photo.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Upload a finished profile picture and return its public address.
 *  The address is stable per member, so a cache-buster is added to
 *  make the new photo show at once. */
export async function uploadAvatarPhoto(
  supabase: SupabaseClient,
  userId: string,
  blob: Blob,
): Promise<string> {
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) {
    throw new Error(
      /bucket|not found/i.test(error.message)
        ? "Photo upload is not set up yet. The preset avatars still work."
        : error.message,
    );
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
