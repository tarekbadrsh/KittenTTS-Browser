import { WorkerMessage, ModelInput, DOMElements } from './types';

export class WorkerManager {
    private worker: Worker | null = null;
    private domElements: DOMElements;

    constructor(domElements: DOMElements) {
        this.domElements = domElements;
    }

    async initialize(): Promise<void> {
        if (!window.Worker) {
            throw new Error("Web Workers are not supported in this browser.");
        }

        this.domElements.statusElement.textContent = 'Initializing worker and loading model (~24MB)...';
        // Use the built worker file in production, or the source file in development
        const workerPath = window.location.hostname === 'localhost' ? '/src/worker.ts' : '/worker.js';
        this.worker = new Worker(workerPath);
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.worker.onerror = (error) => {
            console.error('Worker error:', error);
            this.domElements.statusElement.textContent = 'Worker error: ' + error.message;
        };
    }

    private handleWorkerMessage(e: MessageEvent<WorkerMessage>): void {
        const { type, data } = e.data;

        switch (type) {
            case 'ready':
                this.domElements.statusElement.textContent = 'Ready. Enter text and click Generate.';
                this.domElements.generateButton.disabled = false;
                this.domElements.generateButton.innerHTML = '🎤 Generate Speech';
                break;
            case 'result':
                if (data && typeof data === 'object' && 'audioData' in data && 'time' in data && data.audioData && data.time !== undefined) {
                    this.processAudioResult(data.audioData, data.time);
                }
                break;
            case 'error':
                this.domElements.statusElement.textContent = 'Error: ' + (data as string);
                this.domElements.generateButton.disabled = false;
                this.domElements.generateButton.innerHTML = '🎤 Generate Speech';
                break;
        }
    }

    private processAudioResult(audioData: Float32Array, time: number): void {
        try {
            // Create audio blob and play
            const blob = new Blob([this.encodeWAV(audioData, 24000)], { type: 'audio/wav' });
            const audioURL = URL.createObjectURL(blob);
            this.domElements.audioOutput.src = audioURL;
            this.domElements.audioOutput.play().catch(e => console.log('Autoplay blocked:', e));
            this.domElements.statusElement.textContent = `Speech synthesized in ${time.toFixed(2)} seconds.`;
            this.domElements.generateButton.disabled = false;
            this.domElements.generateButton.innerHTML = '🎤 Generate Speech';
        } catch (error) {
            console.error('Error processing audio:', error);
            this.domElements.statusElement.textContent = 'Error processing audio: ' + (error as Error).message;
            this.domElements.generateButton.disabled = false;
            this.domElements.generateButton.innerHTML = '🎤 Generate Speech';
        }
    }

    private encodeWAV(data: Float32Array, sampleRate: number): ArrayBuffer {
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

    runInference(input: ModelInput): void {
        if (!this.worker) {
            throw new Error('Worker not initialized');
        }

        this.worker.postMessage({
            type: 'run',
            data: input
        }, [input.inputIds.buffer, input.voiceEmbedding.buffer]);
    }

    getWorker(): Worker | null {
        return this.worker;
    }
}
