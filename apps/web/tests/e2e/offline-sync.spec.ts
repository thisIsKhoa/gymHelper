import { expect, test } from "@playwright/test";

test("log set offline then sync successfully", async ({ page }) => {
  const unique = Date.now();
  const email = `offline-e2e-${unique}@example.com`;
  const password = "StrongPass123";

  await page.goto("/auth");
  await page.getByRole("button", { name: /register/i }).click();
  await page.getByLabel("Name").fill("Offline E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^register$/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/session");

  let shouldFailWorkoutPost = true;
  await page.route("**/api/v1/workouts", async (route, request) => {
    if (request.method() === "POST" && shouldFailWorkoutPost) {
      shouldFailWorkoutPost = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Simulated offline failure" }),
      });
      return;
    }

    await route.continue();
  });

  await page.getByLabel("Sets").fill("1");
  await page.getByLabel("Reps").fill("8");
  await page.getByLabel("Weight (kg)").fill("60");
  await page.getByRole("button", { name: /log set \(l\)/i }).click();

  await expect(page.getByText(/offline mode: set queued/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sync offline \(1\)/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /sync offline/i }).click();

  await expect(page.getByText("All offline workouts synced.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sync offline \(0\)/i }),
  ).toBeVisible();
  await expect(
    page.getByText("Offline workouts synced successfully"),
  ).toBeVisible();
});
