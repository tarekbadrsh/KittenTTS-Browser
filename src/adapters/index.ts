// Adapter factory for multi-model TTS support

import { ModelType, TTSModelAdapter } from '../types';
import { MODEL_CONFIGS } from '../config/models';

// Re-export types
export { BaseAdapter } from './baseAdapter';
export type { TTSModelAdapter };

/**
 * Lazy-load and create a TTS model adapter
 * Uses dynamic imports to reduce initial bundle size
 */
export async function createAdapter(modelType: ModelType): Promise<TTSModelAdapter> {
    const config = MODEL_CONFIGS[modelType];

    if (!config) {
        throw new Error(`Unknown model type: ${modelType}`);
    }

    switch (modelType) {
        case 'kitten': {
            const { KittenAdapter } = await import('./kittenAdapter');
            return new KittenAdapter();
        }
        case 'kokoro': {
            const { KokoroAdapter } = await import('./kokoroAdapter');
            return new KokoroAdapter();
        }
        case 'supertonic': {
            const { SupertonicAdapter } = await import('./supertonicAdapter');
            return new SupertonicAdapter();
        }
        default:
            throw new Error(`Unsupported model type: ${modelType}`);
    }
}

/**
 * Get list of available model types
 */
export function getAvailableModels(): { id: ModelType; name: string; sizeMB: number }[] {
    return Object.values(MODEL_CONFIGS).map(config => ({
        id: config.id,
        name: config.name,
        sizeMB: config.totalSizeMB,
    }));
}
