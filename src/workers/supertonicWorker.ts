// Supertonic TTS ONNX Worker
// Handles 4-model pipeline for Supertonic TTS inference
// Based on https://github.com/supertone-inc/supertonic/tree/main/web

declare function importScripts(...urls: string[]): void;
importScripts('/ort.min.js');

// Type definitions for ONNX Runtime
declare global {
    const ort: {
        InferenceSession: {
            create(path: string, options?: any): Promise<any>;
        };
        Tensor: new (type: string, data: any, dims: number[]) => any;
        env: {
            wasm: {
                wasmPaths: string;
            };
            logLevel: string;
        };
    };
}

interface SupertonicConfig {
    ae: {
        sample_rate: number;
        base_chunk_size: number;
    };
    ttl: {
        chunk_compress_factor: number;
        latent_dim: number;
    };
}

interface VoiceStyle {
    ttl: {
        data: number[];
        dims: number[];
    };
    dp: {
        data: number[];
        dims: number[];
    };
}

interface SupertonicInitData {
    cdnBaseUrl: string;
}

interface SupertonicRunData {
    text: string;
    voiceStyle: VoiceStyle;
    speed: number;
    inferenceSteps: number;
}

interface WorkerMessage {
    type: 'init' | 'run' | 'ready' | 'error' | 'result' | 'progress';
    data?: SupertonicInitData | SupertonicRunData | { audioData: Float32Array; time: number } | string;
    progress?: number;
    message?: string;
}

// Model sessions
let textEncoderSession: any = null;
let durationPredictorSession: any = null;
let vectorEstimatorSession: any = null;
let vocoderSession: any = null;

// Config data
let config: SupertonicConfig | null = null;
let unicodeIndexer: number[] | null = null;
let modelsLoaded = false;

const MODEL_BACKENDS = [
    { providers: ['webgpu', 'wasm'], name: 'WebGPU+WASM' },
    { providers: ['webgl', 'wasm'], name: 'WebGL+WASM' },
    { providers: ['wasm'], name: 'WASM' }
];

