import { build } from "bun";
import { mkdir, cp } from "fs/promises";

console.log("🔨 Building for Cloudflare Workers...");

// Create dist directory
await mkdir("./dist", { recursive: true });

// Build the main TypeScript file
console.log("📦 Building TypeScript files...");
await build({
  entrypoints: ["./src/main.ts", "./src/worker.ts"],
  outdir: "./dist",
  target: "browser",
  format: "esm",
  minify: true,
  sourcemap: "external",
});

console.log("📁 Copying static assets...");

// Copy HTML file
await cp("./public/index.html", "./dist/index.html");

// Copy WebAssembly files
const wasmFiles = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd.wasm",
  "ort-wasm-threaded.wasm",
  "ort-wasm.wasm"
];

for (const file of wasmFiles) {
  await cp(`./public/${file}`, `./dist/${file}`);
}

// Copy ONNX model
await cp("./public/kitten_tts_nano_v0_1.onnx", "./dist/kitten_tts_nano_v0_1.onnx");

// Copy voice data
await cp("./public/voices.npz", "./dist/voices.npz");

// Copy ONNX runtime
await cp("./public/ort.min.js", "./dist/ort.min.js");

// Create _headers file for Cloudflare Pages
const headersContent = `/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type

/*.wasm
  Content-Type: application/wasm

/*.onnx
  Content-Type: application/octet-stream

/*.npz
  Content-Type: application/octet-stream

/*.js
  Content-Type: application/javascript; charset=utf-8

/*.html
  Content-Type: text/html; charset=utf-8
`;

await Bun.write("./dist/_headers", headersContent);

console.log("✅ Build complete! Files compiled to ./dist/");
console.log("🚀 Ready for Cloudflare Pages deployment!");
console.log("");
console.log("To deploy:");
console.log("1. Install Wrangler: bun add -g wrangler");
console.log("2. Login: wrangler login");
console.log("3. Deploy: bun run deploy");
