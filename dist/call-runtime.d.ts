import { VoIPLogger } from "./logger.js";
import { Config } from "./types.js";
export interface CallPreparationInput {
    config?: string | Config;
    instructions?: string;
    brief?: string;
    userName?: string;
    voice?: string;
    envUserName?: string;
}
export interface PreparedCallContext {
    config: Config;
    instructions: string;
    voice: string;
    detectedLanguage?: string;
    selectedVoice?: string;
    userName?: string;
}
export declare function resolveRuntimeConfig(configInput: string | Config | undefined, logger?: VoIPLogger): Config;
export declare function prepareCallContext(input: CallPreparationInput, logger: VoIPLogger): Promise<PreparedCallContext>;
//# sourceMappingURL=call-runtime.d.ts.map