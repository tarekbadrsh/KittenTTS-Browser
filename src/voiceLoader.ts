import { VoiceData, NPYData } from './types';
import JSZip from 'jszip';
import { APP_CONFIG } from './config/constants';

export class VoiceLoader {
    private voices: VoiceData = {};

    async loadVoices(): Promise<VoiceData> {
        const response = await fetch(APP_CONFIG.VOICE.FILE_PATH);
        const buffer = await response.arrayBuffer();

        const zip = await JSZip.loadAsync(buffer);

        for (const filename in zip.files) {
            if (filename.endsWith(APP_CONFIG.VOICE.FILE_EXTENSION)) {
                const npyBuffer = await zip.files[filename].async('arraybuffer');
                const voiceName = filename.replace(APP_CONFIG.VOICE.FILE_EXTENSION, '');
                const parsed = this.parseNPY(npyBuffer);
                this.voices[voiceName] = parsed.data;
                console.log(`Loaded voice: ${voiceName}, shape: ${parsed.shape}`);
            }
        }

        if (Object.keys(this.voices).length === 0) {
            throw new Error('No voices loaded from NPZ file');
        }

        return this.voices;
    }

    private parseNPY(buffer: ArrayBuffer): NPYData {
        const magicBytes = new Uint8Array(buffer.slice(0, 6));
        const expectedMagic = new Uint8Array([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]);
        let magicMatch = true;

        for (let i = 0; i < 6; i++) {
            if (magicBytes[i] !== expectedMagic[i]) {
                magicMatch = false;
                break;
            }
        }

        if (!magicMatch) {
            throw new Error('Invalid NPY file');
        }

        const version = new Uint8Array(buffer.slice(6, 8));
        const headerLength = new DataView(buffer.slice(8, 10)).getUint16(0, true);
        const headerStr = new TextDecoder().decode(new Uint8Array(buffer.slice(10, 10 + headerLength)));

        // Parse header
        const dtypeMatch = headerStr.match(/'descr':\s*'([^']+)'/);
        const shapeMatch = headerStr.match(/'shape':\s*\(([^)]*)\)/);
        const dtype = dtypeMatch ? dtypeMatch[1] : 'float32';
        const shapeStr = shapeMatch ? shapeMatch[1] : '1';
        const shape = shapeStr.split(',').map(s => {
            const trimmed = s.trim();
            return trimmed ? parseInt(trimmed) : 1;
        }).filter(n => !isNaN(n));

        const dataOffset = 10 + headerLength;
        const dataView = new DataView(buffer.slice(dataOffset));
        const numElements = dataView.byteLength / 4;
        const data = new Float32Array(numElements);
        const isLittleEndian = dtype.startsWith('<') || dtype === 'float32';

        for (let i = 0; i < numElements; i++) {
            data[i] = dataView.getFloat32(i * 4, isLittleEndian);
        }

        return { data, shape };
    }

    getVoices(): VoiceData {
        return this.voices;
    }

    populateVoiceSelector(voiceSelect: HTMLSelectElement): void {
        voiceSelect.innerHTML = '';
        Object.keys(this.voices).sort().forEach(voiceName => {
            const option = document.createElement('option');
            option.value = voiceName;
            option.textContent = voiceName;
            voiceSelect.appendChild(option);
        });
    }
}
