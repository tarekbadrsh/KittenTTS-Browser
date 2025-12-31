// Kokoro-82M ONNX Worker
// Handles model loading and inference for Kokoro TTS

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

interface KokoroModelData {
    inputIds: BigInt64Array;
    styleVector: Float32Array;
    speed: number;
}

interface InferenceResult {
    audioData: Float32Array;
    time: number;
}

interface WorkerMessage {
    type: 'init' | 'run' | 'ready' | 'error' | 'result' | 'progress';
    data?: KokoroModelData | InferenceResult | string | { modelUrl: string };
    progress?: number;
    message?: string;
}

// Configuration
const MODEL_BACKENDS = [
    { providers: ['webgl', 'wasm'], name: 'WebGL+WASM' },
    { providers: ['wasm'], name: 'WASM' }
];

let ortSession: any = null;
let modelLoaded = false;

async function loadModel(modelUrl: string): Promise<void> {
    const backends = MODEL_BACKENDS;

    // Configure ONNX Runtime
    ort.env.wasm.wasmPaths = '/';
    ort.env.logLevel = 'warning';

    // Try different backend combinations
    for (const backend of backends) {
        if (modelLoaded) break;
        try {
            console.log(`[Kokoro] Trying ${backend.name}...`);
            self.postMessage({
                type: 'progress',
                progress: 30,
                message: `Loading model with ${backend.name}...`
            } as WorkerMessage);

            ortSession = await ort.InferenceSession.create(modelUrl, {
                executionProviders: backend.providers,
                graphOptimizationLevel: 'all',
                enableProfiling: false
            });

            console.log(`[Kokoro] SUCCESS: Loaded with ${backend.name}`);
            console.log('[Kokoro] Input names:', ortSession.inputNames);
            console.log('[Kokoro] Output names:', ortSession.outputNames);

            modelLoaded = true;
            self.postMessage({ type: 'ready' } as WorkerMessage);
            return;

        } catch (error) {
            console.log(`[Kokoro] Failed with ${backend.name}: ${(error as Error).message}`);
        }
    }

    if (!modelLoaded) {
        self.postMessage({
            type: 'error',
            data: 'Could not load Kokoro model with any backend.'
        } as WorkerMessage);
    }
}

async function runInference(data: KokoroModelData): Promise<void> {
    if (!ortSession) {
        self.postMessage({ type: 'error', data: 'Model not loaded yet.' } as WorkerMessage);
        return;
    }

    const { inputIds, styleVector, speed } = data;

    try {
        console.log('[Kokoro] Starting inference...');
        console.log('[Kokoro] Input tokens:', inputIds.length);
        console.log('[Kokoro] Style vector length:', styleVector.length);
        console.log('[Kokoro] Speed:', speed);

        const startTime = performance.now();

        // Create tensors for Kokoro model
        // Kokoro expects: input_ids, style, speed
        const inputIdsTensor = new ort.Tensor('int64', inputIds, [1, inputIds.length]);
        const styleTensor = new ort.Tensor('float32', styleVector, [1, styleVector.length]);
        const speedTensor = new ort.Tensor('float32', [speed], [1]);

        // Prepare feeds based on model's expected input names
        const feeds: Record<string, any> = {};

        // Try common input name patterns for Kokoro
        if (ortSession.inputNames.includes('input_ids')) {
            feeds['input_ids'] = inputIdsTensor;
        } else if (ortSession.inputNames.includes('tokens')) {
            feeds['tokens'] = inputIdsTensor;
        }

        if (ortSession.inputNames.includes('style')) {
            feeds['style'] = styleTensor;
        } else if (ortSession.inputNames.includes('speaker_embedding')) {
            feeds['speaker_embedding'] = styleTensor;
        }

        if (ortSession.inputNames.includes('speed')) {
            feeds['speed'] = speedTensor;
        }

        console.log('[Kokoro] Running model with feeds:', Object.keys(feeds));

        const results = await ortSession.run(feeds);
        const endTime = performance.now();
        console.log('[Kokoro] Inference complete!');

        // Get the output
        const outputKey = Object.keys(results)[0];
        const outputTensor = results[outputKey];
        const audioData = outputTensor.data;

        console.log(`[Kokoro] Generated ${audioData.length} samples in ${(endTime - startTime).toFixed(2)}ms`);

        // Create a copy for transfer
        const audioArray = new Float32Array(audioData);

        self.postMessage({
            type: 'result',
            data: {
                audioData: audioArray,
                time: (endTime - startTime) / 1000
            } as InferenceResult
        } as WorkerMessage, [audioArray.buffer]);

    } catch (error) {
        console.error('[Kokoro] Inference error:', error);
        self.postMessage({
            type: 'error',
            data: `Inference failed: ${(error as Error).message}`
        } as WorkerMessage);
    }
}

// Message listener
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    console.log('[Kokoro Worker] Received message:', e.data.type);

    switch (e.data.type) {
        case 'init':
            if (e.data.data && typeof e.data.data === 'object' && 'modelUrl' in e.data.data) {
                loadModel(e.data.data.modelUrl);
            }
            break;
        case 'run':
            if (e.data.data) {
                runInference(e.data.data as KokoroModelData);
            }
            break;
    }
};

console.log('[Kokoro Worker] Initialized - waiting for model URL...');
