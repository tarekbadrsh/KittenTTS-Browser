// BIN Voice Loader for Kokoro and Supertonic voice files

import { ProgressCallback } from '../types';

/**
 * Voice data structure for Kokoro voices
 * Style vectors are indexed by token count: voices[tokenCount * 256]
 */
export interface KokoroVoiceData {
    data: Float32Array;
    length: number;
}

/**
 * Cache for loaded voice data to avoid re-downloading
 */
const voiceCache: Map<string, KokoroVoiceData> = new Map();

/**
 * Load a Kokoro voice .bin file from HuggingFace CDN
 * Voice files contain style vectors indexed by token count
 */
export async function loadKokoroVoice(
    voiceId: string,
    cdnBaseUrl: string,
    onProgress?: ProgressCallback
): Promise<KokoroVoiceData> {
    // Check cache first
    const cacheKey = `${cdnBaseUrl}/${voiceId}`;
    const cached = voiceCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const voiceUrl = `${cdnBaseUrl}/voices/${voiceId}.bin`;
    onProgress?.(0, `Loading voice: ${voiceId}...`);

    try {
        const response = await fetch(voiceUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch voice ${voiceId}: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const data = new Float32Array(arrayBuffer);

        const voiceData: KokoroVoiceData = {
            data,
            length: data.length,
        };

        // Cache the voice data
        voiceCache.set(cacheKey, voiceData);

        onProgress?.(100, `Voice ${voiceId} loaded`);
        return voiceData;

    } catch (error) {
        console.error(`Error loading voice ${voiceId}:`, error);
        throw error;
    }
}

/**
 * Get style vector for a specific token count from voice data
 * Kokoro uses token-dependent style vectors (256 floats per token position)
 */
export function getStyleVector(
    voiceData: KokoroVoiceData,
    tokenCount: number,
    embeddingDim: number = 256
): Float32Array {
    // Clamp token count to valid range (0 to 509)
    const maxTokens = Math.floor(voiceData.length / embeddingDim) - 1;
    const clampedTokenCount = Math.min(Math.max(0, tokenCount - 2), maxTokens);

    const startIdx = clampedTokenCount * embeddingDim;
    const endIdx = startIdx + embeddingDim;

    return voiceData.data.slice(startIdx, endIdx);
}

/**
 * Preload multiple voices in parallel
 */
export async function preloadVoices(
    voiceIds: string[],
    cdnBaseUrl: string,
    onProgress?: ProgressCallback
): Promise<Map<string, KokoroVoiceData>> {
    const results = new Map<string, KokoroVoiceData>();
    const total = voiceIds.length;
    let loaded = 0;

    const loadPromises = voiceIds.map(async (voiceId) => {
        try {
            const voiceData = await loadKokoroVoice(voiceId, cdnBaseUrl);
            results.set(voiceId, voiceData);
            loaded++;
            onProgress?.(Math.round((loaded / total) * 100), `Loaded ${loaded}/${total} voices`);
        } catch (error) {
            console.warn(`Failed to load voice ${voiceId}:`, error);
        }
    });

    await Promise.all(loadPromises);
    return results;
}

/**
 * Clear the voice cache
 */
export function clearVoiceCache(): void {
    voiceCache.clear();
}
