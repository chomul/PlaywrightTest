import fs from "node:fs";
import { test, expect } from "../support/test";

const AT = { x: 500, y: 300 };
const RECT = { x: 400, y: 250, width: 200, height: 120 };

test.describe("S2 텍스트 입력: 경계값", () => {
  test("빈 값(0자): 텍스트 요소가 만들어지지 않는다", async ({ editor }) => {
    await editor.addText(AT, "");
    // Draw something afterwards so we know saving has happened at least once.
    await editor.drawShape("Rectangle", RECT);
    await editor.expectStored(
      (els) => els.length === 1 && els[0].type === "rectangle",
      "only the rectangle is stored, no empty text",
    );
  });

  test("공백만 입력: 텍스트 요소가 만들어지지 않는다", async ({ editor }) => {
    await editor.addText(AT, "    ");
    await editor.drawShape("Rectangle", RECT);
    await editor.expectStored(
      (els) => els.length === 1 && els[0].type === "rectangle",
      "whitespace-only text is discarded",
    );
  });

  test("최소값(1자)이 그대로 저장된다", async ({ editor }) => {
    await editor.addText(AT, "a");
    await editor.expectStored(
      ([el]) => el?.type === "text" && el.text === "a",
      "single character text",
    );
  });

  test("아주 긴 문자열(10,000자)이 잘리지 않고 저장된다", async ({ editor }) => {
    const long = "0123456789".repeat(1000);
    await editor.addText(AT, long);

    await editor.expectStored(
      ([el]) => el?.type === "text" && el.text?.length === 10_000,
      "10,000 characters stored",
    );
    const [el] = await editor.storedElements();
    expect(el.originalText).toBe(long);
    // The editor stays usable after a huge element.
    await editor.selectTool("Rectangle");
  });

  test("여러 줄 입력은 줄바꿈을 유지하고 높이가 늘어난다", async ({ editor }) => {
    await editor.addText(AT, "line 1");
    await editor.expectStoredCount(1);
    const oneLine = (await editor.storedElements())[0].height;

    await editor.addText({ x: AT.x, y: AT.y + 150 }, "line 1\nline 2\nline 3");
    await editor.expectStored(
      (els) => els.some((e) => e.text === "line 1\nline 2\nline 3"),
      "multi-line text stored",
    );
    const multi = (await editor.storedElements()).find((e) => e.text?.includes("line 3"));
    expect(multi!.height).toBeGreaterThan(oneLine * 2.5);
  });
});

test.describe("S2 텍스트 입력: 문자 종류(동등 분할)", () => {
  const cases = [
    { name: "한글", text: "안녕하세요 QA 테스트" },
    { name: "이모지(결합 문자 포함)", text: "👍🏽 👨‍👩‍👧 🇰🇷" },
    { name: "특수문자", text: `~!@#$%^&*()_+-={}[]|\\:;"'<>,.?/` },
  ];

  for (const c of cases) {
    test(`${c.name}가 입력한 그대로 저장된다`, async ({ editor }) => {
      await editor.addText(AT, c.text);
      await editor.expectStored(
        ([el]) => el?.type === "text" && el.text === c.text,
        `${c.name} stored verbatim`,
      );
    });
  }

  test("HTML 태그 문자열은 실행되지 않고, SVG 내보내기에서도 이스케이프된다", async ({
    editor,
    page,
  }) => {
    const payload = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>`;
    let dialogs = 0;
    page.on("dialog", (d) => {
      dialogs++;
      void d.dismiss();
    });

    await editor.addText(AT, payload);
    await editor.expectStored(([el]) => el?.text === payload, "payload stored as text");
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();

    const exportDialog = await editor.menu.openExportImageDialog();
    const download = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "Export to SVG" }).click();
    const svg = fs.readFileSync(await (await download).path(), "utf8");

    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("<img");
    expect(svg).toContain("&lt;script&gt;");
    expect(dialogs).toBe(0);
  });
});

test.describe("S3 스타일: 경계값과 동등 분할", () => {
  test.beforeEach(async ({ editor }) => {
    await editor.drawShape("Rectangle", RECT);
    await editor.properties.expectVisible();
  });

  for (const [width, px] of [
    ["thin", 1],
    ["bold", 2],
    ["extraBold", 4],
  ] as const) {
    test(`선 굵기 ${width} → strokeWidth ${px}`, async ({ editor }) => {
      // Start from a different value so every case is a real change.
      await editor.properties.setStrokeWidth(width === "bold" ? "thin" : "bold");
      await editor.properties.setStrokeWidth(width);
      await editor.expectStored(([el]) => el?.strokeWidth === px, `strokeWidth ${px}`);
    });
  }

  test("불투명도 최소값 0과 최대값 100", async ({ editor }) => {
    const { opacity } = editor.properties;
    await expect(opacity).toHaveValue("100");

    await opacity.fill("0");
    await editor.expectStored(([el]) => el?.opacity === 0, "opacity 0");

    await opacity.fill("100");
    await editor.expectStored(([el]) => el?.opacity === 100, "opacity 100");
  });

  test("불투명도 범위 밖: 100에서 더 올리거나 0에서 더 내려도 범위를 넘지 않는다", async ({
    editor,
  }) => {
    const { opacity } = editor.properties;
    await opacity.focus();

    await opacity.press("End");
    await opacity.press("ArrowRight");
    await opacity.press("ArrowUp");
    await expect(opacity).toHaveValue("100");

    await opacity.press("Home");
    await opacity.press("ArrowLeft");
    await opacity.press("ArrowDown");
    await expect(opacity).toHaveValue("0");
    await editor.expectStored(([el]) => el?.opacity === 0, "opacity clamps at 0");
  });

  test("hex 색 입력: 올바른 값만 적용되고 잘못된 값은 무시된다", async ({ editor }) => {
    const picker = await editor.properties.openStrokeColorPicker();
    const hex = picker.getByRole("textbox", { name: "Stroke" });

    // Invalid: non-hex characters, then 5 digits (between valid 3 and 6).
    for (const bad of ["zzzzzz", "12345"]) {
      await hex.fill(bad);
    }
    // Saving is debounced, so "still the old color" alone would pass before
    // a bad value could be saved. Make a marker change and wait for it: the
    // same save then shows whether the bad input touched the color.
    await hex.press("Escape");
    await editor.properties.setStrokeWidth("thin");
    await editor.expectStored(
      ([el]) => el?.strokeWidth === 1 && el.strokeColor === "#1e1e1e",
      "invalid hex input left the stroke color unchanged",
    );
    await editor.properties.openStrokeColorPicker();

    await hex.fill("f00");
    await editor.expectStored(([el]) => el?.strokeColor === "#f00", "3-digit hex accepted");

    await hex.fill("00ff7f");
    await editor.expectStored(([el]) => el?.strokeColor === "#00ff7f", "6-digit hex accepted");
  });
});
