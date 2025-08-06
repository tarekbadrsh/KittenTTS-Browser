declare module 'espeak-ng' {
    interface ESpeakOptions {
        voice?: string;
        ipa?: boolean;
        phonemes?: boolean;
    }

    interface ESpeakResult {
        phonemes: string;
    }

    interface ESpeakNg {
        speak(text: string, options?: ESpeakOptions): Promise<ESpeakResult>;
    }

    function ESpeakNg(): Promise<ESpeakNg>;
    export = ESpeakNg;
}

declare module 'https://unpkg.com/espeak-ng@1.0.2' {
    interface ESpeakOptions {
        arguments: string[];
    }

    interface ESpeakResult {
        FS: {
            readFile(path: string, options: { encoding: string }): string;
        };
    }

    function ESpeakNg(options: ESpeakOptions): Promise<ESpeakResult>;
    export = ESpeakNg;
}
