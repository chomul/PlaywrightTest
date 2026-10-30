import { test, expect } from "../support/test";
import { dataFile, openSceneFile } from "../support/files";

// Baselines are per browser and OS (see snapshotPathTemplate). The sample
// scene file fixes every element's seed, so rough.js draws the same strokes
// on each run; fonts come from the local build through the network guard.

test.describe("시각 회귀 @visual @mobile", () => {
  test("첫 화면(환영 화면과 툴바)", async ({ editor, page }) => {
    await expect(page.getByText("All your data is saved locally in your browser.")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("welcome.png");
  });

  test("정상 파일을 불러온 캔버스", async ({ editor, page }) => {
    await openSceneFile(editor, dataFile("valid-scene.excalidraw"));
    await editor.expectStoredCount(3);
    // Close the menu that reopens after loading (BUG-002) and clear selection.
    if (await editor.menu.isOpen) await editor.menu.trigger.click();
    await expect(editor.menu.content).toBeHidden();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot("loaded-scene.png");
  });

  test("이미지 내보내기 대화상자와 미리보기", async ({ editor, page }) => {
    await openSceneFile(editor, dataFile("valid-scene.excalidraw"));
    await editor.expectStoredCount(3);
    const dialog = await editor.menu.openExportImageDialog();
    await expect(dialog.getByRole("button", { name: "Export to PNG" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await expect(dialog).toHaveScreenshot("export-dialog.png", {
      // The file name defaults to "Untitled-<date>-<time>".
      mask: [dialog.getByRole("textbox").first()],
    });
  });
});
