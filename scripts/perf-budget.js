const fs = require("fs");
const path = require("path");
const { parse } = require("node-html-parser");

const buildDir = path.resolve(process.cwd(), "build");
const BUNDLE_BUDGETS = [
  { label: "Core JS bundle", file: path.join(buildDir, "scripts", "scripts.js"), budget: 300 * 1024 },
  { label: "Modern JS bundle", file: path.join(buildDir, "scripts", "scripts.modern.js"), budget: 320 * 1024 },
  { label: "Core CSS bundle", file: path.join(buildDir, "css", "styles.css"), budget: 250 * 1024 }
];

const PAGE_BUDGETS = [
  { label: "Home page", file: path.join(buildDir, "index.html"), budget: 15 },
  { label: "Search page", file: path.join(buildDir, "search", "index.html"), budget: 18 },
  { label: "Topic page", file: path.join(buildDir, "frontend", "rendering-strategies", "index.html"), budget: 18 },
  { label: "Architecture page", file: path.join(buildDir, "system-architecture", "system-design-optimisation", "index.html"), budget: 18 }
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  return `${kilobytes.toFixed(kilobytes >= 10 ? 0 : 1)} KB`;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && fullPath.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectByExtension(dir, extension, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectByExtension(fullPath, extension, files);
    } else if (entry.isFile() && fullPath.endsWith(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

function checkFileBudget({ label, file, budget }) {
  if (!fs.existsSync(file)) {
    console.log(`[perf][warning] ${label} not found at ${path.relative(process.cwd(), file)}.`);
    return;
  }

  const size = fs.statSync(file).size;
  console.log(`[perf] ${label}: ${formatBytes(size)} (budget ${formatBytes(budget)})`);

  if (size > budget) {
    console.log(`[perf][warning] ${label} exceeds budget by ${formatBytes(size - budget)}.`);
  }
}

function checkRequestBudget({ label, file, budget }) {
  if (!fs.existsSync(file)) {
    console.log(`[perf][warning] ${label} not found at ${path.relative(process.cwd(), file)}.`);
    return;
  }

  const html = fs.readFileSync(file, "utf8");
  const requests = collectRequests(html);
  console.log(`[perf] ${label} requests: ${requests.size} (budget ${budget})`);

  if (requests.size > budget) {
    console.log(`[perf][warning] ${label} request count exceeds budget by ${requests.size - budget}.`);
  }
}

function collectRequests(html) {
  const root = parse(html);
  const requests = new Set();

  root.querySelectorAll("script[src]").forEach((node) => requests.add(node.getAttribute("src")));
  root.querySelectorAll("link[href]").forEach((node) => {
    const rel = (node.getAttribute("rel") || "").toLowerCase();
    if (["stylesheet", "preload", "icon", "apple-touch-icon", "manifest"].includes(rel)) {
      requests.add(node.getAttribute("href"));
    }
  });
  root.querySelectorAll("img[src]").forEach((node) => requests.add(node.getAttribute("src")));
  root.querySelectorAll("source[srcset]").forEach((node) => requests.add(node.getAttribute("srcset")));
  root.querySelectorAll("video[poster]").forEach((node) => requests.add(node.getAttribute("poster")));

  return requests;
}

function main() {
  if (!fs.existsSync(buildDir)) {
    console.log(`[perf] build directory not found at ${buildDir}; run a build first.`);
    process.exit(0);
  }

  const jsFiles = collectByExtension(buildDir, ".js");
  const cssFiles = collectByExtension(buildDir, ".css");

  const totalJsBytes = jsFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  const totalCssBytes = cssFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);

  console.log(`[perf] Total JS footprint: ${formatBytes(totalJsBytes)}`);
  console.log(`[perf] Total CSS footprint: ${formatBytes(totalCssBytes)}`);

  BUNDLE_BUDGETS.forEach(checkFileBudget);
  PAGE_BUDGETS.forEach(checkRequestBudget);

  process.exit(0);
}

main();