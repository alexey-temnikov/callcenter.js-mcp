import { EventEmitter } from "events";
import { AIVoiceConfig } from "./types.js";
export declare class GeminiClient extends EventEmitter {
    private ws;
    private config;
    private isConnected;
    private onAudioCallback?;
    private onEndCallCallback?;
    constructor(config: AIVoiceConfig);
    connect(): Promise<void>;
    private setupWebSocketHandlers;
    private sendSetup;
    sendAudio(audioData: Int16Array): void;
    createResponse(): void;
    onAudioReceived(callback: (audio: Int16Array, responseId?: string) => void): void;
    onEndCall(callback: () => void): void;
    isReady(): boolean;
    logQueuedTranscript(_responseId: string): void;
    executePendingEndCall(): void;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=gemini-client.d.ts.map