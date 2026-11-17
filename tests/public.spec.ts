import { expect, test } from "@playwright/test";
import { blockMux } from "./helpers";

// Pages anyone can see, signed out.

test.beforeEach(async ({ page }) => {
  await blockMux(page);
});

test("home page lists films and links to them", async ({ page }) => {
  await page.goto("/");
  const grid = page.locator("#now-streaming");
  await expect(grid.locator('a[href="/films/jinn"]').first()).toBeVisible();
  expect(await grid.locator('a[href^="/films/"]').count()).toBeGreaterThan(20);
});

test("search narrows the list of films", async ({ page, isMobile }) => {
  test.skip(isMobile, "The phone layout opens search from the bottom bar.");
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search films" }).fill("zombeavers");
  const grid = page.locator("#now-streaming");
  await expect(grid.locator('a[href="/films/zombeavers"]').first()).toBeVisible();
  await expect(grid.locator('a[href="/films/jinn"]')).toHaveCount(0);
});

test("film page shows the film, its people and its comments", async ({ page }) => {
  await page.goto("/films/jinn");
  await expect(page.getByRole("heading", { level: 1, name: "Jinn" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Jane Doe" }).first()).toHaveAttribute("href", "/people/jane-doe");
  await expect(page.getByText("Loved the ending, did not see it coming.")).toBeVisible();
});

test("an R-rated film asks for age before playing", async ({ page }) => {
  await page.goto("/films/zombeavers");
  await expect(page.getByText("This film is rated R.")).toBeVisible();
});

test("/browse lists genres and collections", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('main a[href^="/genre/"]').first()).toBeVisible();
  await expect(page.locator('main a[href^="/collections/"]').first()).toBeVisible();
});

for (const path of ["/genre/drama", "/collections/true-stories", "/people/jane-doe"]) {
  test(`${path} lists films`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.locator('main a[href^="/films/"]').count()).toBeGreaterThan(0);
  });
}

for (const path of ["/about", "/contact", "/faq", "/guidelines", "/copyright", "/advertise", "/submit", "/privacy", "/terms", "/cookies"]) {
  test(`${path} loads`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("a missing page says so", async ({ page }) => {
  const response = await page.goto("/films/no-such-film");
  expect(response?.status()).toBe(404);
});

test("sign-in page asks for an email", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
});

test("search engines get a sitemap and robots file", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain("/films/jinn");
  expect((await request.get("/robots.txt")).ok()).toBeTruthy();
});
