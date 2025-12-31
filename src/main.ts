import { DOMElements, ModelType, TTSModelAdapter, KokoroQuantization } from './types';
import { createAdapter, getAvailableModels } from './adapters';
import { APP_CONFIG } from './config/constants';

/**
 * Multi-Model TTS Application
 * Supports KittenTTS Nano, Kokoro-82M, and Supertonic TTS
 */
export class TTSApplication {
    private domElements: DOMElements;
    private currentAdapter: TTSModelAdapter | null = null;
    private currentModelType: ModelType = 'kitten';
    private isInitializing: boolean = false;

    constructor() {
        this.domElements = this.getDOMElements();
        this.setupEventListeners();
        this.initialize();
    }

    private getDOMElements(): DOMElements {
        const elements: DOMElements = {
            statusElement: document.getElementById('status') as HTMLElement,
            generateButton: document.getElementById('generateButton') as HTMLButtonElement,
            voiceSelect: document.getElementById('voiceSelect') as HTMLSelectElement,
            textInput: document.getElementById('textInput') as HTMLTextAreaElement,
            audioOutput: document.getElementById('audioOutput') as HTMLAudioElement,
            speedInput: document.getElementById('speedInput') as HTMLInputElement,
            // New multi-model UI elements
            modelSelect: document.getElementById('modelSelect') as HTMLSelectElement,
            quantizationSelect: document.getElementById('quantizationSelect') as HTMLSelectElement,
            inferenceStepsInput: document.getElementById('inferenceSteps') as HTMLInputElement,
            inferenceStepsValue: document.getElementById('inferenceStepsValue') as HTMLSpanElement,
            downloadProgress: document.getElementById('downloadProgress') as HTMLDivElement,
            progressBar: document.getElementById('progressBar') as HTMLDivElement,
            progressText: document.getElementById('progressText') as HTMLSpanElement,
            kokoroOptions: document.getElementById('kokoroOptions') as HTMLDivElement,
            supertonicOptions: document.getElementById('supertonicOptions') as HTMLDivElement,
        };

        // Validate required elements
        if (!elements.statusElement || !elements.generateButton || !elements.voiceSelect ||
            !elements.textInput || !elements.audioOutput || !elements.speedInput) {
            throw new Error('Required DOM elements not found');
        }

        return elements;
    }

