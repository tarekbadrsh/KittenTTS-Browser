import { DOMElements, VoiceData, ModelInput } from './types';
import { TextProcessor } from './textProcessor';
import { VoiceLoader } from './voiceLoader';
import { AudioProcessorClass } from './audioProcessor';
import { WorkerManager } from './workerManager';
import { APP_CONFIG } from './config/constants';

export class TTSApplication {
    private domElements: DOMElements;
    private textProcessor: TextProcessor;
    private voiceLoader: VoiceLoader;
    private audioProcessor: AudioProcessorClass;
    private workerManager: WorkerManager;
    private voices: VoiceData = {};

    constructor() {
        this.domElements = this.getDOMElements();
        this.textProcessor = new TextProcessor();
        this.voiceLoader = new VoiceLoader();
        this.audioProcessor = new AudioProcessorClass();
        this.workerManager = new WorkerManager(this.domElements);

        this.initialize();
    }

    private getDOMElements(): DOMElements {
        const statusElement = document.getElementById('status') as HTMLElement;
        const generateButton = document.getElementById('generateButton') as HTMLButtonElement;
        const voiceSelect = document.getElementById('voiceSelect') as HTMLSelectElement;
        const textInput = document.getElementById('textInput') as HTMLTextAreaElement;
        const audioOutput = document.getElementById('audioOutput') as HTMLAudioElement;
        const speedInput = document.getElementById('speedInput') as HTMLInputElement;

        if (!statusElement || !generateButton || !voiceSelect || !textInput || !audioOutput || !speedInput) {
            throw new Error('Required DOM elements not found');
        }

        return {
            statusElement,
            generateButton,
            voiceSelect,
            textInput,
            audioOutput,
            speedInput
        };
    }

    private async initialize(): Promise<void> {
        try {
            // Initialize text processor
            this.domElements.statusElement.textContent = 'Loading phonemizer...';
            await this.textProcessor.initialize();

            // Load voices
            this.domElements.statusElement.textContent = 'Loading voices...';
            this.voices = await this.voiceLoader.loadVoices();
            this.voiceLoader.populateVoiceSelector(this.domElements.voiceSelect);

            // Initialize worker
            await this.workerManager.initialize();

            // Set up event listeners
            this.setupEventListeners();

        } catch (error) {
            console.error('Initialization failed:', error);
            this.domElements.statusElement.textContent = 'Error during initialization: ' + (error as Error).message;
        }
    }

    private setupEventListeners(): void {
        this.domElements.generateButton.addEventListener('click', this.handleGenerateClick.bind(this));
    }

    private async handleGenerateClick(): Promise<void> {
        const text = this.domElements.textInput.value.trim();
        const selectedVoice = this.domElements.voiceSelect.value;
        const speed = parseFloat(this.domElements.speedInput.value) || APP_CONFIG.AUDIO.DEFAULT_SPEED;

        if (!text || !selectedVoice || !this.voices[selectedVoice]) {
            this.domElements.statusElement.textContent = 'Please ensure text and voice are selected.';
            return;
        }

        this.domElements.statusElement.textContent = 'Synthesizing speech...';
        this.domElements.generateButton.disabled = true;
        this.domElements.generateButton.innerHTML = '<span class="loading"></span>Generating...';
        this.domElements.audioOutput.src = '';

        try {
            // Tokenize text
            const tokens = await this.textProcessor.tokenize(text);
            console.log('Tokens:', tokens);

            const inputIds = new BigInt64Array(tokens.map(t => BigInt(t)));
            const voiceEmbedding = new Float32Array(this.voices[selectedVoice]);

            const modelInput: ModelInput = {
                inputIds,
                voiceEmbedding,
                speed
            };

            this.workerManager.runInference(modelInput);

        } catch (error) {
            console.error('Error preparing inputs:', error);
            this.domElements.statusElement.textContent = 'Error: ' + (error as Error).message;
            this.domElements.generateButton.disabled = false;
            this.domElements.generateButton.innerHTML = '🎤 Generate Speech';
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TTSApplication();
});
