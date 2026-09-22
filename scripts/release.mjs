#!/usr/bin/env node
// scripts/release.mjs
// Bumps the version for one plugin: updates plugins/<id>/manifest.json,
// package.json, and appends an entry to versions.json.
//
// Usage: node scripts/release.mjs <plugin-folder> <new-version>
// Example: node scripts/release.mjs sample-plugin 0.2.0

import fs from "fs";
import path from "path";

const [, , pluginFolder, newVersion] = process.argv;

if (!pluginFolder || !newVersion) {
  console.error("Usage: node scripts/release.mjs <plugin-folder> <new-version>");
  process.exit(1);
}

const pluginDir = path.resolve("plugins", pluginFolder);
const manifestPath = path.join(pluginDir, "manifest.json");
const packageJsonPath = path.join(pluginDir, "package.json");
const versionsPath = path.join(pluginDir, "versions.json");

if (!fs.existsSync(manifestPath)) {
  console.error(`No manifest.json found at ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const versions = JSON.parse(fs.readFileSync(versionsPath, "utf-8"));

manifest.version = newVersion;
pkg.version = newVersion;
versions[newVersion] = manifest.minAppVersion;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + "\n");

console.log(`Bumped ${pluginFolder} to v${newVersion}`);
