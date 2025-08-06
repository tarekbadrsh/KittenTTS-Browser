import { TextCleaner, Tokenizer, Phonemizer } from './types';
import { APP_CONFIG } from './config/constants';

export class TextProcessor {
    private textCleaner: TextCleaner;
    private espeak: any;  // Will hold the initialized ESpeakNg instance

    constructor() {
        this.textCleaner = this.createTextCleaner();
    }

    async initialize(): Promise<void> {
        console.log('TextProcessor initializing phonemizer...');
        // Load eSpeak-ng from CDN (browser-compatible)
        this.espeak = (await import('https://unpkg.com/espeak-ng@1.0.2')).default;
        console.log('eSpeak-ng loaded');
    }

    private createTextCleaner(): TextCleaner {
        const pad = APP_CONFIG.TEXT.PAD_TOKEN;
        const punctuation = APP_CONFIG.TEXT.PUNCTUATION;
        const letters = APP_CONFIG.TEXT.LETTERS;
        const lettersIpa = APP_CONFIG.TEXT.LETTERS_IPA;
        const symbols = [pad, ...punctuation.split(''), ...letters.split(''), ...lettersIpa.split('')];
        const dict: { [key: string]: number } = {};
        symbols.forEach((sym, i) => { dict[sym] = i; });

        return function (text: string): number[] {
            const indexes: number[] = [];
            for (const char of text) {
                if (dict[char] !== undefined) {
                    indexes.push(dict[char]);
                }
                // Skip unknown characters (like Python version)
            }
            return indexes;
        };
    }

    private createPhonemeMap(): Map<string, string> {
        const map = new Map<string, string>();
        // Basic English phoneme mapping
        const phonemeRules = [
            { pattern: /th/gi, replacement: 'θ' },
            { pattern: /sh/gi, replacement: 'ʃ' },
            { pattern: /ch/gi, replacement: 'tʃ' },
            { pattern: /ng/gi, replacement: 'ŋ' },
            { pattern: /ph/gi, replacement: 'f' },
            { pattern: /wh/gi, replacement: 'w' },
            { pattern: /qu/gi, replacement: 'kw' },
            { pattern: /ai/gi, replacement: 'aɪ' },
            { pattern: /ay/gi, replacement: 'aɪ' },
            { pattern: /ee/gi, replacement: 'iː' },
            { pattern: /ea/gi, replacement: 'iː' },
            { pattern: /oo/gi, replacement: 'uː' },
            { pattern: /oa/gi, replacement: 'oʊ' },
            { pattern: /oi/gi, replacement: 'ɔɪ' },
            { pattern: /oy/gi, replacement: 'ɔɪ' },
            { pattern: /ou/gi, replacement: 'aʊ' },
            { pattern: /ow/gi, replacement: 'oʊ' },
            { pattern: /ar/gi, replacement: 'ɑː' },
            { pattern: /er/gi, replacement: 'ɜː' },
            { pattern: /ir/gi, replacement: 'ɜː' },
            { pattern: /ur/gi, replacement: 'ɜː' },
            { pattern: /or/gi, replacement: 'ɔː' },
        ];

        phonemeRules.forEach(rule => {
            map.set(rule.pattern.source, rule.replacement);
        });

        return map;
    }

    private basicEnglishTokenize(text: string): string[] {
        return text.match(/\w+|[^\w\s]/g) || [];
    }

    async phonemize(text: string): Promise<string> {
        if (!this.espeak) {
            throw new Error('eSpeak-ng not initialized');
        }
        // Use eSpeak-ng with settings that match Python phonemizer
        // preserve_punctuation=True, with_stress=True equivalent
        const result = await this.espeak({
            arguments: [
                "--phonout", "generated",
                '--sep=""',
                "-q",
                "-b=1",
                "--ipa=3",
                "-v", "en-us",
                `"${text}"`,
            ],
        });
        const phonemes = result.FS.readFile("generated", { encoding: "utf8" });
        return phonemes.trim(); // Trim any extra newlines
    }

    async tokenize(text: string): Promise<number[]> {
        const phonemesStr = await this.phonemize(text);
        const phonemes = this.basicEnglishTokenize(phonemesStr);
        const cleaned = this.textCleaner(phonemes.join(''));
        cleaned.unshift(0); // <s>
        cleaned.push(0); // </s>
        return cleaned;
    }

    getTextCleaner(): TextCleaner {
        return this.textCleaner;
    }
}
