# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
bun install        # Install dependencies
bun run dev        # Start development server (auto-compiles TS)
bun run build:cf   # Production build for Cloudflare Pages
bun run deploy     # Build and deploy to Cloudflare
bun test           # Run tests
```

## Architecture

Multi-model TTS application running entirely in the browser using WebAssembly/WebGPU.

### Adapter Pattern (Strategy)

```
TTSApplication (main.ts)
       │
       ▼
AdapterFactory (src/adapters/index.ts)
       │
       ├──► KittenAdapter  → kittenWorker.ts  → ONNX Runtime
       ├──► KokoroAdapter  → kokoroWorker.ts  → ONNX Runtime
       └──► SupertonicAdapter → @huggingface/transformers pipeline
```

Each TTS model is wrapped in an adapter implementing `TTSModelAdapter` (defined in `src/types.ts`):
- `initialize(onProgress?)` - Load model with progress callback
- `synthesize(input)` - Run TTS inference
- `getVoices()` - Return available voices
- `dispose()` - Clean up resources

### Worker Strategy

- **KittenTTS/Kokoro**: Dedicated Web Workers (`src/workers/`) for non-blocking ONNX inference
- **Supertonic**: Main thread (transformers.js manages threading internally)

### Voice Handling

| Model | Format | Source |
|-------|--------|--------|
| KittenTTS | .npz (single embedding) | Self-hosted (`public/`) |
| Kokoro | .bin (style vectors by token count) | HuggingFace CDN |
| Supertonic | JSON URLs | HuggingFace CDN |

Voice definitions and model configs are in `src/config/models.ts`.

## Adding a New Model

1. Create adapter in `src/adapters/newModelAdapter.ts` extending `BaseAdapter`
2. Add `ModelType` union member and config to `src/config/models.ts`
3. Add case to factory switch in `src/adapters/index.ts`
4. If using ONNX: create worker in `src/workers/`
5. Update `build-cf.ts` to bundle the new worker

## Key Dependencies

- `@huggingface/transformers` - Pipeline API for Supertonic
- `espeak-ng` - Phonemization for KittenTTS/Kokoro
- `jszip` - NPZ file parsing
- ONNX Runtime Web (loaded via CDN) - WebAssembly inference
