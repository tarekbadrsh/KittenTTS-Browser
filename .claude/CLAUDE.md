# KittenTTS-Browser

Multi-model TTS application running entirely in the browser using WebAssembly/WebGPU.

## Build Commands

```bash
bun install        # Install dependencies
bun run dev        # Start development server (auto-compiles TS)
bun run build:cf   # Production build for Cloudflare Pages
bun run deploy     # Build and deploy to Cloudflare
```

## Architecture

### Multi-Model Strategy Pattern

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

### Model Comparison

| Model | Size | Sample Rate | Worker | Phonemization |
|-------|------|-------------|--------|---------------|
| KittenTTS Nano | 24MB | 24kHz | kittenWorker | eSpeak-ng |
| Kokoro-82M | 92MB (q8) | 24kHz | kokoroWorker | eSpeak-ng |
| Supertonic | ~263MB | 44.1kHz | Main thread | Built-in |

### Key Files

```
src/
├── adapters/
│   ├── index.ts           # Factory: createAdapter(modelType)
│   ├── baseAdapter.ts     # Abstract base class
│   ├── kittenAdapter.ts   # KittenTTS implementation
│   ├── kokoroAdapter.ts   # Kokoro-82M implementation
│   └── supertonicAdapter.ts # Supertonic (uses @hf/transformers)
├── workers/
│   ├── kittenWorker.ts    # ONNX worker for KittenTTS
│   └── kokoroWorker.ts    # ONNX worker for Kokoro
├── voiceLoaders/
│   └── binLoader.ts       # Loads .bin voice files from CDN
├── config/
│   ├── constants.ts       # App configuration
│   └── models.ts          # MODEL_CONFIGS, voice definitions
├── main.ts                # Application entry point
├── textProcessor.ts       # eSpeak-ng phonemizer
├── voiceLoader.ts         # NPZ voice loader (KittenTTS)
└── types.ts               # TypeScript interfaces
```

## Design Decisions

### Adapter Pattern
Each TTS model is wrapped in an adapter implementing `TTSModelAdapter`:
- `initialize(onProgress?)` - Load model with progress callback
- `synthesize(input)` - Run TTS inference
- `getVoices()` - Return available voices
- `dispose()` - Clean up resources

### Voice Handling
- **KittenTTS**: Voices in .npz format, single embedding per voice
- **Kokoro**: Voices in .bin format, style vectors indexed by token count
- **Supertonic**: Voices from HuggingFace CDN URLs

### Worker Strategy
- KittenTTS/Kokoro: Dedicated Web Workers for non-blocking inference
- Supertonic: Main thread (transformers.js handles internally)

## CDN Sources

| Model | Source |
|-------|--------|
| KittenTTS | Self-hosted (public/) |
| Kokoro | `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/` |
| Supertonic | `https://huggingface.co/onnx-community/Supertonic-TTS-ONNX/` |

## Adding a New Model

1. Create adapter in `src/adapters/newModelAdapter.ts`
2. Add config to `src/config/models.ts`
3. Add case to factory in `src/adapters/index.ts`
4. If using ONNX: create worker in `src/workers/`
5. Update `build-cf.ts` to include new worker

## Dependencies

- `@huggingface/transformers` - Pipeline API for Supertonic
- `espeak-ng` - Phonemization for KittenTTS/Kokoro
- `jszip` - NPZ file parsing
- ONNX Runtime Web (via CDN) - WebAssembly inference
