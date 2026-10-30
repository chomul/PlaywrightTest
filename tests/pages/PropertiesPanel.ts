import { expect, type Locator, type Page } from "@playwright/test";

export type StrokeWidth = "thin" | "bold" | "extraBold";

/** "Selected shape actions" panel shown while an element is selected. */
export class PropertiesPanel {
  readonly root: Locator;
  readonly opacity: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("region", { name: "Selected shape actions" });
    this.opacity = this.root.getByRole("slider", { name: /Opacity/ });
  }

  /** The <section> itself has no box; its "Actions" group is the visible part. */
  get actions() {
    return this.root.getByRole("group", { name: "Actions" });
  }

  async expectVisible() {
    await expect(this.actions).toBeVisible();
  }

  async expectHidden() {
    await expect(this.actions).toBeHidden();
  }

  /** Quick-pick swatches are buttons named by their hex value. */
  async pickStrokeColor(hex: string) {
    await this.root.getByRole("button", { name: hex, exact: true }).first().click();
  }

  strokeWidthRadio(width: StrokeWidth) {
    // These radios have no accessible name (BUG-001), only a test id.
    return this.root.getByTestId(`strokeWidth-${width}`);
  }

  async setStrokeWidth(width: StrokeWidth) {
    // Same layout as the toolbar: the label (title) receives the click.
    const radio = this.strokeWidthRadio(width);
    await this.root
      .getByRole("group", { name: "Stroke width" })
      .getByTitle({ thin: "Thin", bold: "Bold", extraBold: "Extra bold" }[width], {
        exact: true,
      })
      .click();
    await expect(radio).toBeChecked();
  }

  async openStrokeColorPicker() {
    await this.root.getByRole("button", { name: "Stroke", exact: true }).click();
    const picker = this.page.getByRole("dialog").filter({
      has: this.page.getByRole("textbox"),
    });
    await expect(picker.last()).toBeVisible();
    return picker.last();
  }

  async delete() {
    await this.root.getByRole("button", { name: "Delete" }).click();
  }
}
