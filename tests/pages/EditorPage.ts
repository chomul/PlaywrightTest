import { expect, type Locator, type Page } from "@playwright/test";
import { MainMenu } from "./MainMenu";
import { PropertiesPanel } from "./PropertiesPanel";

export type Tool =
  | "Selection"
  | "Rectangle"
  | "Diamond"
  | "Ellipse"
  | "Arrow"
  | "Line"
  | "Text"
  | "Eraser";

export type SceneElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  opacity: number;
  isDeleted: boolean;
  text?: string;
  originalText?: string;
};

type Box = { x: number; y: number; width: number; height: number };

/** The whole editor screen: toolbar, canvas, footer actions. */
export class EditorPage {
  readonly toolbar: Locator;
  readonly canvas: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;
  readonly textEditor: Locator;
  readonly menu: MainMenu;
  readonly properties: PropertiesPanel;

  constructor(readonly page: Page) {
    this.toolbar = page.getByRole("region", { name: "Shapes" });
    // The drawing surface is a <canvas> without a role; this is the one
    // place a CSS locator is unavoidable.
    this.canvas = page.locator("canvas.interactive");
    this.undoButton = page.getByRole("button", { name: "Undo" });
    this.redoButton = page.getByRole("button", { name: "Redo" });
    this.textEditor = page.locator("textarea.excalidraw-wysiwyg");
    this.menu = new MainMenu(page);
    this.properties = new PropertiesPanel(page);
  }

  async goto(hash = "") {
    await this.page.goto(`/${hash}`);
    await this.waitUntilReady();
  }

  async waitUntilReady() {
    await expect(this.canvas).toBeVisible();
    await expect(this.toolRadio("Selection")).toBeAttached();
  }

  toolRadio(tool: Tool) {
    return this.toolbar.getByRole("radio", { name: tool, exact: false }).first();
  }

  /**
   * The radio input sits under its icon, so the click goes to the label
   * (title "Rectangle — R or 2"). The radio state is the assertion.
   */
  async selectTool(tool: Tool) {
    await this.toolbar.getByTitle(new RegExp(`^${tool}\\b`)).click();
    await expect(this.toolRadio(tool)).toBeChecked();
  }

  /** Drag on the canvas in viewport coordinates (scene = viewport at 100%). */
  async drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    const { mouse } = this.page;
    await mouse.move(from.x, from.y);
    await mouse.down();
    await mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await mouse.move(to.x, to.y, { steps: 4 });
    // Excalidraw runs only the first pointermove of each animation frame
    // (throttleRAF without trailing). Synthetic moves share a frame, so the
    // end point can be dropped (seen in WebKit). Send the end point again in
    // a fresh frame so it is the one applied. See docs/FLAKY.md.
    await this.nextFrame();
    await mouse.move(to.x + 1, to.y + 1);
    await this.nextFrame();
    await mouse.move(to.x, to.y);
    await this.nextFrame();
    await mouse.up();
  }

  /** Resolves on the next animation frame: a sync point, not a fixed delay. */
  async nextFrame() {
    await this.page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
  }

  async drawShape(tool: Tool, box: Box) {
    await this.selectTool(tool);
    await this.drag(
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y + box.height },
    );
  }

  async addText(at: { x: number; y: number }, text: string) {
    await this.selectTool("Text");
    await this.page.mouse.click(at.x, at.y);
    await expect(this.textEditor).toBeFocused();
    if (text) await this.textEditor.fill(text);
    await this.page.keyboard.press("Escape");
    await expect(this.textEditor).toBeHidden();
  }

  async clickCanvas(at: { x: number; y: number }) {
    await this.page.mouse.click(at.x, at.y);
  }

  /** Elements as persisted to localStorage (what survives a reload). */
  async storedElements(opts: { includeDeleted?: boolean } = {}) {
    const raw = await this.page.evaluate(() =>
      window.localStorage.getItem("excalidraw"),
    );
    const all: SceneElement[] = raw ? JSON.parse(raw) : [];
    return opts.includeDeleted ? all : all.filter((el) => !el.isDeleted);
  }

  /**
   * Saving is debounced (300ms) and can also fire mid-drag, so a stored
   * element may still have intermediate values. Poll for the final values
   * instead of reading once the count matches (see docs/FLAKY.md).
   */
  async expectStoredCount(count: number) {
    await expect
      .poll(async () => (await this.storedElements()).length, {
        message: `stored element count should become ${count}`,
      })
      .toBe(count);
  }

  async expectStored(
    predicate: (els: SceneElement[]) => boolean,
    message: string,
  ) {
    await expect
      .poll(async () => predicate(await this.storedElements()), { message })
      .toBe(true);
  }

  async undo(times = 1) {
    for (let i = 0; i < times; i++) await this.undoButton.click();
  }

  async redo(times = 1) {
    for (let i = 0; i < times; i++) await this.redoButton.click();
  }
}
