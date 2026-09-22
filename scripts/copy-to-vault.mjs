#!/usr/bin/env node
// scripts/copy-to-vault.mjs
// Copies a built plugin (manifest.json, main.js, styles.css) into a local
// Obsidian vault's .obsidian/plugins/<id>/ folder for manual testing.
//
// Usage: node scripts/copy-to-vault.mjs <plugin-folder> <path-to-vault>
// Example: node scripts/copy-to-vault.mjs sample-plugin ~/ObsidianVaults/test-vault

import fs from "fs";
import path from "path";

const [, , pluginFolder, vaultPath] = process.argv;

if (!pluginFolder || !vaultPath) {
  console.error("Usage: node scripts/copy-to-vault.mjs <plugin-folder> <path-to-vault>");
  process.exit(1);
}

const pluginDir = path.resolve("plugins", pluginFolder);
const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, "manifest.json"), "utf-8"));

const destDir = path.join(path.resolve(vaultPath.replace(/^~/, process.env.HOME ?? "~")), ".obsidian", "plugins", manifest.id);

fs.mkdirSync(destDir, { recursive: true });

for (const file of ["manifest.json", "main.js", "styles.css"]) {
  const src = path.join(pluginDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(destDir, file));
  }
}

console.log(`Copied ${manifest.id} -> ${destDir}`);
