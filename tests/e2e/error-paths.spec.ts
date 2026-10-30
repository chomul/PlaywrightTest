import type { Page, Route } from "@playwright/test";
import { test, expect } from "../support/test";
import { SHARE_API } from "../support/network";
import { dataFile, openSceneFile } from "../support/files";
import { EditorPage } from "../pages/EditorPage";

const RECT = { x: 400, y: 250, width: 200, height: 120 };

function errorDialog(page: Page) {
  return page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Error" }),
  });
}

/**
 * Closes a desktop dialog the way a mouse user can. Escape does not work
 * for the error dialog (BUG-003), which has its own test below.
 */
async function closeByClickingOutside(page: Page) {
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width - 40, viewport.height - 120);
}

/**
 * The "Shareable link" dialog. Its URL textbox has no accessible name (the
 * visible "Link" text is not a <label>), so it is the dialog's only textbox.
 */
function shareLinkInput(page: Page) {
  return page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "Shareable link" }) })
    .getByRole("textbox");
}

/** A route handler that holds the request until release() is called. */
function gatedRoute(respond: (route: Route) => Promise<void>) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  return {
    release,
    handler: async (route: Route) => {
      await gate;
      await respond(route);
    },
  };
}

test.describe("S7 공유 링크 내보내기: 백엔드 API 오류", () => {
  test.beforeEach(async ({ editor }) => {
    await editor.drawShape("Rectangle", RECT);
    await editor.expectStoredCount(1);
  });

  test("API가 500을 돌려주면 오류 대화상자로 안내한다", async ({ editor, page }) => {
    await page.route(SHARE_API.post, (route) =>
      route.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" }),
    );

    const save = await editor.menu.openSaveDialog();
    await save.getByRole("button", { name: "Export to Link" }).click();

    await expect(errorDialog(page)).toContainText("Couldn't create shareable link.");
    // The drawing itself is untouched.
    await editor.expectStoredCount(1);
  });

  test("응답이 늦으면 버튼이 비활성화되고, 응답 후 링크를 보여 준다", async ({
    editor,
    page,
  }) => {
    const slow = gatedRoute((route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"id":"e2e-scene"}' }),
    );
    await page.route(SHARE_API.post, slow.handler);

    const save = await editor.menu.openSaveDialog();
    const exportButton = save.getByRole("button", { name: "Export to Link" });
    await exportButton.click();

    // While the request is pending the button cannot be pressed again.
    await expect(exportButton).toBeDisabled();
    slow.release();

    const link = shareLinkInput(page);
    await expect(link).toHaveValue(/#json=e2e-scene,[\w-]+$/);
  });

  test("네트워크가 끊기면 오류 대화상자로 안내하고 다시 시도할 수 있다", async ({
    editor,
    page,
  }) => {
    await page.route(SHARE_API.post, (route) => route.abort("internetdisconnected"));

    const save = await editor.menu.openSaveDialog();
    const exportButton = save.getByRole("button", { name: "Export to Link" });
    await exportButton.click();

    await expect(errorDialog(page)).toContainText("Couldn't create shareable link.");
    await closeByClickingOutside(page);
    await expect(errorDialog(page)).toBeHidden();
    await expect(exportButton).toBeEnabled();
  });
});

test.describe("S7 공유 링크 불러오기: 백엔드 API 오류", () => {
  // A link of the right shape; the key is never sent to the server.
  const LINK = "#json=e2e-scene,AAAAAAAAAAAAAAAAAAAAAA";

  /**
   * window.alert can fire before the load event (seen in Firefox), which
   * blocks navigation, so the handler must be in place before goto.
   */
  async function openLinkExpectingAlert(page: Page, editor: EditorPage) {
    const messages: string[] = [];
    page.on("dialog", (dialog) => {
      messages.push(dialog.message());
      void dialog.accept();
    });
    await page.goto(`/${LINK}`);
    await editor.waitUntilReady();
    await expect.poll(() => messages.length).toBe(1);
    return messages[0];
  }

  test("GET이 500이면 가져오기 실패를 알리고 빈 캔버스로 시작한다", async ({ page }) => {
    await page.route(`${SHARE_API.get}e2e-scene`, (route) =>
      route.fulfill({ status: 500, body: "boom" }),
    );
    const editor = new EditorPage(page);

    expect(await openLinkExpectingAlert(page, editor)).toBe("Importing from backend failed.");
    await expect(editor.undoButton).toBeDisabled();
    expect(await editor.storedElements()).toEqual([]);
  });

  test("네트워크가 끊기면 가져오기 실패를 알린다", async ({ page }) => {
    await page.route(`${SHARE_API.get}e2e-scene`, (route) => route.abort("internetdisconnected"));
    const editor = new EditorPage(page);

    expect(await openLinkExpectingAlert(page, editor)).toBe("Importing from backend failed.");
  });

  test("내보낸 링크를 새 탭에서 열면 같은 장면이 복원된다(왕복)", async ({
    editor,
    page,
    context,
  }) => {
    await editor.drawShape("Ellipse", RECT);
    await editor.expectStoredCount(1);
    const [original] = await editor.storedElements();

    // Keep what the app uploads, then serve it back on GET.
    let uploaded: Buffer | null = null;
    await context.route(SHARE_API.post, async (route) => {
      uploaded = route.request().postDataBuffer();
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"id":"roundtrip"}' });
    });
    await context.route(`${SHARE_API.get}roundtrip`, (route) =>
      route.fulfill({ status: 200, contentType: "application/octet-stream", body: uploaded! }),
    );

    const save = await editor.menu.openSaveDialog();
    await save.getByRole("button", { name: "Export to Link" }).click();
    const link = shareLinkInput(page);
    await expect(link).toHaveValue(/#json=roundtrip,/);
    const url = new URL(await link.inputValue());

    // A fresh tab in a new context would not see our routes; a new page in
    // the same context shares localStorage, so clear it first.
    const other = await context.newPage();
    await other.goto("/");
    await other.evaluate(() => localStorage.clear());
    await other.goto(`/${url.hash}`);
    const otherEditor = new EditorPage(other);
    await otherEditor.waitUntilReady();

    await otherEditor.expectStored(
      (els) => els.length === 1 && els[0].type === "ellipse" && els[0].id === original.id,
      "the shared ellipse is restored",
    );
  });
});

test.describe("S6 .excalidraw 불러오기: 잘못된 파일", () => {
  const badFiles = [
    { file: "broken.excalidraw", what: "깨진 JSON" },
    { file: "empty.excalidraw", what: "0바이트 파일" },
    { file: "wrong-type.excalidraw", what: "형식이 다른 JSON" },
  ];

  for (const { file, what } of badFiles) {
    test(`${what}: 오류를 안내하고 기존 그림을 지키며 앱이 계속 동작한다`, async ({
      editor,
      page,
    }) => {
      await editor.drawShape("Rectangle", RECT);
      await editor.expectStoredCount(1);
      const before = await editor.storedElements();

      await openSceneFile(editor, dataFile(file));

      await expect(errorDialog(page)).toBeVisible();
      await expect(errorDialog(page)).toContainText("invalid file");
      await closeByClickingOutside(page);
      await expect(errorDialog(page)).toBeHidden();

      expect((await editor.storedElements()).map((e) => e.id)).toEqual(before.map((e) => e.id));
      await editor.drawShape("Ellipse", { ...RECT, x: 700 });
      await editor.expectStoredCount(2);
    });
  }
});

test.describe("오류 안내 대화상자: 키보드 사용자", () => {
  test("Escape로 오류 대화상자를 닫을 수 있다", async ({ editor, page }) => {
    test.info().annotations.push({ type: "bug", description: "docs/bugs/BUG-003.md" });
    test.fail(true, "BUG-003: desktop error dialog takes no focus, so Escape is ignored");

    await openSceneFile(editor, dataFile("broken.excalidraw"));
    await expect(errorDialog(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(errorDialog(page)).toBeHidden({ timeout: 2_000 });
  });
});

test.describe("오류 추정: 외부 자원과 저장 데이터 손상", () => {
  test("폰트 CDN에 연결할 수 없어도 그리기와 텍스트 입력이 된다", async ({ page }) => {
    await page.route(/digitaloceanspaces\.com/, (route) => route.abort("internetdisconnected"));
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    const editor = new EditorPage(page);
    await editor.goto();
    await editor.addText({ x: 500, y: 300 }, "font fallback");
    await editor.drawShape("Rectangle", RECT);

    await editor.expectStored(
      (els) => els.some((e) => e.text === "font fallback") && els.some((e) => e.type === "rectangle"),
      "text and rectangle stored without web fonts",
    );
    expect(errors).toEqual([]);
  });

  test("localStorage의 장면 데이터가 깨져 있어도 빈 캔버스로 시작한다", async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("excalidraw", "{not valid json");
        localStorage.setItem("excalidraw-state", "[[[");
        sessionStorage.setItem("seeded", "1");
      }
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    const editor = new EditorPage(page);
    await editor.goto();
    await editor.drawShape("Rectangle", RECT);

    await editor.expectStoredCount(1);
    expect(errors).toEqual([]);
  });
});
