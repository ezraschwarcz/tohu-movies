import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/** Next.js 16 proxy (the `middleware` convention renamed). Refreshes the
 *  Supabase session on every matched request so server components see a
 *  current session. It never redirects or blocks; route protection lives
 *  in the pages themselves (the admin page returns 404 for non-admins). */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // All paths except static files, image optimization, and the favicon.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
