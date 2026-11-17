import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { blockMux, signIn } from "./helpers";

// Automated accessibility checks (axe, WCAG 2 A and AA) on the main pages.
// Only definite failures count; "needs review" items (text on photos) are
// left for people to judge.

const pages: { path: string; who?: "member" | "admin" }[] = [
  { path: "/" },
  { path: "/browse" },
  { path: "/films/jinn" },
  { path: "/login" },
  { path: "/submit" },
  { path: "/about" },
  { path: "/profile", who: "member" },
  { path: "/admin", who: "admin" },
];

for (const { path, who } of pages) {
  test(`${path}${who ? ` (${who})` : ""} has no accessibility failures`, async ({ page, context, baseURL }) => {
    await blockMux(page);
    if (who) await signIn(context, who, baseURL!);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Every film has captions, but they arrive inside the video stream
      // (Mux, English, auto-generated) and are added by the player, so
      // axe cannot see them in the page and would report them missing.
      .disableRules(["video-caption"])
      .analyze();
    const failures = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`);
    expect(failures).toEqual([]);
  });
}
