import { build } from "bun";

console.log("🔨 Building TypeScript files...");

// Build the main TypeScript file
await build({
    entrypoints: ["./src/main.ts"],
    outdir: "./public",
    target: "browser",
    format: "esm",
    minify: false,
    sourcemap: "external",
});

console.log("✅ Build complete! Files compiled to ./public/");
