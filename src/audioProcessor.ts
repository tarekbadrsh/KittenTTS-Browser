import { AudioResult } from './types';
import { APP_CONFIG } from './config/constants';

export class AudioProcessorClass {
    private readonly SAMPLE_RATE = APP_CONFIG.AUDIO.SAMPLE_RATE;

    processAudioResult(audioData: Float32Array, time: number): AudioResult {
        // Normalization like Python JavaScript version
        let maxAbs = 0;
        for (let i = 0; i < audioData.length; i++) {
            maxAbs = Math.max(maxAbs, Math.abs(audioData[i]));
        }

        if (maxAbs > 1) {
            // Normalize if too loud
            for (let i = 0; i < audioData.length; i++) {
                audioData[i] /= maxAbs;
            }
        } else if (maxAbs < 0.1 && maxAbs > 0) {
            // Amplify if too quiet
            for (let i = 0; i < audioData.length; i++) {
                audioData[i] *= 10;
            }
        }

        return {
            audioData,
            time
        };
    }

    encodeWAV(data: Float32Array, sampleRate: number = this.SAMPLE_RATE): ArrayBuffer {
        const buffer = new ArrayBuffer(44 + data.length * 2);
        const view = new DataView(buffer);

        // RIFF header
        view.setUint8(0, 0x52); // R
        view.setUint8(1, 0x49); // I
        view.setUint8(2, 0x46); // F
        view.setUint8(3, 0x46); // F
        view.setUint32(4, 36 + data.length * 2, true);
        view.setUint8(8, 0x57); // W
        view.setUint8(9, 0x41); // A
        view.setUint8(10, 0x56); // V
        view.setUint8(11, 0x45); // E

        // fmt chunk
        view.setUint8(12, 0x66); // f
        view.setUint8(13, 0x6D); // m
        view.setUint8(14, 0x74); // t
        view.setUint8(15, 0x20); // (space)
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);

        // data chunk
        view.setUint8(36, 0x64); // d
        view.setUint8(37, 0x61); // a
        view.setUint8(38, 0x74); // t
        view.setUint8(39, 0x61); // a
        view.setUint32(40, data.length * 2, true);

        // Convert float32 to 16-bit PCM
        let offset = 44;
        for (let i = 0; i < data.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, data[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return buffer;
    }

    createAudioBlob(audioData: Float32Array): Blob {
        const wavBuffer = this.encodeWAV(audioData);
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    getSampleRate(): number {
        return this.SAMPLE_RATE;
    }
}
