"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getServerAuth } from "@/lib/supabase/server";

/** Refresh the cached film list and home page after an admin adds a film,
 *  so the new film appears immediately instead of waiting out the 60
 *  second cache. Authorization is verified here, not just in the page:
 *  only an admin may call it. updateTag (not revalidateTag) is the
 *  Server Action form: it expires the tag immediately, with
 *  read-your-own-writes semantics. */
export async function revalidateFilms() {
  const { isAdmin } = await getServerAuth();
  if (!isAdmin) {
    throw new Error("Not an admin.");
  }
  updateTag("films");
  revalidatePath("/", "page");
}
