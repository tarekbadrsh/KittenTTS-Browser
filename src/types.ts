// Type definitions for the TTS application

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
}

// Application state
export interface AppState {
    voices: VoiceData;
    worker: Worker | null;
    textCleaner: TextCleaner | null;
    ESpeakNg: any | null;
    isInitialized: boolean;
}
