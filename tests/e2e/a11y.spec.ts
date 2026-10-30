import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";
import { SHARE_API } from "../support/network";

/**
 * Violations already investigated. Each is either filed (docs/bugs) or a
 * deliberate design choice. Anything else fails the test, so a new
 * violation cannot slip in unnoticed.
 */
const KNOWN = [
  { id: "button-name", target: /main-menu-trigger/, ref: "BUG-001" },
  { id: "label", target: /filename|TextInput|exportScale|readonly/, ref: "BUG-001" },
  { id: "color-contrast", target: /Save to file/, ref: "BUG-004" },
  // user-scalable=no: the canvas implements its own pinch zoom. Not filed.
  { id: "meta-viewport", target: /viewport/, ref: "design" },
];

/** Dialogs fade in; scanning mid-animation reports false contrast errors. */
async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
}

async function scan(page: Page) {
  await settleAnimations(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const unknown: string[] = [];
  const known = new Set<string>();
  for (const v of violations) {
    for (const node of v.nodes) {
      const target = node.target.join(" ");
      const match = KNOWN.find((k) => k.id === v.id && k.target.test(target));
      if (match) known.add(`${match.ref}: ${v.id}`);
      else unknown.push(`${v.id} [${v.impact}] ${target}`);
    }
  }
  test.info().annotations.push(
    ...[...known].map((description) => ({ type: "a11y-known", description })),
  );
  return unknown;
}

test.describe("접근성 스모크(axe, WCAG 2 A/AA)", () => {
  test("첫 화면 @mobile", async ({ editor, page }) => {
    expect(await scan(page)).toEqual([]);
  });

  test("도형 선택 시 속성 패널", async ({ editor, page }) => {
    await editor.drawShape("Rectangle", { x: 400, y: 250, width: 200, height: 120 });
    await editor.properties.expectVisible();
    expect(await scan(page)).toEqual([]);
  });

  test("메인 메뉴 @mobile", async ({ editor, page }) => {
    await editor.menu.open();
    expect(await scan(page)).toEqual([]);
  });

  test("저장 대화상자와 공유 링크 대화상자", async ({ editor, page }) => {
    await page.route(SHARE_API.post, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"id":"a11y"}' }),
    );
    await editor.drawShape("Rectangle", { x: 400, y: 250, width: 200, height: 120 });

    const save = await editor.menu.openSaveDialog();
    expect(await scan(page)).toEqual([]);

    await save.getByRole("button", { name: "Export to Link" }).click();
    await expect(page.getByRole("heading", { name: "Shareable link" })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test("이미지 내보내기 대화상자", async ({ editor, page }) => {
    await editor.drawShape("Rectangle", { x: 400, y: 250, width: 200, height: 120 });
    await editor.menu.openExportImageDialog();
    expect(await scan(page)).toEqual([]);
  });
});

test.describe("알려진 접근성 결함(수정되면 통과로 바뀌어 알려 줌)", () => {
  test("메인 메뉴 버튼에 접근 가능한 이름이 있다", async ({ editor }) => {
    test.info().annotations.push({ type: "bug", description: "docs/bugs/BUG-001.md" });
    test.fail(true, "BUG-001: hamburger button has no accessible name");
    await expect(editor.menu.trigger).toHaveAccessibleName(/menu/i, { timeout: 2_000 });
  });

  test("저장 대화상자의 Save to file 버튼 글자 대비가 4.5:1 이상이다", async ({ editor, page }) => {
    test.info().annotations.push({ type: "bug", description: "docs/bugs/BUG-004.md" });
    test.fail(true, "BUG-004: white on #74b816 is 2.43:1");
    await editor.drawShape("Rectangle", { x: 400, y: 250, width: 200, height: 120 });
    await editor.menu.openSaveDialog();
    await settleAnimations(page);

    const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(violations).toEqual([]);
  });
});
