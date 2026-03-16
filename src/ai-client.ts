import { EventEmitter } from "events";

export interface AIClient extends EventEmitter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendAudio(audioData: Int16Array): void;
  createResponse(): void;
  onAudioReceived(callback: (audio: Int16Array, responseId?: string) => void): void;
  onEndCall(callback: () => void): void;
  isReady(): boolean;
  logQueuedTranscript(responseId: string): void;
  executePendingEndCall(): void;
}
