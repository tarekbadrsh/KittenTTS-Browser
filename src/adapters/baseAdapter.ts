// Base adapter class for TTS models

import {
    ModelType,
    ModelConfig,
    TTSModelAdapter,
    TTSInferenceInput,
    TTSInferenceResult,
    VoiceInfo,
    ProgressCallback,
} from '../types';

/**
 * Abstract base class for TTS model adapters
 * Provides common functionality and enforces the adapter interface
 */
export abstract class BaseAdapter implements TTSModelAdapter {
    abstract readonly modelType: ModelType;
    abstract readonly config: ModelConfig;

    protected _isReady: boolean = false;
    protected _voices: VoiceInfo[] = [];

    /**
     * Initialize the adapter (load model, voices, etc.)
     */
    abstract initialize(onProgress?: ProgressCallback): Promise<void>;

    /**
     * Run TTS inference
     */
    abstract synthesize(input: TTSInferenceInput): Promise<TTSInferenceResult>;

    /**
     * Clean up resources
     */
    abstract dispose(): void;

    /**
     * Check if adapter is ready for inference
     */
    isReady(): boolean {
        return this._isReady;
    }

    /**
     * Get available voices for this model
     */
    getVoices(): VoiceInfo[] {
        return this._voices;
    }

    /**
     * Validate inference input
     */
    protected validateInput(input: TTSInferenceInput): void {
        if (!input.text || input.text.trim().length === 0) {
            throw new Error('Text input is required');
        }
        if (!input.voiceId) {
            throw new Error('Voice ID is required');
        }
        if (input.speed <= 0 || input.speed > 5) {
            throw new Error('Speed must be between 0 and 5');
        }
    }

    /**
     * Ensure adapter is initialized before use
     */
    protected ensureReady(): void {
        if (!this._isReady) {
            throw new Error(`${this.config.name} adapter is not initialized`);
        }
    }
}
