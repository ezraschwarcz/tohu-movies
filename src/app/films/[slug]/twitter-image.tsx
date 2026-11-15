/** X (Twitter) uses the same share card as every other app. The
 *  config values are repeated as literals because Next.js reads them
 *  by static analysis and does not follow re-exports. */
import Image from "./opengraph-image";

export const alt = "Watch free on Tohu Movies";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default Image;
