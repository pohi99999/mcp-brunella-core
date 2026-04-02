import { existsSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

if (!process.env.WEB_UI_ENABLED) {
  process.env.WEB_UI_ENABLED = "true";
}

if (!process.env.BRUNELLA_WORKSPACE_ROOT) {
  process.env.BRUNELLA_WORKSPACE_ROOT = process.cwd();
}

const entryPoint = path.resolve(process.cwd(), "build", "index.js");

if (!existsSync(entryPoint)) {
  process.stderr.write(
    `[brunella:start-stable] Missing build artifact: ${entryPoint}. Run "npm run build:stable" first.\n`,
  );
  process.exit(1);
}

await import(pathToFileURL(entryPoint).href);
