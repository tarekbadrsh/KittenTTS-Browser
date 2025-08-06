// Application constants and configuration
export const APP_CONFIG = {
    // Audio settings
    AUDIO: {
        SAMPLE_RATE: 24000,
        DEFAULT_SPEED: 1.2,
        MIN_SPEED: 0.5,
        MAX_SPEED: 3.0,
        SPEED_STEP: 0.1,
    },

    // Model settings
    MODEL: {
        PATH: '/kitten_tts_nano_v0_1.onnx',
        SIZE_MB: 24,
        BACKENDS: [
            { providers: ['webgl', 'wasm'], name: 'WebGL+WASM' },
            { providers: ['webnn', 'webgl', 'wasm'], name: 'WebNN+WebGL+WASM' },
            { providers: ['wasm'], name: 'WASM' }
        ],
    },

    // Voice settings
    VOICE: {
        FILE_PATH: '/voices.npz',
        FILE_EXTENSION: '.npy',
    },

    // Text processing
    TEXT: {
        PAD_TOKEN: '$',
        UNKNOWN_TOKEN: 0,
        START_TOKEN: 0,
        END_TOKEN: 0,
        PUNCTUATION: ';:,.!?¡¿—…"«»"" ',
        LETTERS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
        LETTERS_IPA: "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ",
    },

    // UI settings
    UI: {
        LOADING_TIMEOUT_MS: 30000,
        ANIMATION_DURATION_MS: 300,
        DEBOUNCE_DELAY_MS: 300,
    },

    // Server settings
    SERVER: {
        PORT: 8000,
        CORS_HEADERS: {
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    },
} as const;
