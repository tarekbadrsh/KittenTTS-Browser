// Type definitions for the TTS application

// ============================================
// Multi-Model TTS Types
// ============================================

/** Supported TTS model types */
export type ModelType = 'kitten' | 'kokoro' | 'supertonic';

/** Kokoro quantization options */
export type KokoroQuantization = 'q4' | 'q8' | 'fp16' | 'fp32';

/** Model configuration */
export interface ModelConfig {
    id: ModelType;
    name: string;
    sampleRate: number;
    voiceFormat: 'npz' | 'bin';
    voiceEmbeddingDim: number;
    modelFiles: string[];
    totalSizeMB: number;
    quantizationOptions?: KokoroQuantization[];
    cdnBaseUrl?: string;
}

/** Unified inference input for all models */
export interface TTSInferenceInput {
    text: string;
    voiceId: string;
    speed: number;
    options?: {
        quantization?: KokoroQuantization;  // For Kokoro
        numInferenceSteps?: number;          // For Supertonic (1-50)
    };
}

/** Unified inference result */
export interface TTSInferenceResult {
    audioData: Float32Array;
    sampleRate: number;
    inferenceTimeMs: number;
}

/** Voice metadata */
export interface VoiceInfo {
    id: string;
    name: string;
    model: ModelType;
    language: string;
    gender?: 'male' | 'female' | 'neutral';
}

/** Progress callback type */
export type ProgressCallback = (percent: number, message?: string) => void;

/** Model adapter interface (Strategy Pattern) */
export interface TTSModelAdapter {
    readonly modelType: ModelType;
    readonly config: ModelConfig;

    /** Initialize the adapter (load model, voices, etc.) */
    initialize(onProgress?: ProgressCallback): Promise<void>;

    /** Check if adapter is ready for inference */
    isReady(): boolean;

    /** Run TTS inference */
    synthesize(input: TTSInferenceInput): Promise<TTSInferenceResult>;

    /** Get available voices for this model */
    getVoices(): VoiceInfo[];

    /** Clean up resources */
    dispose(): void;
}

/** Extended worker message types for multi-model support */
export interface MultiModelWorkerMessage {
    type: 'init' | 'run' | 'ready' | 'progress' | 'result' | 'error' | 'switch-model';
    modelType?: ModelType;
    data?: any;
    progress?: number;
    message?: string;
}

// ============================================
// Existing Types (maintained for compatibility)
// ============================================

export interface VoiceData {
    [voiceName: string]: Float32Array;
}

export interface WorkerMessage {
    type: 'ready' | 'result' | 'error';
    data?: {
        audioData?: Float32Array;
        time?: number;
    } | string;
}

export interface ModelInput {
    inputIds: BigInt64Array;
    voiceEmbedding: Float32Array;
    speed: number;
}

export interface AudioResult {
    audioData: Float32Array;
    time: number;
}

export interface NPYData {
    data: Float32Array;
    shape: number[];
}



export interface TextCleaner {
    (text: string): number[];
}

export interface Tokenizer {
    (text: string): Promise<number[]>;
}

export interface Phonemizer {
    (text: string): Promise<string>;
}

export interface AudioProcessor {
    (audioData: Float32Array, sampleRate: number): ArrayBuffer;
}

// DOM element types
export interface DOMElements {
    statusElement: HTMLElement;
    generateButton: HTMLButtonElement;
    voiceSelect: HTMLSelectElement;
    textInput: HTMLTextAreaElement;
    audioOutput: HTMLAudioElement;
    speedInput: HTMLInputElement;
    // New multi-model UI elements (optional for backward compatibility)
    modelSelect?: HTMLSelectElement;
    quantizationSelect?: HTMLSelectElement;
    inferenceStepsInput?: HTMLInputElement;
    inferenceStepsValue?: HTMLSpanElement;
    downloadProgress?: HTMLDivElement;
    progressBar?: HTMLDivElement;
    progressText?: HTMLSpanElement;
    kokoroOptions?: HTMLDivElement;
    supertonicOptions?: HTMLDivElement;
}

// Application state
export interface AppState {
    voices: VoiceData;
    worker: Worker | null;
    textCleaner: TextCleaner | null;
    ESpeakNg: any | null;
    isInitialized: boolean;
}
