// Import ONNX Runtime Web
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

interface ModelData {
    inputIds: BigInt64Array;
    voiceEmbedding: Float32Array;
    speed: number;
}

interface InferenceResult {
    audioData: Float32Array;
    time: number;
}

interface WorkerMessage {
    type: 'run' | 'ready' | 'error' | 'result';
    data?: ModelData | InferenceResult | string;
}

// Configuration constants (since workers can't import modules)
const MODEL_PATH = '/kitten_tts_nano_v0_1.onnx';
const MODEL_BACKENDS = [
    { providers: ['webgl', 'wasm'], name: 'WebGL+WASM' },
    { providers: ['webnn', 'webgl', 'wasm'], name: 'WebNN+WebGL+WASM' },
    { providers: ['wasm'], name: 'WASM' }
];

let ortSession: any;
let modelLoaded = false;

async function loadModel(): Promise<void> {
    const models = [
        { path: MODEL_PATH, name: 'Original FP16' }
    ];
    const backends = MODEL_BACKENDS;

    // Configure ONNX Runtime
    ort.env.wasm.wasmPaths = '/';
    ort.env.logLevel = 'warning';

    // Try different combinations
    for (const model of models) {
        for (const backend of backends) {
            if (modelLoaded) break;
            try {
                console.log(`Trying ${model.name} with ${backend.name}...`);
                ortSession = await ort.InferenceSession.create(model.path, {
                    executionProviders: backend.providers,
                    graphOptimizationLevel: 'all',
                    enableProfiling: false
                });
                console.log(`✓ SUCCESS: Loaded ${model.name} with ${backend.name}`);
                console.log('Input names:', ortSession.inputNames);
                console.log('Output names:', ortSession.outputNames);

                // Log input metadata
                if (ortSession.inputNames) {
                    for (const name of ortSession.inputNames) {
                        const metadata = ortSession.inputMetadata?.[name];
                        if (metadata) {
                            console.log(`Input '${name}':`, metadata);
                        }
                    }
                }
                modelLoaded = true;
                self.postMessage({ type: 'ready' } as WorkerMessage);
                return;
            } catch (error) {
                console.log(`✗ Failed ${model.name} with ${backend.name}: ${(error as Error).message}`);
            }
        }
    }

    if (!modelLoaded) {
        self.postMessage({
            type: 'error',
            data: 'Could not load model with any backend. Check console for details.'
        } as WorkerMessage);
    }
}

async function runInference(data: ModelData): Promise<void> {
    if (!ortSession) {
        self.postMessage({ type: 'error', data: 'Model not loaded yet.' } as WorkerMessage);
        return;
    }

    const { inputIds, voiceEmbedding, speed } = data;

    try {
        console.log('Starting inference...');
        console.log('Input tokens length:', inputIds.length);
        console.log('Voice embedding length:', voiceEmbedding.length);
        console.log('Speed:', speed);

        const startTime = performance.now();

        // Create tensors
        const inputIdsTensor = new ort.Tensor('int64', inputIds, [1, inputIds.length]);
        const styleTensor = new ort.Tensor('float32', voiceEmbedding, [1, voiceEmbedding.length]);
        const speedTensor = new ort.Tensor('float32', [speed], [1]);

        // Prepare feeds
        const feeds = {
            'input_ids': inputIdsTensor,
            'style': styleTensor,
            'speed': speedTensor
        };

        console.log('Running model...');

        // Run the model
        const results = await ortSession.run(feeds);
        const endTime = performance.now();
        console.log('Inference complete!');

        // Get the output
        const outputKey = Object.keys(results)[0];
        const outputTensor = results[outputKey];
        const audioData = outputTensor.data;

        console.log(`Generated ${audioData.length} audio samples in ${(endTime - startTime).toFixed(2)}ms`);

        // Trim audio like Python version: [5000:-10000]
        const trimmedAudioData = audioData.slice(5000, -10000);
        console.log(`Trimmed to ${trimmedAudioData.length} audio samples`);

        // Send result back - create a copy to transfer
        const audioArray = new Float32Array(trimmedAudioData);
        self.postMessage({
            type: 'result',
            data: {
                audioData: audioArray,
                time: (endTime - startTime) / 1000
            } as InferenceResult
        } as WorkerMessage, [audioArray.buffer]);
    } catch (error) {
        console.error("Inference error:", error);
        self.postMessage({
            type: 'error',
            data: `Inference failed: ${(error as Error).message}`
        } as WorkerMessage);
    }
}

// Message listener
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    console.log('Worker received message:', e.data.type);
    if (e.data.type === 'run' && e.data.data) {
        runInference(e.data.data as ModelData);
    }
};

// Start loading the model
console.log('Worker initialized - attempting to load model...');
loadModel();
