import * as esbuild from "esbuild";
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

const outdir = resolve(__dirname, "dist");
if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

/** Common esbuild options */
const sharedOptions = {
  bundle: true,
  target: "chrome110",
  format: "iife",
  minify: !isWatch,
  sourcemap: isWatch ? "inline" : false,
  logLevel: "info",
};

/** Copy static files to dist */
function copyStaticFiles() {
  const staticFiles = [
    ["manifest.json", "manifest.json"],
    ["src/popup/popup.html", "popup.html"],
    ["src/content/sidebar.css", "sidebar.css"],
  ];

  for (const [src, dest] of staticFiles) {
    const srcPath = resolve(__dirname, src);
    const destPath = resolve(outdir, dest);
    if (existsSync(srcPath)) {
      cpSync(srcPath, destPath);
      console.log(`Copied: ${src} → dist/${dest}`);
    }
  }

  // Copy templates folder
  const templatesDir = resolve(__dirname, "templates");
  const templatesOut = resolve(outdir, "templates");
  if (existsSync(templatesDir)) {
    cpSync(templatesDir, templatesOut, { recursive: true });
    console.log("Copied: templates/ → dist/templates/");
  }

  // Copy icons folder
  const iconsDir = resolve(__dirname, "icons");
  const iconsOut = resolve(outdir, "icons");
  if (existsSync(iconsDir)) {
    cpSync(iconsDir, iconsOut, { recursive: true });
    console.log("Copied: icons/ → dist/icons/");
  }

  // Generate defaults.json from template files
  generateDefaultsManifest(outdir);
}

function generateDefaultsManifest(outdir) {
  const defaults = {
    tabGroups: [
      { id: "story", name: "故事生成", icon: "📖", file: "story.json", order: 0 },
      { id: "storyboard", name: "分鏡腳本", icon: "🎬", file: "storyboard.json", order: 1 },
      { id: "image-gen", name: "圖像生成", icon: "🖼️", file: "image-gen.json", order: 2 },
      { id: "image-prompt", name: "圖片Prompt", icon: "🎨", file: "image-prompt.json", order: 3 },
      { id: "video-prompt", name: "影片Prompt", icon: "🎥", file: "video-prompt.json", order: 4 },
    ],
    files: ["story.json", "storyboard.json", "image-gen.json", "image-prompt.json", "video-prompt.json"],
  };
  writeFileSync(resolve(outdir, "defaults.json"), JSON.stringify(defaults, null, 2), "utf-8");
  console.log("Generated: dist/defaults.json");
}

const builds = [
  // Content script
  {
    ...sharedOptions,
    entryPoints: ["src/content/sidebar.ts"],
    outfile: resolve(outdir, "content.js"),
    globalName: "AivContent",
  },
  // Background service worker
  {
    ...sharedOptions,
    entryPoints: ["src/background/service-worker.ts"],
    outfile: resolve(outdir, "service-worker.js"),
    format: "esm",
    globalName: undefined,
  },
  // Popup
  {
    ...sharedOptions,
    entryPoints: ["src/popup/popup.ts"],
    outfile: resolve(outdir, "popup.js"),
    globalName: "AivPopup",
  },
];

if (isWatch) {
  console.log("🔥 Watch mode active…");
  const ctxs = await Promise.all(builds.map((b) => esbuild.context(b)));
  await Promise.all(ctxs.map((ctx) => ctx.watch()));
  copyStaticFiles();
  // Re-copy on changes (simplified)
  console.log("Watching… Press Ctrl+C to stop.");
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  copyStaticFiles();
  console.log("✅ Build complete → dist/");
}
