# Kitten TTS Nano - Browser Edition

A high-quality text-to-speech model running entirely in your browser using WebAssembly and ONNX Runtime. Built with TypeScript and Bun for modern development experience.

![Kitten TTS Demo](https://img.shields.io/badge/Status-Ready-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![Bun](https://img.shields.io/badge/Runtime-Bun-orange)
![License](https://img.shields.io/badge/License-Apache%202.0-blue)

## ✨ Features

- **🔒 Privacy-First**: All processing happens locally in your browser
- **🎯 High Quality**: Uses Kitten TTS Nano v0.1 model for natural speech
- **🎭 Multiple Voices**: Choose from different voice styles and personalities
- **⚡ Speed Control**: Adjust speech synthesis speed (0.5x to 3.0x)
- **🚀 No GPU Required**: Runs entirely on CPU using WebAssembly
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **🔧 TypeScript**: Full type safety and modern development experience

## 🏗️ Architecture

```
KittenTTS-Browser/
├── public/                    # Static assets served by web server
│   ├── index.html            # Main HTML interface
│   ├── ort.min.js            # ONNX Runtime Web library
│   ├── voices.npz            # Voice embeddings (NPZ format)
│   ├── kitten_tts_nano_v0_1.onnx  # TTS model (24MB)
│   └── ort-wasm*.wasm        # ONNX Runtime WASM files
├── src/                      # TypeScript source code
│   ├── config/
│   │   └── constants.ts      # Application configuration
│   ├── types/
│   │   └── espeak-ng.d.ts   # Type definitions for espeak-ng
│   ├── types.ts              # Core type definitions
│   ├── main.ts               # Application orchestrator
│   ├── textProcessor.ts      # Text processing and phonemization
│   ├── voiceLoader.ts        # Voice loading and NPZ parsing
│   ├── audioProcessor.ts     # Audio processing and WAV encoding
│   ├── workerManager.ts      # Web Worker communication
│   └── worker.ts             # ONNX model inference worker
├── server.ts                 # Bun development server
├── build.ts                  # TypeScript build script
├── package.json              # Project dependencies and scripts
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or higher)
- Modern browser with WebAssembly support

### Local Development

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd KittenTTS-Browser
   ```

2. **Install dependencies**:

   ```bash
   bun install
   ```

3. **Start the development server**:

   ```bash
   bun run dev
   ```

4. **Open your browser** and navigate to:

   ```
   http://localhost:8000
   ```

5. **Wait for initialization** (model loading takes ~30 seconds for the first time)

### Cloudflare Pages Deployment

The application is configured for easy deployment to Cloudflare Pages, providing global CDN distribution for static site hosting.

#### Prerequisites for Cloudflare Pages

1. **Install Wrangler CLI**:

   ```bash
   bun add -g wrangler
   ```

2. **Login to Cloudflare**:

   ```bash
   wrangler login
   ```

#### Deployment Steps

1. **Build and deploy in one command**:

   ```bash
   bun run deploy
   ```

2. **Or build separately**:

   ```bash
   bun run build:cf
   wrangler pages deploy dist
   ```

#### Configuration

The deployment is configured via `wrangler.toml`:

```toml
name = "kitten-tts-browser"
compatibility_date = "2024-01-01"

[pages]
name = "kitten-tts-browser"
bucket = "./dist"
```

#### CORS and Headers Configuration

The `_headers` file in the dist directory configures proper headers for WebAssembly support:

```
/*
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
```

#### Build Output

The build process creates a `dist/` directory containing:

```
dist/
├── index.html              # Main HTML file
├── main.js                 # Compiled main application (232KB)
├── worker.js               # Compiled Web Worker (2.2KB)
├── main.js.map            # Source maps for debugging
├── worker.js.map          # Worker source maps
├── ort.min.js             # ONNX Runtime library (528KB)
├── kitten_tts_nano_v0_1.onnx  # TTS model (23MB)
├── voices.npz             # Voice embeddings (10KB)
├── ort-wasm*.wasm         # WebAssembly files (~40MB total)
└── _headers               # Cloudflare Pages headers configuration
```

#### Benefits of Cloudflare Pages Deployment

- **Global CDN**: Content served from 200+ edge locations worldwide
- **Automatic Scaling**: Handles traffic spikes automatically
- **Security**: Built-in DDoS protection and SSL/TLS
- **Performance**: Sub-100ms response times globally
- **Cost-Effective**: Free tier available for personal projects
- **Git Integration**: Automatic deployments from Git repositories
- **WebAssembly Support**: Proper headers for WASM execution

## 🎯 Usage

1. **Enter text** in the text area
2. **Select a voice** from the dropdown menu
3. **Adjust speed** using the slider (0.5x to 3.0x)
4. **Click "Generate Speech"** to synthesize audio
5. **Play the generated audio** using the audio controls

## 🛠️ Development

### Available Scripts

```bash
# Development with auto-reload
bun run dev

# Production server
bun run start

# Build TypeScript files
bun run build

# Build for Cloudflare Workers
bun run build:cf

# Deploy to Cloudflare Workers
bun run deploy

# Deploy to staging environment
bun run deploy:staging

# Deploy to production environment
bun run deploy:prod

# Run tests
bun test
```

### Project Structure

#### Core Modules

- **`main.ts`**: Application orchestrator that coordinates all modules
- **`textProcessor.ts`**: Handles text cleaning, tokenization, and phonemization using ESpeak-NG
- **`voiceLoader.ts`**: Manages voice loading and NPZ file parsing
- **`audioProcessor.ts`**: Audio normalization and WAV encoding
- **`workerManager.ts`**: Web Worker communication and message handling
- **`worker.ts`**: ONNX model inference in a separate thread

#### Configuration

- **`constants.ts`**: Centralized application configuration
- **`types.ts`**: Comprehensive type definitions for type safety

### Technical Stack

- **Runtime**: Bun (JavaScript runtime)
- **Language**: TypeScript 5.9.2
- **Model Runtime**: ONNX Runtime Web
- **Text Processing**: ESpeak-NG for phonemization
- **Audio Format**: 24kHz WAV output
- **Architecture**: Web Workers for non-blocking inference

## 🔧 Technical Details

### Model Specifications

- **Model**: Kitten TTS Nano v0.1 (ONNX format)
- **Size**: ~24MB (compressed)
- **Sample Rate**: 24kHz
- **Backends**: WebGL + WASM, WebNN + WebGL + WASM, WASM-only
- **Input**: Phonemized text tokens + voice embeddings
- **Output**: Raw audio samples

### Performance Characteristics

- **Initial Load**: ~30 seconds (model download and initialization)
- **Inference Time**: ~1-3 seconds per sentence
- **Memory Usage**: ~50-100MB during inference
- **Browser Support**: Chrome/Chromium (recommended), Firefox, Safari, Edge

### Audio Processing Pipeline

1. **Text Input** → Text cleaning and validation
2. **Phonemization** → ESpeak-NG converts text to phonemes
3. **Tokenization** → Convert phonemes to model tokens
4. **Model Inference** → ONNX Runtime generates audio samples
5. **Audio Processing** → Normalization and trimming
6. **WAV Encoding** → Convert to browser-playable format

## 🌐 Browser Compatibility

### Required Features

- **WebAssembly** support
- **Web Workers** support
- **ES6 Modules** support
- **Fetch API** support
- **AudioContext** support

### Tested Browsers

| Browser | Version | Status |
|---------|---------|--------|
| Chrome/Chromium | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |

## 🐛 Troubleshooting

### Common Issues

**Model fails to load**

- Check browser console for CORS errors
- Ensure all WASM files are accessible
- Try refreshing the page

**Audio not playing**

- Check browser autoplay settings
- Ensure audio permissions are granted
- Try clicking the audio controls manually

**Slow performance**

- Use Chrome/Chromium for best performance
- Close other browser tabs
- Check available system memory

**CORS errors**

- The server includes proper CORS headers
- Ensure you're accessing via `http://localhost:8000`
- Check firewall/antivirus settings

### Debug Mode

Enable detailed logging by opening browser console and running:

```javascript
localStorage.setItem('debug', 'true');
```

## 📝 API Reference

### Core Classes

#### `TTSApplication`

Main application orchestrator.

```typescript
class TTSApplication {
  constructor()
  private async initialize(): Promise<void>
  private setupEventListeners(): void
  private async handleGenerateClick(): Promise<void>
}
```

#### `TextProcessor`

Handles text processing and phonemization.

```typescript
class TextProcessor {
  async initialize(): Promise<void>
  async tokenize(text: string): Promise<number[]>
  async phonemize(text: string): Promise<string>
}
```

#### `VoiceLoader`

Manages voice loading and NPZ file parsing.

```typescript
class VoiceLoader {
  async loadVoices(): Promise<VoiceData>
  populateVoiceSelector(select: HTMLSelectElement): void
}
```

#### `WorkerManager`

Handles Web Worker communication.

```typescript
class WorkerManager {
  async initialize(): Promise<void>
  runInference(input: ModelInput): void
  private handleWorkerMessage(e: MessageEvent): void
}
```

### Type Definitions

```typescript
interface ModelInput {
  inputIds: BigInt64Array;
  voiceEmbedding: Float32Array;
  speed: number;
}

interface VoiceData {
  [voiceName: string]: Float32Array;
}

interface AudioResult {
  audioData: Float32Array;
  time: number;
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add proper error handling
- Include type definitions for new features
- Test across different browsers
- Update documentation for new features

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Kitten TTS](https://github.com/Plachtaa/KittenTTS) for the original model
- [ONNX Runtime](https://github.com/microsoft/onnxruntime) for WebAssembly support
- [ESpeak-NG](https://github.com/espeak-ng/espeak-ng) for text-to-phoneme conversion
- [Bun](https://bun.sh/) for the fast JavaScript runtime

## 📞 Support

If you encounter any issues or have questions:

1. Check the [troubleshooting section](#-troubleshooting)
2. Search existing [issues](../../issues)
3. Create a new issue with detailed information

---

**Made with ❤️ using TypeScript, Bun, and WebAssembly**
