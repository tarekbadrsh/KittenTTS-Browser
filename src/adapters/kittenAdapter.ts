// KittenTTS Nano adapter - wraps the existing implementation

import { BaseAdapter } from './baseAdapter';
import {
    ModelType,
    ModelConfig,
    TTSInferenceInput,
    TTSInferenceResult,
    VoiceInfo,
    ProgressCallback,
    VoiceData,
    WorkerMessage,
} from '../types';
import { MODEL_CONFIGS } from '../config/models';
import { TextProcessor } from '../textProcessor';
import { VoiceLoader } from '../voiceLoader';

/**
 * Adapter for KittenTTS Nano model
 * Uses the existing worker-based inference pipeline
 */
export class KittenAdapter extends BaseAdapter {
    readonly modelType: ModelType = 'kitten';
    readonly config: ModelConfig = MODEL_CONFIGS.kitten;

    private worker: Worker | null = null;
    private textProcessor: TextProcessor;
    private voiceLoader: VoiceLoader;
    private voiceData: VoiceData = {};
    private pendingResolve: ((result: TTSInferenceResult) => void) | null = null;
    private pendingReject: ((error: Error) => void) | null = null;
    private inferenceStartTime: number = 0;

    constructor() {
        super();
        this.textProcessor = new TextProcessor();
        this.voiceLoader = new VoiceLoader();
    }

    async initialize(onProgress?: ProgressCallback): Promise<void> {
        try {
            // Initialize text processor (phonemizer)
            onProgress?.(10, 'Loading phonemizer...');
            await this.textProcessor.initialize();

            // Load voices
            onProgress?.(30, 'Loading voices...');
            this.voiceData = await this.voiceLoader.loadVoices();

            // Create voice info from loaded voice data
            this._voices = Object.keys(this.voiceData).map(name => ({
                id: name,
                name: name,
                model: 'kitten' as ModelType,
                language: 'en',
            }));

            // Initialize worker
            onProgress?.(50, 'Loading model (~24MB)...');
            await this.initializeWorker();

            onProgress?.(100, 'Ready');
            this._isReady = true;
        } catch (error) {
            this._isReady = false;
            throw error;
        }
    }

    private async initializeWorker(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!window.Worker) {
                reject(new Error('Web Workers are not supported in this browser.'));
                return;
            }

            // Use the built worker file in production, or the source file in development
            const workerPath = window.location.hostname === 'localhost'
                ? '/src/workers/kittenWorker.ts'
                : '/workers/kittenWorker.js';

            this.worker = new Worker(workerPath);

            const handleMessage = (e: MessageEvent<WorkerMessage>) => {
                const { type, data } = e.data;

                switch (type) {
                    case 'ready':
                        // Worker is ready, resolve initialization
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
                        if (this.pendingReject) {
                            this.pendingReject(new Error(data as string));
                            this.pendingResolve = null;
                            this.pendingReject = null;
                        } else {
                            // Error during initialization
                            reject(new Error(data as string));
                        }
                        break;
                }
            };

            this.worker.onmessage = handleMessage;
            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                reject(new Error('Worker initialization failed: ' + error.message));
            };
        });
    }

    async synthesize(input: TTSInferenceInput): Promise<TTSInferenceResult> {
        this.ensureReady();
        this.validateInput(input);

        if (!this.worker) {
            throw new Error('Worker not initialized');
        }

        const voiceEmbedding = this.voiceData[input.voiceId];
        if (!voiceEmbedding) {
            throw new Error(`Voice not found: ${input.voiceId}`);
        }

        // Tokenize text
        const tokens = await this.textProcessor.tokenize(input.text);
        console.log('Tokens:', tokens);

        const inputIds = new BigInt64Array(tokens.map(t => BigInt(t)));
        const voiceEmbeddingCopy = new Float32Array(voiceEmbedding);

        return new Promise((resolve, reject) => {
            this.pendingResolve = resolve;
            this.pendingReject = reject;
            this.inferenceStartTime = performance.now();

            this.worker!.postMessage({
                type: 'run',
                data: {
                    inputIds,
                    voiceEmbedding: voiceEmbeddingCopy,
                    speed: input.speed,
                }
            }, [inputIds.buffer, voiceEmbeddingCopy.buffer]);
        });
    }

    dispose(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this._isReady = false;
        this.voiceData = {};
        this._voices = [];
    }
}
