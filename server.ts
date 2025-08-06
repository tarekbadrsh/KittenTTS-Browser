#!/usr/bin/env bun

import { serve } from "bun";
import { APP_CONFIG } from "./src/config/constants";

const server = serve({
    port: APP_CONFIG.SERVER.PORT,
    async fetch(req) {
        const url = new URL(req.url);
        let filePath = url.pathname;

        // Serve index.html for root path
        if (filePath === "/") {
            filePath = "/index.html";
        }

        // Handle different file locations
        let fsPath;
        if (filePath.startsWith('/src/')) {
            // Serve files from src directory (development)
            fsPath = filePath.slice(1); // Remove leading slash
        } else if (filePath === '/main.js') {
            // Handle the built main.js file - try dist first, then build on-the-fly
            const distFile = Bun.file('./dist/main.js');
            if (await distFile.exists()) {
                fsPath = './dist/main.js';
            } else {
                // Build on-the-fly for development
                fsPath = './src/main.ts';
            }
        } else {
            // Serve files from public directory
            fsPath = `public${filePath}`;
        }

        try {
            // Handle TypeScript files and main.js
            if (fsPath.endsWith('.ts') || (filePath === '/main.js' && fsPath.endsWith('.ts'))) {
                const file = Bun.file(fsPath);
                if (!await file.exists()) {
                    return new Response("File not found", { status: 404 });
                }

                // Use Bun's built-in TypeScript compiler with bundling
                const result = await Bun.build({
                    entrypoints: [fsPath],
                    target: 'browser',
                    format: 'esm',
                    minify: false,
                    sourcemap: 'none',
                    outdir: './dist', // Temporary output directory
                });

                if (!result.success) {
                    console.error('Build failed:', result.logs);
                    return new Response("TypeScript compilation failed", { status: 500 });
                }

                const output = await result.outputs[0].text();

                const headers = new Headers();
                headers.set("Content-Type", "application/javascript");
                headers.set("Cross-Origin-Embedder-Policy", "require-corp");
                headers.set("Cross-Origin-Opener-Policy", "same-origin");
                headers.set("Access-Control-Allow-Origin", "*");
                headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                headers.set("Access-Control-Allow-Headers", "Content-Type");

                return new Response(output, { headers });
            }

            const file = Bun.file(fsPath);

            // Check if file exists before trying to serve it
            if (!await file.exists()) {
                // Handle source map requests gracefully
                if (fsPath.endsWith('.map')) {
                    return new Response("// Source map not available", {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    });
                }
                return new Response("File not found", { status: 404 });
            }

            // Set CORS headers for WebAssembly support
            const headers = new Headers();
            Object.entries(APP_CONFIG.SERVER.CORS_HEADERS).forEach(([key, value]) => {
                headers.set(key, value);
            });

            // Set appropriate content type based on file extension
            if (fsPath.endsWith('.html')) {
                headers.set("Content-Type", "text/html");
            } else if (fsPath.endsWith('.js')) {
                headers.set("Content-Type", "application/javascript");
            } else if (fsPath.endsWith('.wasm')) {
                headers.set("Content-Type", "application/wasm");
            } else if (fsPath.endsWith('.onnx')) {
                headers.set("Content-Type", "application/octet-stream");
            } else if (fsPath.endsWith('.npz')) {
                headers.set("Content-Type", "application/octet-stream");
            } else if (fsPath.endsWith('.map')) {
                headers.set("Content-Type", "application/json");
            }

            return new Response(file, { headers });
        } catch (error) {
            console.error('Server error:', error);
            return new Response("File not found", { status: 404 });
        }
    },
});

console.log(`Serving at http://localhost:${server.port}`);
console.log("Press Ctrl+C to stop");
