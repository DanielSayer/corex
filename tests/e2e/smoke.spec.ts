import { expect, test } from "@playwright/test";

test("landing page routes into the auth flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "API Status" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();

  await page.getByRole("link", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
  await page.getByRole("button", { name: "Already have an account? Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
});