    private setupEventListeners(): void {
        // Generate button
        this.domElements.generateButton.addEventListener('click', () => this.handleGenerateClick());

        // Model selection
        this.domElements.modelSelect?.addEventListener('change', () => this.handleModelChange());

        // Inference steps slider update
        this.domElements.inferenceStepsInput?.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            if (this.domElements.inferenceStepsValue) {
                this.domElements.inferenceStepsValue.textContent = value;
            }
        });
    }

    private async initialize(): Promise<void> {
        try {
            await this.loadModel(this.currentModelType);
        } catch (error) {
            console.error('Initialization failed:', error);
            this.domElements.statusElement.textContent = 'Error: ' + (error as Error).message;
        }
    }

    private async loadModel(modelType: ModelType): Promise<void> {
        if (this.isInitializing) {
            console.log('Already initializing a model, please wait...');
            return;
        }

        this.isInitializing = true;
        this.domElements.generateButton.disabled = true;
        this.setButtonLoading(true, 'Loading...');

        try {
            // Dispose previous adapter if exists
            if (this.currentAdapter) {
                this.currentAdapter.dispose();
                this.currentAdapter = null;
            }

            // Show progress indicator
            this.showProgress(true);

            // Create new adapter
            this.currentAdapter = await createAdapter(modelType);
            this.currentModelType = modelType;

            // Initialize adapter with progress callback
            await this.currentAdapter.initialize((percent, message) => {
                this.updateProgress(percent, message || 'Loading...');
            });

            // Hide progress indicator
            this.showProgress(false);

            // Populate voices for this model
            this.populateVoices();

            // Update UI state
            this.domElements.statusElement.textContent = 'Ready. Enter text and click Generate.';
            this.domElements.generateButton.disabled = false;
            this.setButtonLoading(false, 'Generate Speech');

        } catch (error) {
            console.error('Model loading failed:', error);
            this.showProgress(false);
            this.domElements.statusElement.textContent = 'Error loading model: ' + (error as Error).message;
            this.domElements.generateButton.disabled = true;
            this.setButtonLoading(false, 'Generate Speech');
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Set button state with loading spinner or ready state
     */
    private setButtonLoading(loading: boolean, text: string): void {
        const button = this.domElements.generateButton;
        // Clear existing content
        while (button.firstChild) {
            button.removeChild(button.firstChild);
        }

        if (loading) {
            const spinner = document.createElement('span');
            spinner.className = 'loading';
            button.appendChild(spinner);
            button.appendChild(document.createTextNode(text));
        } else {
            button.textContent = '🎤 ' + text;
        }
    }

    private handleModelChange(): void {
        const selectedModel = this.domElements.modelSelect?.value as ModelType;
        if (!selectedModel || selectedModel === this.currentModelType) {
            return;
        }

        // Update UI to show/hide model-specific options
        this.updateModelOptions(selectedModel);

        // Load the new model
        this.loadModel(selectedModel);
    }

    private updateModelOptions(modelType: ModelType): void {
        // Hide all model-specific options
        if (this.domElements.kokoroOptions) {
            this.domElements.kokoroOptions.style.display = 'none';
        }
        if (this.domElements.supertonicOptions) {
            this.domElements.supertonicOptions.style.display = 'none';
        }

        // Show options for selected model
        switch (modelType) {
            case 'kokoro':
                if (this.domElements.kokoroOptions) {
                    this.domElements.kokoroOptions.style.display = 'block';
                }
                break;
            case 'supertonic':
                if (this.domElements.supertonicOptions) {
                    this.domElements.supertonicOptions.style.display = 'block';
                }
                break;
        }
    }

    private populateVoices(): void {
        if (!this.currentAdapter) return;

        const voices = this.currentAdapter.getVoices();
        const select = this.domElements.voiceSelect;

        // Clear existing options using DOM methods
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }

        // Add voice options
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.id;
            option.textContent = voice.name;
            select.appendChild(option);
        });

        // Select first voice by default
        if (voices.length > 0) {
            select.value = voices[0].id;
        }
    }

    private showProgress(show: boolean): void {
        if (this.domElements.downloadProgress) {
            this.domElements.downloadProgress.style.display = show ? 'block' : 'none';
        }
    }

    private updateProgress(percent: number, message: string): void {
        if (this.domElements.progressBar) {
            this.domElements.progressBar.style.width = `${percent}%`;
        }
        if (this.domElements.progressText) {
            this.domElements.progressText.textContent = message;
        }
        this.domElements.statusElement.textContent = message;
    }

    private async handleGenerateClick(): Promise<void> {
        if (!this.currentAdapter || !this.currentAdapter.isReady()) {
            this.domElements.statusElement.textContent = 'Model not ready. Please wait...';
            return;
        }

        const text = this.domElements.textInput.value.trim();
        const selectedVoice = this.domElements.voiceSelect.value;
        const speed = parseFloat(this.domElements.speedInput.value) || APP_CONFIG.AUDIO.DEFAULT_SPEED;

        if (!text) {
            this.domElements.statusElement.textContent = 'Please enter some text.';
            return;
        }

        if (!selectedVoice) {
            this.domElements.statusElement.textContent = 'Please select a voice.';
            return;
        }

        this.domElements.statusElement.textContent = 'Synthesizing speech...';
        this.domElements.generateButton.disabled = true;
        this.setButtonLoading(true, 'Generating...');
        this.domElements.audioOutput.src = '';

        try {
            // Build inference options based on model type
            const options: {
                quantization?: KokoroQuantization;
                numInferenceSteps?: number;
            } = {};

            if (this.currentModelType === 'kokoro' && this.domElements.quantizationSelect) {
                options.quantization = this.domElements.quantizationSelect.value as KokoroQuantization;
            }

            if (this.currentModelType === 'supertonic' && this.domElements.inferenceStepsInput) {
                options.numInferenceSteps = parseInt(this.domElements.inferenceStepsInput.value, 10);
            }

            // Run synthesis through adapter
            const result = await this.currentAdapter.synthesize({
                text,
                voiceId: selectedVoice,
                speed,
                options,
            });

            // Create audio blob and play
            const wavBuffer = this.encodeWAV(result.audioData, result.sampleRate);
            const blob = new Blob([wavBuffer], { type: 'audio/wav' });
            const audioURL = URL.createObjectURL(blob);

            this.domElements.audioOutput.src = audioURL;
            this.domElements.audioOutput.play().catch(e => console.log('Autoplay blocked:', e));

            const inferenceSeconds = (result.inferenceTimeMs / 1000).toFixed(2);
            this.domElements.statusElement.textContent = `Speech synthesized in ${inferenceSeconds} seconds.`;

        } catch (error) {
            console.error('Synthesis error:', error);
            this.domElements.statusElement.textContent = 'Error: ' + (error as Error).message;
        } finally {
            this.domElements.generateButton.disabled = false;
            this.setButtonLoading(false, 'Generate Speech');
        }
    }

    /**
     * Encode Float32Array audio data to WAV format
     */
    private encodeWAV(data: Float32Array, sampleRate: number): ArrayBuffer {
        const buffer = new ArrayBuffer(44 + data.length * 2);
        const view = new DataView(buffer);

        // RIFF header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + data.length * 2, true);
        this.writeString(view, 8, 'WAVE');

        // fmt chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // Byte rate
        view.setUint16(32, 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample

        // data chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, data.length * 2, true);

        // Convert float32 to 16-bit PCM
        let offset = 44;
        for (let i = 0; i < data.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, data[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return buffer;
    }

    private writeString(view: DataView, offset: number, string: string): void {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TTSApplication();
});
