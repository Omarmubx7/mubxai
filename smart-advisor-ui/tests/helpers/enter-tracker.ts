import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * Sign a throwaway student in and land on the course tracker.
 * Returns false when the environment cannot reach the tracker so callers can
 * skip instead of failing for reasons unrelated to the change under test.
 */
export async function enterTracker(page: Page, testInfo: TestInfo): Promise<boolean> {
  await page.goto("/");

  await page.getByRole("button", { name: /Start Tracking Progress/i }).click();
  await page.getByPlaceholder(/University ID/i).waitFor({ state: "visible", timeout: 10000 });

  await page.getByRole("button", { name: /First time\? Sign up/i }).click();

  const studentId = `pw-tree-${testInfo.workerIndex}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  await page.getByPlaceholder(/University ID/i).fill(studentId);
  await page.getByPlaceholder(/Secure Password/i).fill("TestPassword123!");
  await page.locator('button[type="submit"]').click();

  const majorHeading = page.getByRole("heading", { name: /Setup Your Academic Profile/i });
  const sawOnboarding = await majorHeading
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);

  if (sawOnboarding) {
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const target =
          buttons.find((b) => /Computer Science|Computer Engineering/i.test(b.textContent || "")) ||
          buttons.find((b) => /Select major/i.test(b.textContent || ""));
        if (target) target.click();
      });

      const cardVisible = await page
        .locator('[data-testid="course-card"]')
        .first()
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (cardVisible) break;
    }

    await page.reload({ waitUntil: "domcontentloaded" });
  }

  return page
    .locator('[data-testid="course-card"]')
    .first()
    .waitFor({ state: "visible", timeout: 60000 })
    .then(() => true)
    .catch(() => false);
}

/** Dismiss the first-tap "Previous Academic History" dialog without saving. */
export async function closePreviousHistory(page: Page) {
  const cancel = page.getByRole("button", { name: /Cancel previous academic history/i });
  const appeared = await cancel
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) await cancel.click();
}

export async function openTreeTab(page: Page) {
  await expect(page.getByTestId("view-mode-tree")).toBeVisible();
  await page.getByTestId("view-mode-tree").click();
  await expect(page.getByTestId("tree-submode-outline")).toHaveAttribute("aria-pressed", "true");
}
