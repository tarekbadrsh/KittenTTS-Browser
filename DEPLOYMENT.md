# Cloudflare Pages Deployment Guide

This guide explains how to deploy the Kitten TTS Browser application to Cloudflare Pages for global distribution.

## 🚀 Quick Deployment

### Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Install the Cloudflare Pages CLI
3. **Domain** (optional): A custom domain for your pages site

### Step 1: Install Wrangler

```bash
# Install Wrangler globally
bun add -g wrangler

# Or install locally as a dev dependency
bun add -D wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate with Cloudflare.

### Step 3: Build and Deploy

```bash
# Build and deploy in one command
bun run deploy
```

Or build and deploy separately:

```bash
# Build for production
bun run build:cf

# Deploy to Cloudflare Pages
wrangler pages deploy dist
```

## 🔧 Configuration

### Pages Configuration

The application is configured via `wrangler.toml`:

```toml
name = "kitten-tts-browser"
compatibility_date = "2024-01-01"

[pages]
name = "kitten-tts-browser"
bucket = "./dist"
```

### Environment Configuration

The project supports multiple environments:

- **Development**: `wrangler pages dev dist` (local testing)
- **Production**: `bun run deploy` (direct deployment)

## 📁 Build Output

The build process creates a `dist/` directory containing:

```
dist/
├── index.html              # Main HTML file (5.9KB)
├── main.js                 # Compiled main application (232KB)
├── worker.js               # Compiled Web Worker (2.2KB)
├── main.js.map            # Source maps for debugging (848KB)
├── worker.js.map          # Worker source maps (7.9KB)
├── ort.min.js             # ONNX Runtime library (528KB)
├── kitten_tts_nano_v0_1.onnx  # TTS model (23MB)
├── voices.npz             # Voice embeddings (10KB)
├── ort-wasm*.wasm         # WebAssembly files (~40MB total)
└── _headers               # Cloudflare Pages headers configuration
```

## 🌐 CORS Configuration

The Pages deployment is configured with proper CORS headers via the `_headers` file for WebAssembly support:

```
/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type
```

## 🔍 Monitoring and Debugging

### View Pages Logs

```bash
# View deployment status
wrangler pages project list

# View specific project details
wrangler pages project view kitten-tts-browser

# View deployment logs
wrangler pages deployment tail
```

### Test Locally

```bash
# Test the pages locally
wrangler pages dev dist

# Or serve the dist directory directly
bun run start
```

### Check Pages Status

```bash
# List all pages projects
wrangler pages project list

# Get project details
wrangler pages deployment list

# View deployment analytics
wrangler pages deployment list --project-name kitten-tts-browser
```

## 🚨 Troubleshooting

### Common Issues

**Build fails**

```bash
# Clean and rebuild
rm -rf dist/
bun run build:cf
```

**Deployment fails**

```bash
# Check authentication
wrangler whoami

# Re-login if needed
wrangler login

# Check project status
wrangler pages project list
```

**CORS errors in browser**

- Ensure the `_headers` file is properly configured
- Check browser console for specific error messages
- Verify WebAssembly files are accessible
- Check that all file types have correct MIME types

**Model loading fails**

- Check that all `.wasm` and `.onnx` files are in the dist directory
- Verify file sizes match expected values (23MB for model, ~40MB for WASM files)
- Check network tab for failed requests
- Ensure worker.js is being loaded correctly

**Worker script errors**

- Verify worker.js is built and included in dist directory
- Check that the worker path is correct in production vs development
- Ensure CORS headers allow worker script execution

### Performance Optimization

1. **Enable Compression**: Cloudflare automatically compresses static assets
2. **Cache Headers**: Add appropriate cache headers for static assets
3. **CDN Optimization**: Use Cloudflare's global CDN for faster delivery
4. **WebAssembly Optimization**: Ensure WASM files are properly cached
5. **Model Loading**: Consider lazy loading for the 23MB model file

## 📊 Analytics

Monitor your deployment with Cloudflare Analytics:

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select your worker
4. View analytics and metrics

## 🔄 Continuous Deployment

### GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - run: bun run build:cf
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy dist
```

## 🎯 Best Practices

1. **Environment Variables**: Use `wrangler secret put` for sensitive data
2. **Custom Domains**: Configure custom domains in Cloudflare dashboard
3. **Monitoring**: Set up alerts for deployment errors
4. **Backup**: Keep local copies of important configuration files
5. **Testing**: Test thoroughly locally before production deployment
6. **Caching**: Configure appropriate cache headers for static assets
7. **Security**: Use Cloudflare's built-in security features

## 📞 Support

If you encounter issues:

1. Check the [troubleshooting section](#-troubleshooting)
2. Review Cloudflare Pages documentation
3. Check deployment logs with `wrangler pages deployment tail`
4. Contact Cloudflare support for platform-specific issues
5. Check the application logs in browser console

---

**Happy Deploying! 🚀**
