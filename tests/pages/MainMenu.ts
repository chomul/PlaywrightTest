import { expect, type Locator, type Page } from "@playwright/test";

/** Hamburger menu and the dialogs it opens. */
export class MainMenu {
  readonly trigger: Locator;
  readonly content: Locator;

  constructor(readonly page: Page) {
    // The trigger button has no accessible name (see docs/bugs), so the
    // app's own test id is used.
    this.trigger = page.getByTestId("main-menu-trigger");
    // The dropdown has no menu role; the app's test id scopes the items away
    // from same-named welcome screen buttons ("Open", "Help").
    this.content = page.getByTestId("dropdown-menu");
  }

  item(name: string) {
    return this.content.getByRole("button", { name, exact: true });
  }

  get isOpen() {
    return this.item("Reset the canvas").isVisible();
  }

  async open() {
    // After loading a file through "Open" the menu reopens by itself
    // (BUG-002); clicking the trigger then would close it again.
    if (!(await this.isOpen)) await this.trigger.click();
    await expect(this.item("Reset the canvas")).toBeVisible();
  }

  async choose(name: string) {
    await this.open();
    await this.item(name).click();
  }

  async openSaveDialog() {
    await this.choose("Save to...");
    const dialog = this.page.getByRole("dialog").filter({
      has: this.page.getByRole("heading", { name: "Save to..." }),
    });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  async openExportImageDialog() {
    await this.choose("Export image...");
    const dialog = this.page.getByRole("dialog").filter({
      has: this.page.getByRole("heading", { name: "Export image" }),
    });
    await expect(dialog).toBeVisible();
    return dialog;
  }
}
