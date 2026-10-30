import { test, expect } from "../support/test";
import { dataFile, openSceneFile } from "../support/files";

const box = (i: number) => ({ x: 350 + i * 220, y: 250, width: 160, height: 100 });

test.describe("S5 새로고침과 뒤로 가기 후 상태 유지", () => {
  test("새로고침해도 도형, 속성, 선택 상태가 그대로 남는다", async ({ editor, page }) => {
    await editor.drawShape("Rectangle", box(0));
    await editor.properties.pickStrokeColor("#1971c2");
    await editor.expectStored(([el]) => el?.strokeColor === "#1971c2", "blue stroke saved");
    const before = await editor.storedElements();

    await page.reload();
    await editor.waitUntilReady();

    expect(await editor.storedElements()).toEqual(before);
    // Selection is part of the saved app state, so the panel comes back too.
    await editor.properties.expectVisible();
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("excalidraw-state")!));
    expect(Object.keys(state.selectedElementIds)).toEqual([before[0].id]);
  });

  test("다른 페이지로 갔다가 뒤로 가기로 돌아오면 장면이 복원된다", async ({
    editor,
    page,
  }) => {
    await editor.drawShape("Ellipse", box(0));
    await editor.drawShape("Diamond", box(1));
    await editor.expectStoredCount(2);
    const ids = (await editor.storedElements()).map((e) => e.id);

    await page.goto("about:blank");
    await page.goBack();
    await editor.waitUntilReady();

    await editor.expectStored(
      (els) => els.map((e) => e.id).join() === ids.join(),
      "same elements after back navigation",
    );
  });

  test("다크 모드 선택이 localStorage에 저장되고 새로고침 후에도 유지된다", async ({
    editor,
    page,
  }) => {
    await editor.menu.open();
    await page.getByRole("radio", { name: /^Dark mode/ }).check();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("excalidraw-theme")))
      .toBe("dark");

    await page.reload();
    await editor.waitUntilReady();

    await editor.menu.open();
    await expect(page.getByRole("radio", { name: /^Dark mode/ })).toBeChecked();
  });

  test("실행 취소 기록은 새로고침 후 남지 않는다(장면만 복원)", async ({ editor, page }) => {
    await editor.drawShape("Rectangle", box(0));
    await editor.expectStoredCount(1);
    await expect(editor.undoButton).toBeEnabled();

    await page.reload();
    await editor.waitUntilReady();

    await editor.expectStoredCount(1);
    await expect(editor.undoButton).toBeDisabled();
  });
});

test.describe("S4 실행 취소와 다시 실행: 상태 전이", () => {
  test("3번 그리고 끝까지 되돌린 뒤 끝까지 다시 실행한다", async ({ editor }) => {
    for (const i of [0, 1, 2]) await editor.drawShape("Rectangle", box(i));
    await editor.expectStoredCount(3);

    await editor.undo(3);
    await editor.expectStoredCount(0);
    // History start: nothing left to undo.
    await expect(editor.undoButton).toBeDisabled();
    await expect(editor.redoButton).toBeEnabled();

    await editor.redo(3);
    await editor.expectStoredCount(3);
    // History end: nothing left to redo.
    await expect(editor.redoButton).toBeDisabled();
  });

  test("되돌린 뒤 새로 그리면 다시 실행 기록이 지워진다", async ({ editor }) => {
    await editor.drawShape("Rectangle", box(0));
    await editor.drawShape("Rectangle", box(1));
    await editor.expectStoredCount(2);

    await editor.undo();
    await editor.expectStoredCount(1);
    await expect(editor.redoButton).toBeEnabled();

    await editor.drawShape("Ellipse", box(2));
    await expect(editor.redoButton).toBeDisabled();
    await editor.expectStored(
      (els) => els.map((e) => e.type).join() === "rectangle,ellipse",
      "undone rectangle is not coming back",
    );
  });

  test("단축키 Ctrl+Z, Ctrl+Shift+Z를 번갈아 연속으로 눌러도 상태가 맞는다", async ({
    editor,
    page,
  }) => {
    for (const i of [0, 1]) await editor.drawShape("Rectangle", box(i));
    await editor.expectStoredCount(2);

    const steps = [
      { key: "ControlOrMeta+z", count: 1 },
      { key: "ControlOrMeta+z", count: 0 },
      { key: "ControlOrMeta+z", count: 0 }, // past the start: no change
      { key: "ControlOrMeta+Shift+z", count: 1 },
      { key: "ControlOrMeta+Shift+z", count: 2 },
      { key: "ControlOrMeta+Shift+z", count: 2 }, // past the end: no change
      { key: "ControlOrMeta+z", count: 1 },
    ];
    for (const step of steps) {
      await page.keyboard.press(step.key);
      await editor.expectStoredCount(step.count);
    }
  });

  test("삭제도 실행 취소로 되돌릴 수 있다", async ({ editor, page }) => {
    await editor.drawShape("Rectangle", box(0));
    await editor.expectStoredCount(1);
    await page.keyboard.press("Delete");
    await editor.expectStoredCount(0);

    await editor.undo();
    await editor.expectStoredCount(1);
  });
});

test.describe("메뉴 상태", () => {
  test("메뉴의 Open으로 파일을 불러온 뒤에는 메뉴가 닫혀 있다", async ({ editor }) => {
    test.info().annotations.push({ type: "bug", description: "docs/bugs/BUG-002.md" });
    test.fail(true, "BUG-002: the menu reopens after the file finishes loading");

    await openSceneFile(editor, dataFile("valid-scene.excalidraw"));
    await editor.expectStoredCount(3);

    await expect(editor.menu.item("Reset the canvas")).toBeHidden({ timeout: 2_000 });
  });
});
