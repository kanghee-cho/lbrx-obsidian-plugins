// esbuild.config.mjs
import path from "path";
import { fileURLToPath } from "url";
import { buildPlugin } from "../../esbuild.base.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await buildPlugin({
  entryPoint: path.join(__dirname, "src/main.ts"),
  outfile: path.join(__dirname, "main.js"),
});
