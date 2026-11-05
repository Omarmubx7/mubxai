import { test, expect } from "@playwright/test";
import {
  closePreviousHistory,
  enterTracker,
  openTreeTab,
} from "./helpers/enter-tracker";

test.describe.configure({ timeout: 150000 });

test.describe("Course Tree View", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const reachedTracker = await enterTracker(page, testInfo);
    test.skip(!reachedTracker, "Course tracker is not reachable in this environment");
  });

  test("third tab renders the outline hierarchy", async ({ page }) => {
    await openTreeTab(page);

    const years = page.getByTestId("tree-year");
    await expect(years.first()).toBeVisible();
    expect(await years.count()).toBeGreaterThan(0);

    // Years start expanded, so categories and their courses are visible.
    await expect(page.getByTestId("tree-category").first()).toBeVisible();
    await expect(page.getByTestId("tree-course").first()).toBeVisible();
  });

  test("a year collapses and expands", async ({ page }) => {
    await openTreeTab(page);

    const year = page.getByTestId("tree-year").first();
    const toggle = year.locator("button").first();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  test("toggling a tree course persists across reload", async ({ page }) => {
    await openTreeTab(page);

    // Prefer an unlocked, not-yet-completed course: a locked one is disabled.
    const courses = page.getByTestId("tree-course");
    const count = await courses.count();
    let target = null;

    for (let i = 0; i < count; i++) {
      const candidate = courses.nth(i);
      const toggle = candidate.getByRole("button").first();
      if (await toggle.isEnabled().catch(() => false)) {
        target = candidate;
        break;
      }
    }

    test.skip(!target, "No unlocked course available");
    const code = await target!.getAttribute("data-code");
    expect(code).toBeTruthy();

    await target!.locator("button").first().click();
    await closePreviousHistory(page);

    await page.waitForTimeout(600);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("course-card").first().waitFor({ state: "visible", timeout: 60000 });
    await openTreeTab(page);

    const restored = page.locator(`[data-testid="tree-course"][data-code="${code}"]`);
    await expect(restored.getByRole("button").first()).toHaveAttribute(
      "aria-label",
      /Completed.*Click to unmark/i
    );
  });

  test("search filters the outline", async ({ page }) => {
    await openTreeTab(page);

    const firstCourse = page.getByTestId("tree-course").first();
    const name = (await firstCourse.locator("span.truncate").first().textContent())?.trim() ?? "";
    test.skip(!name, "Could not read a course name");

    await page.getByLabel("Search courses in the tree").fill(name.slice(0, 12));
    await expect(page.getByTestId("tree-course").first()).toBeVisible();

    const visibleCourses = page.getByTestId("tree-course");
    const names = await visibleCourses.allTextContents();
    expect(names.some((text) => text.includes(name.slice(0, 6)))).toBe(true);
  });

  test("map renders nodes and focuses a prerequisite path", async ({ page }) => {
    await openTreeTab(page);
    await page.getByTestId("tree-submode-map").click();

    const map = page.getByTestId("tree-map");
    await expect(map).toBeVisible();
    // On a phone the map sits below the fold; bring it to the top so the
    // course buttons clear the fixed bottom navigation.
    await map.evaluate((el) => el.scrollIntoView({ block: "start" }));

    const nodes = page.getByTestId("map-node");
    expect(await nodes.count()).toBeGreaterThan(0);

    // Focus a course that has prerequisites so the focus panel shows chips.
    await nodes.first().getByRole("button", { name: /^Focus / }).click({ force: true });
    await expect(page.getByRole("button", { name: /Clear course focus/i })).toBeVisible();

    await page.getByRole("button", { name: /Clear course focus/i }).click();
    await expect(page.getByRole("button", { name: /Clear course focus/i })).toBeHidden();
  });

  test("map zoom controls change the zoom label", async ({ page }) => {
    await openTreeTab(page);
    await page.getByTestId("tree-submode-map").click();

    await expect(page.getByTestId("tree-map")).toBeVisible();

    const label = page.getByTestId("map-zoom-level");
    const before = (await label.textContent())?.trim();

    await page.getByRole("button", { name: /Zoom in/i }).click();
    await expect(label).not.toHaveText(before ?? "");
  });

  test("map flows horizontally with landscape course tiles", async ({ page }) => {
    await openTreeTab(page);
    await page.getByTestId("tree-submode-map").click();

    await expect(page.getByTestId("tree-map")).toBeVisible();

    // Course tiles are landscape rectangles with horizontal names.
    const nodes = page.getByTestId("map-node");
    await expect(nodes.first()).toBeVisible();
    const count = await nodes.count();
    expect(count).toBeGreaterThan(10);

    const node = nodes.first();
    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(box!.height);

    const writingMode = await node
      .getByTestId("map-node-name")
      .evaluate((el) => getComputedStyle(el).writingMode);
    expect(writingMode).toBe("horizontal-tb");
  });

  test("dragging the map pans it without toggling a course", async ({ page }) => {
    await openTreeTab(page);
    await page.getByTestId("tree-submode-map").click();
    await expect(page.getByTestId("tree-map")).toBeVisible();
    await page.getByTestId("tree-map").evaluate((el) => el.scrollIntoView({ block: "start" }));

    const canvas = page.getByTestId("map-canvas");
    const before = await canvas.getAttribute("style");

    // Dragging from an enabled card must pan, not toggle the card.
    const nodes = page.getByTestId("map-node");
    const nodeCount = await nodes.count();
    let node = null;
    for (let i = 0; i < nodeCount; i++) {
      if (await nodes.nth(i).getByRole("button").first().isEnabled().catch(() => false)) {
        node = nodes.nth(i);
        break;
      }
    }
    test.skip(!node, "No enabled map node available");

    const nodeLabelBefore = await node!.getByRole("button").first().getAttribute("aria-label");
    const box = await node!.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 90, startY + 70, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await canvas.getAttribute("style");
    expect(after).not.toBe(before);

    // The drag must not count as a tap on the course it started on.
    await expect(node!.getByRole("button").first()).toHaveAttribute(
      "aria-label",
      nodeLabelBefore ?? ""
    );
  });

  test("tree mode choice survives a reload", async ({ page }) => {
    await openTreeTab(page);
    await page.getByTestId("tree-submode-map").click();
    await expect(page.getByTestId("tree-map")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("course-card").first().waitFor({ state: "visible", timeout: 60000 });
    await page.getByTestId("view-mode-tree").click();

    await expect(page.getByTestId("tree-submode-map")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("tree-map")).toBeVisible();
  });
});
