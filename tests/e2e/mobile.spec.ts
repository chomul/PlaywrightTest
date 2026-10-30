import { test, expect } from "../support/test";
import { dataFile, openSceneFile } from "../support/files";

// Pixel 7 viewport (412x839): toolbar at the top, menu and undo/redo at the
// bottom, no properties sidebar.
const RECT = { x: 120, y: 350, width: 160, height: 120 };

test.describe("S8 모바일 뷰포트 툴바 @mobile-only", () => {
  test("툴바가 화면 너비 안에 모두 보인다", async ({ editor, page }) => {
    const viewport = page.viewportSize()!;
    for (const tool of ["Selection", "Rectangle", "Diamond", "Ellipse", "Arrow", "Text", "Eraser"] as const) {
      const radio = editor.toolRadio(tool);
      await expect(radio).toBeAttached();
      const label = editor.toolbar.getByTitle(new RegExp(`^${tool}\\b`));
      await expect(label).toBeInViewport({ ratio: 1 });
    }
    const box = await editor.toolbar.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  });

  for (const tool of ["Rectangle", "Diamond", "Ellipse"] as const) {
    test(`${tool} 도구를 탭하고 그리면 요소가 저장된다`, async ({ editor }) => {
      await editor.drawShape(tool, RECT);
      await expect
        .poll(() => editor.storedElements())
        .toEqual([expect.objectContaining({ type: tool.toLowerCase(), ...RECT })]);
    });
  }

  test("하단 바의 실행 취소와 다시 실행이 동작한다", async ({ editor }) => {
    await editor.drawShape("Rectangle", RECT);
    await editor.expectStoredCount(1);

    await editor.undo();
    await editor.expectStoredCount(0);
    await editor.redo();
    await editor.expectStoredCount(1);
  });

  test("하단 메뉴 버튼으로 메뉴를 열고 주요 항목이 화면 안에 보인다", async ({ editor }) => {
    await editor.menu.open();
    for (const item of ["Open", "Save to...", "Export image...", "Reset the canvas"]) {
      await expect(editor.menu.item(item)).toBeInViewport();
    }
  });

  test("모바일에서는 오류 대화상자에 닫기 버튼이 있어 닫을 수 있다", async ({ editor, page }) => {
    await openSceneFile(editor, dataFile("broken.excalidraw"));
    const error = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error" }),
    });
    await expect(error).toContainText("invalid file");

    await error.getByRole("button", { name: "Close" }).click();
    await expect(error).toBeHidden();
  });
});