// Text preprocessing (following official implementation)
function preprocessText(text: string): string {
    // NFKD normalization
    let processed = text.normalize('NFKD');

    // Remove emojis (regex for common emoji ranges)
    processed = processed.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

    // Replace special characters
    processed = processed
        .replace(/[—–−]/g, '-')           // Various dashes to hyphen
        .replace(/[''`]/g, "'")           // Various apostrophes
        .replace(/[""]/g, '"')            // Various quotes
        .replace(/[«»]/g, '"')            // Guillemets
        .replace(/[\[\](){}]/g, '')       // Remove brackets
        .replace(/…/g, '...')             // Ellipsis
        .replace(/\s+/g, ' ')             // Collapse whitespace
        .trim()
        .toLowerCase();

    // Remove diacritics (combining characters)
    processed = processed.replace(/[\u0300-\u036f]/g, '');

    // Ensure ends with punctuation
    if (!/[.!?]$/.test(processed)) {
        processed += '.';
    }

    return processed;
}

// Convert text to indices using Unicode indexer (flat array indexed by codepoint)
function textToIds(text: string, indexer: number[]): number[] {
    const processed = preprocessText(text);
    const ids: number[] = [];

    for (let i = 0; i < processed.length; i++) {
        const codePoint = processed.codePointAt(i);
        if (codePoint !== undefined && codePoint < indexer.length) {
            ids.push(indexer[codePoint]);
        } else {
            ids.push(-1); // Unknown character
        }
    }

    return ids;
}

// Create mask from length
function createMask(length: number, maxLength: number): Float32Array {
    const mask = new Float32Array(maxLength);
    for (let i = 0; i < length; i++) {
        mask[i] = 1.0;
    }
    return mask;
}

// Box-Muller transform for Gaussian noise
function boxMuller(): number {
    let u1 = Math.random();
    while (u1 === 0) u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

async function loadSession(url: string, name: string): Promise<any> {
    for (const backend of MODEL_BACKENDS) {
        try {
            console.log(`[Supertonic] Loading ${name} with ${backend.name}...`);
            const session = await ort.InferenceSession.create(url, {
                executionProviders: backend.providers,
                graphOptimizationLevel: 'all',
                enableProfiling: false
            });
            console.log(`[Supertonic] ${name} loaded successfully`);
            return session;
        } catch (error) {
            console.log(`[Supertonic] ${name} failed with ${backend.name}: ${(error as Error).message}`);
        }
    }
    throw new Error(`Failed to load ${name} with any backend`);
}

async function loadModels(cdnBaseUrl: string): Promise<void> {
    ort.env.wasm.wasmPaths = '/';
    ort.env.logLevel = 'warning';

    try {
        // Load config files first
        self.postMessage({ type: 'progress', progress: 5, message: 'Loading configuration...' });

        const configResponse = await fetch(`${cdnBaseUrl}/onnx/tts.json`);
        config = await configResponse.json();
        console.log('[Supertonic] Config loaded:', config);

        const indexerResponse = await fetch(`${cdnBaseUrl}/onnx/unicode_indexer.json`);
        unicodeIndexer = await indexerResponse.json();
        console.log('[Supertonic] Unicode indexer loaded, length:', unicodeIndexer?.length);

        // Load models sequentially with progress updates
        self.postMessage({ type: 'progress', progress: 10, message: 'Loading text encoder (27MB)...' });
        textEncoderSession = await loadSession(`${cdnBaseUrl}/onnx/text_encoder.onnx`, 'Text Encoder');

        self.postMessage({ type: 'progress', progress: 25, message: 'Loading duration predictor (1.5MB)...' });
        durationPredictorSession = await loadSession(`${cdnBaseUrl}/onnx/duration_predictor.onnx`, 'Duration Predictor');

        self.postMessage({ type: 'progress', progress: 40, message: 'Loading vector estimator (132MB)...' });
        vectorEstimatorSession = await loadSession(`${cdnBaseUrl}/onnx/vector_estimator.onnx`, 'Vector Estimator');

        self.postMessage({ type: 'progress', progress: 75, message: 'Loading vocoder (101MB)...' });
        vocoderSession = await loadSession(`${cdnBaseUrl}/onnx/vocoder.onnx`, 'Vocoder');

        modelsLoaded = true;
        self.postMessage({ type: 'ready' });
        console.log('[Supertonic] All models loaded successfully!');

    } catch (error) {
        console.error('[Supertonic] Model loading error:', error);
        self.postMessage({
            type: 'error',
            data: `Failed to load Supertonic models: ${(error as Error).message}`
        });
    }
}

async function runInference(data: SupertonicRunData): Promise<void> {
    if (!modelsLoaded || !config || !unicodeIndexer) {
        self.postMessage({ type: 'error', data: 'Models not loaded yet.' });
        return;
    }

    const { text, voiceStyle, speed, inferenceSteps } = data;
    const startTime = performance.now();

    try {
        console.log('[Supertonic] Starting inference...');
        console.log('[Supertonic] Text:', text);
        console.log('[Supertonic] Inference steps:', inferenceSteps);

        // Get config values
        const sampleRate = config.ae.sample_rate;
        const baseChunkSize = config.ae.base_chunk_size;
        const chunkCompress = config.ttl.chunk_compress_factor;
        const latentDim = config.ttl.latent_dim;
        const chunkSize = baseChunkSize * chunkCompress;
        const latentDimVal = latentDim * chunkCompress;

        console.log('[Supertonic] Config - sampleRate:', sampleRate, 'chunkSize:', chunkSize, 'latentDimVal:', latentDimVal);

        // Step 1: Text to indices
        const textIds = textToIds(text, unicodeIndexer);
        console.log('[Supertonic] Text IDs:', textIds.length, 'chars');

        if (textIds.length === 0) {
            throw new Error('Text processing resulted in empty sequence');
        }

        // Create text tensors (batch size = 1)
        const textIdsTensor = new ort.Tensor('int64',
            new BigInt64Array(textIds.map(i => BigInt(i))),
            [1, textIds.length]
        );

        const textMask = createMask(textIds.length, textIds.length);
        const textMaskTensor = new ort.Tensor('float32',
            textMask,
            [1, 1, textIds.length]
        );

        // Style tensors (3D: [batch, dim1, dim2])
        console.log('[Supertonic] TTL dims:', voiceStyle.ttl.dims, 'data length:', voiceStyle.ttl.data.length);
        console.log('[Supertonic] DP dims:', voiceStyle.dp.dims, 'data length:', voiceStyle.dp.data.length);

        const styleTtlTensor = new ort.Tensor('float32',
            new Float32Array(voiceStyle.ttl.data),
            voiceStyle.ttl.dims
        );
        const styleDpTensor = new ort.Tensor('float32',
            new Float32Array(voiceStyle.dp.data),
            voiceStyle.dp.dims
        );

        // Step 2: Duration Predictor
        self.postMessage({ type: 'progress', progress: 5, message: 'Predicting duration...' });

        const dpOutputs = await durationPredictorSession.run({
            text_ids: textIdsTensor,
            style_dp: styleDpTensor,
            text_mask: textMaskTensor
        });

        const durationData = dpOutputs.duration.data as Float32Array;
        const totalDuration = Array.from(durationData).reduce((a, b) => a + b, 0) / speed;
        console.log('[Supertonic] Predicted duration:', totalDuration.toFixed(2), 'seconds');

        // Step 3: Text Encoder
        self.postMessage({ type: 'progress', progress: 10, message: 'Encoding text...' });

        const textEncOutputs = await textEncoderSession.run({
            text_ids: textIdsTensor,
            style_ttl: styleTtlTensor,
            text_mask: textMaskTensor
        });

        const textEmb = textEncOutputs.text_emb;
        console.log('[Supertonic] Text encoded, shape:', textEmb.dims);

        // Step 4: Sample noisy latent
        const wavLength = Math.floor(totalDuration * sampleRate);
        const latentLen = Math.ceil(wavLength / chunkSize);

        console.log('[Supertonic] Latent shape:', [1, latentDimVal, latentLen]);

        // Generate Gaussian noise
        const xtData = new Float32Array(latentDimVal * latentLen);
        for (let i = 0; i < xtData.length; i++) {
            xtData[i] = boxMuller();
        }

        // Create latent mask
        const latentMask = createMask(latentLen, latentLen);
        const latentMaskTensor = new ort.Tensor('float32',
            latentMask,
            [1, 1, latentLen]
        );

        // Step 5: Vector Estimator (denoising loop)
        let xt = xtData;

        for (let step = 0; step < inferenceSteps; step++) {
            const progress = 15 + (step / inferenceSteps) * 70;
            self.postMessage({
                type: 'progress',
                progress,
                message: `Denoising (${step + 1}/${inferenceSteps})...`
            });

            const xtTensor = new ort.Tensor('float32', xt, [1, latentDimVal, latentLen]);
            const currentStepTensor = new ort.Tensor('float32', new Float32Array([step]), [1]);
            const totalStepTensor = new ort.Tensor('float32', new Float32Array([inferenceSteps]), [1]);

            const vectorEstOutputs = await vectorEstimatorSession.run({
                noisy_latent: xtTensor,
                text_emb: textEmb,
                style_ttl: styleTtlTensor,
                latent_mask: latentMaskTensor,
                text_mask: textMaskTensor,
                current_step: currentStepTensor,
                total_step: totalStepTensor
            });

            xt = new Float32Array(vectorEstOutputs.denoised_latent.data);
        }

        console.log('[Supertonic] Denoising complete');

        // Step 6: Vocoder
        self.postMessage({ type: 'progress', progress: 90, message: 'Generating audio...' });

        const finalLatentTensor = new ort.Tensor('float32', xt, [1, latentDimVal, latentLen]);

        const vocoderOutputs = await vocoderSession.run({
            latent: finalLatentTensor
        });

        const audioData = new Float32Array(vocoderOutputs.wav_tts.data);
        const endTime = performance.now();

        console.log(`[Supertonic] Generated ${audioData.length} samples (${(audioData.length / sampleRate).toFixed(2)}s) in ${(endTime - startTime).toFixed(2)}ms`);

        self.postMessage({
            type: 'result',
            data: {
                audioData: audioData,
                time: (endTime - startTime) / 1000
            }
        }, [audioData.buffer]);

    } catch (error) {
        console.error('[Supertonic] Inference error:', error);
        self.postMessage({
            type: 'error',
            data: `Inference failed: ${(error as Error).message}`
        });
    }
}

// Message listener
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    console.log('[Supertonic Worker] Received message:', e.data.type);

    switch (e.data.type) {
        case 'init':
            if (e.data.data && typeof e.data.data === 'object' && 'cdnBaseUrl' in e.data.data) {
                loadModels((e.data.data as SupertonicInitData).cdnBaseUrl);
            }
            break;
        case 'run':
            if (e.data.data) {
                runInference(e.data.data as SupertonicRunData);
            }
            break;
    }
};

console.log('[Supertonic Worker] Initialized - waiting for model URL...');
