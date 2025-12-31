// Kokoro-82M ONNX adapter

import { BaseAdapter } from './baseAdapter';
import {
    ModelType,
    ModelConfig,
    TTSInferenceInput,
    TTSInferenceResult,
    ProgressCallback,
    WorkerMessage,
} from '../types';
import { MODEL_CONFIGS, KOKORO_VOICES, KOKORO_MODEL_FILES } from '../config/models';
import { TextProcessor } from '../textProcessor';
import { loadKokoroVoice, getStyleVector, KokoroVoiceData } from '../voiceLoaders/binLoader';

/**
 * Adapter for Kokoro-82M ONNX model
 * Uses HuggingFace CDN for model and voice files
 */
export class KokoroAdapter extends BaseAdapter {
    readonly modelType: ModelType = 'kokoro';
    readonly config: ModelConfig = MODEL_CONFIGS.kokoro;

    private worker: Worker | null = null;
    private textProcessor: TextProcessor;
    private voiceDataCache: Map<string, KokoroVoiceData> = new Map();
    private pendingResolve: ((result: TTSInferenceResult) => void) | null = null;
    private pendingReject: ((error: Error) => void) | null = null;
    private inferenceStartTime: number = 0;
    private currentQuantization: string = 'q8';

    constructor() {
        super();
        this.textProcessor = new TextProcessor();
        this._voices = KOKORO_VOICES;
    }

    async initialize(onProgress?: ProgressCallback): Promise<void> {
        try {
            // Initialize text processor (phonemizer)
            onProgress?.(5, 'Loading phonemizer...');
            await this.textProcessor.initialize();

            // Initialize worker with model
            onProgress?.(20, 'Initializing Kokoro worker...');
            await this.initializeWorker(onProgress);

            // Preload first voice
            onProgress?.(80, 'Loading default voice...');
            const defaultVoice = KOKORO_VOICES[0];
            await this.loadVoiceData(defaultVoice.id);

            onProgress?.(100, 'Ready');
            this._isReady = true;

        } catch (error) {
            this._isReady = false;
            throw error;
        }
    }

    private async initializeWorker(onProgress?: ProgressCallback): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!window.Worker) {
                reject(new Error('Web Workers are not supported in this browser.'));
                return;
            }

            // Use the built worker file in production, or the source file in development
            const workerPath = window.location.hostname === 'localhost'
                ? '/src/workers/kokoroWorker.ts'
                : '/workers/kokoroWorker.js';

            this.worker = new Worker(workerPath);

            const handleMessage = (e: MessageEvent) => {
                const { type, data, progress, message } = e.data;

                switch (type) {
                    case 'progress':
                        // Scale worker progress to 20-80 range
                        const scaledProgress = 20 + (progress || 0) * 0.6;
                        onProgress?.(scaledProgress, message || 'Loading model...');
                        break;

                    case 'ready':
                        resolve();
                        break;

                    case 'result':
                        if (this.pendingResolve && data && typeof data === 'object' && 'audioData' in data) {
                            const inferenceTime = performance.now() - this.inferenceStartTime;
                            this.pendingResolve({
                                audioData: data.audioData as Float32Array,
                                sampleRate: this.config.sampleRate,
                                inferenceTimeMs: inferenceTime,
                            });
                            this.pendingResolve = null;
                            this.pendingReject = null;
                        }
                        break;

                    case 'error':
                        const errorMsg = data as string;
                        if (this.pendingReject) {
                            this.pendingReject(new Error(errorMsg));
                            this.pendingResolve = null;
                            this.pendingReject = null;
                        } else {
                            reject(new Error(errorMsg));
                        }
                        break;
                }
            };

            this.worker.onmessage = handleMessage;
            this.worker.onerror = (error) => {
                console.error('Kokoro worker error:', error);
                reject(new Error('Worker initialization failed: ' + error.message));
            };

            // Get model URL based on quantization
            const modelFile = KOKORO_MODEL_FILES[this.currentQuantization];
            const modelUrl = `${this.config.cdnBaseUrl}/${modelFile.file}`;

            onProgress?.(25, `Downloading Kokoro model (~${modelFile.sizeMB}MB)...`);

            // Send init message with model URL
            this.worker.postMessage({
                type: 'init',
                data: { modelUrl }
            });
        });
    }

    private async loadVoiceData(voiceId: string): Promise<KokoroVoiceData> {
        // Check cache
        const cached = this.voiceDataCache.get(voiceId);
        if (cached) {
            return cached;
        }

        // Load from CDN
        const voiceData = await loadKokoroVoice(
            voiceId,
            this.config.cdnBaseUrl!
        );

        this.voiceDataCache.set(voiceId, voiceData);
        return voiceData;
    }

    async synthesize(input: TTSInferenceInput): Promise<TTSInferenceResult> {
        this.ensureReady();
        this.validateInput(input);

        if (!this.worker) {
            throw new Error('Worker not initialized');
        }

        // Load voice data if not cached
        const voiceData = await this.loadVoiceData(input.voiceId);

        // Tokenize text using phonemizer
        const tokens = await this.textProcessor.tokenize(input.text);
        console.log('[Kokoro] Tokens:', tokens);

        // Get style vector based on token count
        // Kokoro uses token-dependent style selection
        const styleVector = getStyleVector(voiceData, tokens.length, this.config.voiceEmbeddingDim);

        const inputIds = new BigInt64Array(tokens.map(t => BigInt(t)));
        const styleVectorCopy = new Float32Array(styleVector);

        return new Promise((resolve, reject) => {
            this.pendingResolve = resolve;
            this.pendingReject = reject;
            this.inferenceStartTime = performance.now();

            this.worker!.postMessage({
                type: 'run',
                data: {
                    inputIds,
                    styleVector: styleVectorCopy,
                    speed: input.speed,
                }
            }, [inputIds.buffer, styleVectorCopy.buffer]);
        });
    }

    /**
     * Set the quantization level for the model
     * Note: Requires re-initialization to take effect
     */
    setQuantization(quantization: string): void {
        if (KOKORO_MODEL_FILES[quantization]) {
            this.currentQuantization = quantization;
        }
    }

    dispose(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this._isReady = false;
        this.voiceDataCache.clear();
    }
}
