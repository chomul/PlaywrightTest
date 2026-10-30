import fs from "node:fs";
import path from "node:path";
import type { BrowserContext, Route } from "@playwright/test";

const APP_DIR = path.resolve(__dirname, "../../app");
const FONT_DIRS = [
  path.join(APP_DIR, "excalidraw-app/build/fonts"),
  // A few UI weights (Assistant Bold/Medium) are not copied into the build.
  path.join(APP_DIR, "packages/excalidraw/fonts"),
];
const FONT_CDN_HOST = "excalidraw.nyc3.cdn.digitaloceanspaces.com";

export const SHARE_API = {
  post: "https://json.excalidraw.com/api/v2/post/",
  get: "https://json.excalidraw.com/api/v2/",
};

/** Requests that left localhost and were answered by the guard. */
export type ExternalRequest = { url: string; handledBy: "font" | "blocked" };

/**
 * Font CDN requests are served from the same woff2 files that ship in the
 * build, so text renders the same way as in production without network.
 */
function localFontPath(url: URL): string | null {
  const match = url.pathname.match(/^\/oss\/fonts\/([^/]+)\/([^/]+\.woff2)$/);
  if (!match) return null;
  const [, family, file] = match;
  for (const candidate of FONT_DIRS.map((dir) => path.join(dir, family, file))) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Registered on every context: nothing may reach the internet. Tests that
 * need a specific backend response add their own page.route on top, which
 * takes precedence over these context routes.
 */
export async function guardExternalNetwork(
  context: BrowserContext,
  log: ExternalRequest[],
) {
  await context.route(
    (url) => url.hostname !== "localhost" && url.protocol.startsWith("http"),
    async (route: Route) => {
      const url = new URL(route.request().url());
      if (url.hostname === FONT_CDN_HOST) {
        const file = localFontPath(url);
        if (file) {
          log.push({ url: url.href, handledBy: "font" });
          return route.fulfill({
            path: file,
            contentType: "font/woff2",
            headers: { "access-control-allow-origin": "*" },
          });
        }
      }
      log.push({ url: url.href, handledBy: "blocked" });
      return route.abort("blockedbyclient");
    },
  );
}
