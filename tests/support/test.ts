import { test as base, expect } from "@playwright/test";
import { EditorPage } from "../pages/EditorPage";
import { guardExternalNetwork, type ExternalRequest } from "./network";

type Fixtures = {
  externalRequests: ExternalRequest[];
  editor: EditorPage;
};

export const test = base.extend<Fixtures>({
  externalRequests: async ({}, use) => {
    await use([]);
  },

  context: async ({ context, externalRequests }, use, testInfo) => {
    await guardExternalNetwork(context, externalRequests);
    // Chromium has the File System Access API, which opens native OS
    // dialogs Playwright cannot drive. Removing it makes Excalidraw use its
    // own fallback (<a download> / <input type=file>), the same path
    // Firefox and WebKit always take.
    await context.addInitScript(() => {
      const w = window as any;
      delete w.showSaveFilePicker;
      delete w.showOpenFilePicker;
    });
    await use(context);
    const blocked = externalRequests.filter((r) => r.handledBy === "blocked");
    if (blocked.length) {
      await testInfo.attach("blocked-external-requests", {
        body: blocked.map((r) => r.url).join("\n"),
        contentType: "text/plain",
      });
    }
  },

  editor: async ({ page }, use) => {
    const editor = new EditorPage(page);
    await editor.goto();
    await use(editor);
  },
});

export { expect };
