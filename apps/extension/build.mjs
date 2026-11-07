import * as esbuild from "esbuild";
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outdir = join(__dirname, "dist");
const watch = process.argv.includes("--watch");

mkdirSync(outdir, { recursive: true });

const entryPoints = {
  background: join(__dirname, "src/background.ts"),
  content: join(__dirname, "src/content.ts"),
  popup: join(__dirname, "src/popup.ts"),
};

async function copyStatic() {
  for (const file of ["manifest.json", "popup.html", "popup.css", "content.css"]) {
    cpSync(join(__dirname, file), join(outdir, file));
  }
  const iconsSrc = join(__dirname, "icons");
  if (existsSync(iconsSrc)) {
    cpSync(iconsSrc, join(outdir, "icons"), { recursive: true });
  }
}

const ctx = await esbuild.context({
  entryPoints,
  bundle: true,
  outdir,
  format: "esm",
  target: ["chrome120"],
  sourcemap: true,
  logLevel: "info",
});

await ctx.rebuild();
await copyStatic();

if (watch) {
  await ctx.watch();
  console.log("Watching extension…");
} else {
  await ctx.dispose();
  console.log("Extension built to apps/extension/dist");
}
