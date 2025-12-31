// Supertonic TTS adapter with 4-model ONNX pipeline
// Uses Web Worker for inference

import { BaseAdapter } from './baseAdapter';
import {
    ModelType,
    ModelConfig,
    TTSInferenceInput,
    TTSInferenceResult,
    ProgressCallback,
} from '../types';
import { MODEL_CONFIGS, SUPERTONIC_VOICES } from '../config/models';

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

/**
 * Adapter for Supertonic TTS with 4-model ONNX pipeline
 * Models: text_encoder, duration_predictor, vector_estimator, vocoder
 * Uses HuggingFace CDN: https://huggingface.co/Supertone/supertonic
 */
export class SupertonicAdapter extends BaseAdapter {
    readonly modelType: ModelType = 'supertonic';
    readonly config: ModelConfig = MODEL_CONFIGS.supertonic;

    private worker: Worker | null = null;
    private voiceStyleCache: Map<string, VoiceStyle> = new Map();
    private pendingResolve: ((result: TTSInferenceResult) => void) | null = null;
    private pendingReject: ((error: Error) => void) | null = null;
    private inferenceStartTime: number = 0;
    private onProgressCallback: ProgressCallback | null = null;

    constructor() {
        super();
        this._voices = SUPERTONIC_VOICES;
    }

    async initialize(onProgress?: ProgressCallback): Promise<void> {
        try {
            onProgress?.(5, 'Initializing Supertonic worker...');
            await this.initializeWorker(onProgress);

            // Preload first voice style
            onProgress?.(90, 'Loading default voice...');
            const defaultVoice = SUPERTONIC_VOICES[0];
            await this.loadVoiceStyle(defaultVoice.id);

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
                ? '/src/workers/supertonicWorker.ts'
                : '/workers/supertonicWorker.js';

            this.worker = new Worker(workerPath);

            const handleMessage = (e: MessageEvent) => {
                const { type, data, progress, message } = e.data;

                switch (type) {
                    case 'progress':
                        // Scale worker progress to 5-90 range during init
                        if (!this._isReady) {
                            const scaledProgress = 5 + (progress || 0) * 0.85;
                            onProgress?.(scaledProgress, message || 'Loading models...');
                        } else if (this.onProgressCallback) {
                            // During inference, pass progress directly
                            this.onProgressCallback(progress || 0, message || '');
                        }
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
                            this.onProgressCallback = null;
                        }
                        break;

                    case 'error':
                        const errorMsg = data as string;
                        if (this.pendingReject) {
                            this.pendingReject(new Error(errorMsg));
                            this.pendingResolve = null;
                            this.pendingReject = null;
                            this.onProgressCallback = null;
                        } else {
                            reject(new Error(errorMsg));
                        }
                        break;
                }
            };

            this.worker.onmessage = handleMessage;
            this.worker.onerror = (error) => {
                console.error('Supertonic worker error:', error);
                reject(new Error('Worker initialization failed: ' + error.message));
            };

            // Send init message with CDN URL
            onProgress?.(10, 'Downloading Supertonic models (~263MB)...');

            this.worker.postMessage({
                type: 'init',
                data: { cdnBaseUrl: this.config.cdnBaseUrl }
            });
        });
    }

    private async loadVoiceStyle(voiceId: string): Promise<VoiceStyle> {
        // Check cache
        const cached = this.voiceStyleCache.get(voiceId);
        if (cached) {
            return cached;
        }

        // Load from CDN
        const voiceUrl = `${this.config.cdnBaseUrl}/voice_styles/${voiceId}.json`;
        console.log(`[Supertonic] Loading voice style: ${voiceUrl}`);

        const response = await fetch(voiceUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch voice ${voiceId}: ${response.status}`);
        }

        const voiceData = await response.json();

        // Voice style JSON has nested structure: { style_ttl: { data: [...], dims: [...] }, style_dp: { ... } }
        const ttlRaw = voiceData.style_ttl;
        const dpRaw = voiceData.style_dp;

        // Flatten nested arrays to 1D and extract dimensions
        const flattenArray = (arr: any): number[] => {
            if (!Array.isArray(arr)) return [arr];
            return arr.flat(Infinity);
        };

        const voiceStyle: VoiceStyle = {
            ttl: {
                data: flattenArray(ttlRaw.data),
                dims: ttlRaw.dims || [1, ttlRaw.data.length, ttlRaw.data[0]?.length || 1]
            },
            dp: {
                data: flattenArray(dpRaw.data),
                dims: dpRaw.dims || [1, dpRaw.data.length, dpRaw.data[0]?.length || 1]
            }
        };

        console.log(`[Supertonic] Voice ${voiceId} loaded - TTL dims:`, voiceStyle.ttl.dims, 'DP dims:', voiceStyle.dp.dims);

        this.voiceStyleCache.set(voiceId, voiceStyle);
        return voiceStyle;
    }

    async synthesize(input: TTSInferenceInput): Promise<TTSInferenceResult> {
        this.ensureReady();
        this.validateInput(input);

        if (!this.worker) {
            throw new Error('Worker not initialized');
        }

        // Load voice style if not cached
        const voiceStyle = await this.loadVoiceStyle(input.voiceId);

        // Get inference steps from options (default: 5)
        const inferenceSteps = input.options?.numInferenceSteps || 5;

        console.log('[Supertonic] Starting synthesis...');
        console.log('[Supertonic] Text:', input.text);
        console.log('[Supertonic] Voice:', input.voiceId);
        console.log('[Supertonic] Inference steps:', inferenceSteps);
        console.log('[Supertonic] Speed:', input.speed);

        return new Promise((resolve, reject) => {
            this.pendingResolve = resolve;
            this.pendingReject = reject;
            this.inferenceStartTime = performance.now();
            this.onProgressCallback = input.options?.onProgress || null;

            this.worker!.postMessage({
                type: 'run',
                data: {
                    text: input.text,
                    voiceStyle: voiceStyle,
                    speed: input.speed,
                    inferenceSteps: inferenceSteps,
                }
            });
        });
    }

    dispose(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this._isReady = false;
        this.voiceStyleCache.clear();
    }
}
