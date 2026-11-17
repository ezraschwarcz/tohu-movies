import { expect, test } from "@playwright/test";
import { blockMux, signIn } from "./helpers";

// Pages that need an account. The stand-in database plays a member or an admin.

test.beforeEach(async ({ page }) => {
  await blockMux(page);
});

test("signed out, the profile sends you to sign in", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile|\/login\?next=\/profile/);
});

test("signed out, the control room does not exist", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
});

test.describe("as a member", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, "member", baseURL!);
  });

  test("profile home shows their stats", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText("Maya").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /history/i }).first()).toBeVisible();
  });

  test("each settings screen opens", async ({ page }) => {
    for (const [view, text] of [
      ["name", /name/i],
      ["avatar", /photo/i],
      ["security", "iPhone"],
      ["preferences", /R rated/i],
    ] as const) {
      await page.goto(`/profile?view=${view}`);
      await expect(page.getByText(text).first()).toBeVisible();
    }
  });

  test("watchlist lists saved films", async ({ page }) => {
    await page.goto("/watchlist");
    await expect(page.locator('main a[href^="/films/"]').first()).toBeVisible();
  });

  test("members cannot open the control room", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
  });
});

test.describe("as an admin", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, "admin", baseURL!);
  });

  test("every control room tab opens", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Control room" })).toBeVisible();
    for (const [tab, text] of [
      ["Insights", /signed up|sign-up|viewing/i],
      ["Films", "Zombeavers"],
      ["Comments", "Where was this filmed?"],
      ["Members", "dana@example.com"],
      ["Emails", /Friday/i],
      ["Log", "Made admin"],
      ["Tools", /email/i],
      ["Overview", /Members/],
    ] as const) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByText(text).first()).toBeVisible();
    }
  });
});
