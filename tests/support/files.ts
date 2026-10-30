import path from "node:path";
import { expect } from "@playwright/test";
import type { EditorPage } from "../pages/EditorPage";

export const dataFile = (name: string) =>
  path.resolve(__dirname, "../data", name);

/** Main menu → Save to... → Save to file, returns the saved file path. */
export async function saveSceneToFile(editor: EditorPage, target: string) {
  const dialog = await editor.menu.openSaveDialog();
  const download = editor.page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save to file" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.excalidraw$/);
  await file.saveAs(target);
  return target;
}

/**
 * Main menu → Open, then answer the file chooser. If the canvas is not
 * empty the app first asks for confirmation; that dialog is accepted.
 */
export async function openSceneFile(editor: EditorPage, file: string) {
  const { page } = editor;
  const chooser = page.waitForEvent("filechooser");
  await editor.menu.choose("Open");

  const confirm = page.getByRole("dialog").getByRole("button", { name: "Load" });
  const picked = await Promise.race([
    chooser.then((c) => ({ chooser: c })),
    confirm.waitFor().then(() => null),
  ]);
  const fileChooser = picked?.chooser ?? (await (async () => {
    await confirm.click();
    return chooser;
  })());
  await fileChooser.setFiles(file);
}
