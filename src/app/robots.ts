import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Robots rules, served at /robots.txt. Everything public is crawlable;
 *  account, admin, and auth-flow paths are kept out of the index. Points
 *  crawlers at the generated sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/profile", "/watchlist", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
