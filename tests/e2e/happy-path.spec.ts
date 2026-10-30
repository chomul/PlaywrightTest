import fs from "node:fs";
import { test, expect } from "../support/test";
import { saveSceneToFile, openSceneFile, dataFile } from "../support/files";

const RECT = { x: 300, y: 200, width: 200, height: 120 };

test.describe("S1 도형 추가와 삭제", () => {
  for (const tool of ["Rectangle", "Diamond", "Ellipse"] as const) {
    test(`${tool}: 툴바로 그리면 요소 1개가 저장된다`, async ({ editor }) => {
      await editor.drawShape(tool, RECT);

      await expect
        .poll(() => editor.storedElements())
        .toEqual([expect.objectContaining({ type: tool.toLowerCase(), ...RECT })]);
      // After drawing, the tool goes back to Selection and the panel opens.
      await expect(editor.toolRadio("Selection")).toBeChecked();
      await editor.properties.expectVisible();
    });
  }

  test("단축키(R, D, O)로 도구를 바꿔 그릴 수 있다", async ({ editor, page }) => {
    const shortcuts = [
      { key: "r", tool: "Rectangle", type: "rectangle" },
      { key: "d", tool: "Diamond", type: "diamond" },
      { key: "o", tool: "Ellipse", type: "ellipse" },
    ] as const;

    for (const [i, s] of shortcuts.entries()) {
      await page.keyboard.press(s.key);
      await expect(editor.toolRadio(s.tool)).toBeChecked();
      await editor.drag({ x: 350 + i * 250, y: 250 }, { x: 500 + i * 250, y: 370 });
    }

    await editor.expectStored(
      (els) => els.map((e) => e.type).join() === "rectangle,diamond,ellipse",
      "three shapes in drawing order",
    );
  });

  test("선택한 도형을 속성 패널의 Delete로 지운다", async ({ editor }) => {
    await editor.drawShape("Rectangle", RECT);
    await editor.expectStoredCount(1);

    await editor.properties.delete();

    await editor.expectStoredCount(0);
    await editor.properties.expectHidden();
  });

  test("Ctrl+A, Delete 키로 모든 도형을 지운다", async ({ editor, page }) => {
    await editor.drawShape("Rectangle", RECT);
    await editor.drawShape("Ellipse", { ...RECT, x: 600 });
    await editor.expectStoredCount(2);

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Delete");

    await editor.expectStoredCount(0);
  });
});

test.describe("S3 스타일 변경", () => {
  test("선 색과 선 굵기를 바꾸면 요소에 반영된다", async ({ editor }) => {
    await editor.drawShape("Rectangle", RECT);
    await editor.expectStoredCount(1);

    await editor.properties.pickStrokeColor("#e03131");
    await editor.properties.setStrokeWidth("extraBold");

    await editor.expectStored(
      ([el]) => el?.strokeColor === "#e03131" && el?.strokeWidth === 4,
      "stroke color red and extra bold width",
    );
  });
});

test.describe("S4 실행 취소와 다시 실행", () => {
  test("그리기 → 실행 취소 → 다시 실행", async ({ editor }) => {
    await expect(editor.undoButton).toBeDisabled();
    await editor.drawShape("Rectangle", RECT);
    await editor.expectStoredCount(1);

    await editor.undo();
    await editor.expectStoredCount(0);
    await expect(editor.redoButton).toBeEnabled();

    await editor.redo();
    await editor.expectStoredCount(1);
    await expect(editor.redoButton).toBeDisabled();
  });
});

test.describe("S6 .excalidraw 저장과 불러오기", () => {
  test("그린 장면을 파일로 저장하고 새 캔버스에서 다시 불러온다", async ({
    editor,
    page,
  }, testInfo) => {
    await editor.drawShape("Rectangle", RECT);
    await editor.drawShape("Ellipse", { ...RECT, x: 600 });
    await editor.expectStoredCount(2);
    const before = await editor.storedElements();

    const saved = await saveSceneToFile(editor, testInfo.outputPath("saved.excalidraw"));
    const json = JSON.parse(fs.readFileSync(saved, "utf8"));
    expect(json.type).toBe("excalidraw");
    expect(json.elements.map((e: { id: string }) => e.id)).toEqual(before.map((e) => e.id));

    // Start from an empty canvas, then load the file back.
    await editor.menu.choose("Reset the canvas");
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await editor.expectStoredCount(0);

    await openSceneFile(editor, saved);
    await editor.expectStored(
      (els) => els.map((e) => e.id).join() === before.map((e) => e.id).join(),
      "same element ids as before saving",
    );
  });

  test("준비된 정상 파일을 불러오면 요소 3개가 복원된다", async ({ editor }) => {
    await openSceneFile(editor, dataFile("valid-scene.excalidraw"));

    await editor.expectStored(
      (els) => els.map((e) => e.id).join() === "rect-1,ellipse-1,text-1",
      "elements from valid-scene.excalidraw",
    );
    const text = (await editor.storedElements()).find((e) => e.type === "text");
    expect(text?.text).toBe("QA sample scene");
  });
});

test.describe("S7 이미지 내보내기", () => {
  test.beforeEach(async ({ editor }) => {
    await openSceneFile(editor, dataFile("valid-scene.excalidraw"));
    await editor.expectStoredCount(3);
  });

  test("PNG로 내보내면 PNG 시그니처를 가진 파일이 내려받아진다", async ({
    editor,
    page,
  }) => {
    const dialog = await editor.menu.openExportImageDialog();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Export to PNG" }).click();

    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.png$/);
    const bytes = fs.readFileSync(await file.path());
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  test("SVG로 내보내면 장면의 도형과 텍스트가 들어 있다", async ({
    editor,
    page,
  }) => {
    const dialog = await editor.menu.openExportImageDialog();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Export to SVG" }).click();

    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.svg$/);
    const svg = fs.readFileSync(await file.path(), "utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("QA sample scene");
    // rough.js draws shapes as <path>; the red ellipse stroke must be there.
    expect(svg).toContain('stroke="#e03131"');
  });
});
