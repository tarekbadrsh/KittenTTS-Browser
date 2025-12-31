// Model configurations for multi-model TTS support

import { ModelConfig, ModelType, VoiceInfo } from '../types';

/**
 * Model configurations for all supported TTS models
 */
export const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
    kitten: {
        id: 'kitten',
        name: 'KittenTTS Nano',
        sampleRate: 24000,
        voiceFormat: 'npz',
        voiceEmbeddingDim: 256,
        modelFiles: ['/kitten_tts_nano_v0_1.onnx'],
        totalSizeMB: 24,
        // Self-hosted, no CDN URL needed
    },
    kokoro: {
        id: 'kokoro',
        name: 'Kokoro-82M',
        sampleRate: 24000,
        voiceFormat: 'bin',
        voiceEmbeddingDim: 256,
        modelFiles: ['onnx/model_quantized.onnx'], // Default to q8
        totalSizeMB: 92,
        quantizationOptions: ['q4', 'q8', 'fp16', 'fp32'],
        cdnBaseUrl: 'https://huggingface.co/onnx-community/Kokoro-82M-ONNX/resolve/main',
    },
    supertonic: {
        id: 'supertonic',
        name: 'Supertonic TTS',
        sampleRate: 44100, // Supertonic outputs 44.1kHz audio
        voiceFormat: 'json',
        voiceEmbeddingDim: 512,
        modelFiles: [
            'onnx/text_encoder.onnx',      // 27.3 MB
            'onnx/duration_predictor.onnx', // 1.5 MB
            'onnx/vector_estimator.onnx',   // 132 MB
            'onnx/vocoder.onnx',            // 101 MB
        ],
        totalSizeMB: 263,
        cdnBaseUrl: 'https://huggingface.co/Supertone/supertonic/resolve/main',
    },
};

/**
 * Kokoro ONNX model files by quantization level
 */
export const KOKORO_MODEL_FILES: Record<string, { file: string; sizeMB: number }> = {
    q4: { file: 'onnx/model_q4.onnx', sizeMB: 154 },
    q8: { file: 'onnx/model_quantized.onnx', sizeMB: 92 },
    fp16: { file: 'onnx/model_fp16.onnx', sizeMB: 163 },
    fp32: { file: 'onnx/model.onnx', sizeMB: 326 },
};

/**
 * Kokoro voice definitions
 * Voice data is stored in .bin files with style vectors indexed by token count
 * Only includes voices available in the ONNX-community repo
 */
export const KOKORO_VOICES: VoiceInfo[] = [
    // American Female
    { id: 'af', name: 'Default (American Female)', model: 'kokoro', language: 'en-us', gender: 'female' },
    { id: 'af_bella', name: 'Bella (American Female)', model: 'kokoro', language: 'en-us', gender: 'female' },
    { id: 'af_nicole', name: 'Nicole (American Female)', model: 'kokoro', language: 'en-us', gender: 'female' },
    { id: 'af_sarah', name: 'Sarah (American Female)', model: 'kokoro', language: 'en-us', gender: 'female' },
    { id: 'af_sky', name: 'Sky (American Female)', model: 'kokoro', language: 'en-us', gender: 'female' },
    // American Male
    { id: 'am_adam', name: 'Adam (American Male)', model: 'kokoro', language: 'en-us', gender: 'male' },
    { id: 'am_michael', name: 'Michael (American Male)', model: 'kokoro', language: 'en-us', gender: 'male' },
    // British Female
    { id: 'bf_emma', name: 'Emma (British Female)', model: 'kokoro', language: 'en-gb', gender: 'female' },
    { id: 'bf_isabella', name: 'Isabella (British Female)', model: 'kokoro', language: 'en-gb', gender: 'female' },
    // British Male
    { id: 'bm_george', name: 'George (British Male)', model: 'kokoro', language: 'en-gb', gender: 'male' },
    { id: 'bm_lewis', name: 'Lewis (British Male)', model: 'kokoro', language: 'en-gb', gender: 'male' },
];

/**
 * Supertonic voice definitions
 */
export const SUPERTONIC_VOICES: VoiceInfo[] = [
    { id: 'F1', name: 'Female 1', model: 'supertonic', language: 'en', gender: 'female' },
    { id: 'F2', name: 'Female 2', model: 'supertonic', language: 'en', gender: 'female' },
    { id: 'F3', name: 'Female 3', model: 'supertonic', language: 'en', gender: 'female' },
    { id: 'F4', name: 'Female 4', model: 'supertonic', language: 'en', gender: 'female' },
    { id: 'F5', name: 'Female 5', model: 'supertonic', language: 'en', gender: 'female' },
    { id: 'M1', name: 'Male 1', model: 'supertonic', language: 'en', gender: 'male' },
    { id: 'M2', name: 'Male 2', model: 'supertonic', language: 'en', gender: 'male' },
    { id: 'M3', name: 'Male 3', model: 'supertonic', language: 'en', gender: 'male' },
    { id: 'M4', name: 'Male 4', model: 'supertonic', language: 'en', gender: 'male' },
    { id: 'M5', name: 'Male 5', model: 'supertonic', language: 'en', gender: 'male' },
];

/**
 * Get voices for a specific model
 */
export function getVoicesForModel(modelType: ModelType): VoiceInfo[] {
    switch (modelType) {
        case 'kokoro':
            return KOKORO_VOICES;
        case 'supertonic':
            return SUPERTONIC_VOICES;
        case 'kitten':
        default:
            // Kitten voices are loaded dynamically from NPZ file
            return [];
    }
}

/**
 * Get model config by type
 */
export function getModelConfig(modelType: ModelType): ModelConfig {
    return MODEL_CONFIGS[modelType];
}
