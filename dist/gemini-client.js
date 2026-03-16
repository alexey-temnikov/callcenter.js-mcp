import WebSocket from "ws";
import { EventEmitter } from "events";
import { getLogger } from "./logger.js";
export class GeminiClient extends EventEmitter {
    ws = null;
    config;
    isConnected = false;
    onAudioCallback;
    onEndCallCallback;
    constructor(config) {
        super();
        this.config = config;
    }
    async connect() {
        if (this.isConnected)
            return;
        const apiKey = this.config.geminiApiKey || this.config.openaiApiKey;
        if (!apiKey) {
            throw new Error("Missing Gemini API key (set ai.geminiApiKey or GEMINI_API_KEY)");
        }
        const model = this.config.model || "models/gemini-2.0-flash-live-001";
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;
        this.ws = new WebSocket(url);
        this.setupWebSocketHandlers(model);
        await new Promise((resolve, reject) => {
            const connectionErrorHandler = (error) => {
                this.disconnect();
                reject(new Error(`Could not connect to Gemini Live API: ${error.message}`));
            };
            this.ws.on("error", connectionErrorHandler);
            this.ws.on("open", () => {
                this.ws.removeListener("error", connectionErrorHandler);
                this.isConnected = true;
                getLogger().ai.debug("Connected to Gemini Live API", "AI");
                resolve();
            });
        });
    }
    setupWebSocketHandlers(model) {
        if (!this.ws)
            return;
        this.ws.on("open", () => {
            this.sendSetup(model);
        });
        this.ws.on("message", (message) => {
            try {
                const event = JSON.parse(message.toString());
                const parts = event?.serverContent?.modelTurn?.parts;
                if (Array.isArray(parts)) {
                    for (const part of parts) {
                        const inlineData = part?.inlineData;
                        if (inlineData?.data && typeof inlineData.data === "string") {
                            const audioBuffer = Buffer.from(inlineData.data, "base64");
                            const audioData = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, Math.floor(audioBuffer.byteLength / 2));
                            this.onAudioCallback?.(audioData, event?.serverContent?.turnId || "gemini");
                        }
                    }
                }
                if (event?.serverContent?.turnComplete) {
                    this.emit("responseGenerated", event?.serverContent?.turnId || "gemini");
                }
            }
            catch (error) {
                getLogger().ai.error("Error parsing Gemini WebSocket message:", error);
            }
        });
        this.ws.on("close", () => {
            this.isConnected = false;
            getLogger().ai.debug("Gemini WebSocket connection closed", "AI");
        });
        this.ws.on("error", (error) => {
            getLogger().ai.error("Gemini WebSocket error:", error);
        });
    }
    sendSetup(model) {
        const setupMessage = {
            setup: {
                model,
                systemInstruction: this.config.instructions
                    ? {
                        parts: [{ text: this.config.instructions }],
                    }
                    : undefined,
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: this.config.voice || "Puck",
                            },
                        },
                    },
                },
            },
        };
        this.ws?.send(JSON.stringify(setupMessage));
    }
    sendAudio(audioData) {
        if (!this.isConnected || !this.ws) {
            getLogger().ai.warn("Cannot send audio: not connected to Gemini");
            return;
        }
        const base64Audio = Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength).toString("base64");
        this.ws.send(JSON.stringify({
            realtimeInput: {
                mediaChunks: [
                    {
                        mimeType: "audio/pcm;rate=24000",
                        data: base64Audio,
                    },
                ],
            },
        }));
    }
    createResponse() {
        // Gemini Live responds continuously from realtime input; explicit response request is unnecessary.
    }
    onAudioReceived(callback) {
        this.onAudioCallback = callback;
    }
    onEndCall(callback) {
        this.onEndCallCallback = callback;
    }
    isReady() {
        return this.isConnected;
    }
    logQueuedTranscript(_responseId) {
        // Transcript queueing is currently OpenAI-specific.
    }
    executePendingEndCall() {
        this.onEndCallCallback?.();
    }
    async disconnect() {
        if (!this.isConnected)
            return;
        this.ws?.close();
        this.ws = null;
        this.isConnected = false;
    }
}
//# sourceMappingURL=gemini-client.js.map