/**
 * AI Voice Agent Library
 * 
 * A high-level library for making AI-powered phone calls with simple, well-crafted entry points.
 * Supports configuration via file path or object, with brief or instruction-based call control.
 */

import { VoiceAgent } from './voice-agent.js';
import { loadConfig } from './config.js';
import { Config, CallConfig } from './types.js';
import { initializeLogger, LogLevel, getLogger } from './logger.js';
import { prepareCallContext, resolveRuntimeConfig } from './call-runtime.js';

export interface CallOptions {
  /** Phone number to call */
  number: string;
  
  /** Call duration in seconds (optional, defaults to no limit) */
  duration?: number;
  
  /** Configuration - either file path or config object */
  config?: string | Config;
  
  /** Direct instructions for the AI agent (highest priority) */
  instructions?: string;
  
  /** Call brief to generate instructions from (if instructions not provided) */
  brief?: string;
  
  /** Your name for the AI to use when calling on your behalf */
  userName?: string;
  
  /** Voice to use ('auto' for AI selection, or specific voice name) */
  voice?: string;
  
  /** Enable call recording with optional filename */
  recording?: boolean | string;
  
  /** Log level for the call */
  logLevel?: 'quiet' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  
  /** Enable colored output */
  colors?: boolean;
  
  /** Enable timestamps in logs */
  timestamps?: boolean;

  /** Route all runtime logs to stderr to protect stdout protocols like MCP stdio */
  forceStderr?: boolean;
}

export interface CallResult {
  /** Call ID if successful */
  callId?: string;
  
  /** Call duration in seconds */
  duration: number;
  
  /** Full transcript if available */
  transcript?: string;
  
  /** Whether call was successful */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
}

/**
 * Make a phone call with AI agent
 * 
 * @example
 * ```typescript
 * import { makeCall } from 'ai-voice-agent';
 * 
 * // Simple call with brief
 * const result = await makeCall({
 *   number: '+1234567890',
 *   brief: 'Call Bocca di Bacco and book a table for 2 at 19:30 for Torben',
 *   userName: 'Torben',
 *   config: 'config.json'
 * });
 * 
 * // Call with direct instructions
 * const result = await makeCall({
 *   number: '+1234567890', 
 *   instructions: 'You are calling to book a restaurant reservation...',
 *   config: myConfigObject
 * });
 * ```
 */
export async function makeCall(options: CallOptions): Promise<CallResult> {
  const startTime = Date.now();
  
  try {
    // Initialize logger
    const logLevel = options.logLevel === 'quiet' ? LogLevel.QUIET : 
                    options.logLevel === 'error' ? LogLevel.ERROR :
                    options.logLevel === 'warn' ? LogLevel.WARN :
                    options.logLevel === 'info' ? LogLevel.INFO :
                    options.logLevel === 'debug' ? LogLevel.DEBUG :
                    options.logLevel === 'verbose' ? LogLevel.VERBOSE :
                    LogLevel.QUIET; // Default to quiet mode
                    
    const logger = initializeLogger({
      level: logLevel,
      enableColors: options.colors ?? true,
      enableTimestamp: options.timestamps ?? false,
      transcriptOnly: logLevel === LogLevel.QUIET,
      forceStderr: options.forceStderr ?? false
    });

    logger.info(`Starting AI voice agent call to ${options.number}...`, 'CONFIG');
    
    const { config } = await prepareCallContext(
      {
        config: options.config,
        instructions: options.instructions,
        brief: options.brief,
        userName: options.userName,
        voice: options.voice,
      },
      logger
    );

    // Create and initialize voice agent
    const agent = new VoiceAgent(config, { 
      enableCallRecording: options.recording !== undefined,
      recordingFilename: typeof options.recording === 'string' ? options.recording : undefined
    });

    // Set up event handlers
    let callId: string | undefined;
    let callEnded = false;
    
    return new Promise<CallResult>((resolve, reject) => {
      const cleanup = async () => {
        try {
          await agent.shutdown();
        } catch (error) {
          logger.error('Error during cleanup:', error instanceof Error ? error.message : String(error), 'CONFIG');
        }
      };

      agent.on('callInitiated', ({ callId: id, target }) => {
        callId = id;
        logger.info(`Call initiated to ${target}`, 'SIP');
      });

      agent.on('callEnded', async () => {
        if (callEnded) return;
        callEnded = true;
        
        logger.info('Call ended', 'SIP');
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        // Get transcript if in quiet mode
        const transcriptArray = logLevel === LogLevel.QUIET ? logger.getFullTranscript() : undefined;
        const transcript = transcriptArray ? transcriptArray.join('\n') : undefined;
        
        await cleanup();
        resolve({
          callId,
          duration,
          transcript,
          success: true
        });
      });

      agent.on('error', async (error) => {
        if (callEnded) return;
        callEnded = true;
        
        logger.error(`Agent error: ${error.message}`, 'CONFIG');
        await cleanup();
        reject(new Error(`Call failed: ${error.message}`));
      });

      // Initialize and start call
      (async () => {
        try {
          await agent.initialize();
          
          await agent.makeCall({
            targetNumber: options.number,
            duration: options.duration
          });

          // Set duration timeout if specified
          if (options.duration) {
            setTimeout(async () => {
              if (!callEnded) {
                logger.info(`Call duration reached (${options.duration}s), ending call...`, 'CONFIG');
                await agent.endCall();
              }
            }, options.duration * 1000);
          }

        } catch (error) {
          if (callEnded) return;
          callEnded = true;
          await cleanup();
          reject(error);
        }
      })();
    });

  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    return {
      duration,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a VoiceAgent instance for more advanced use cases
 * 
 * @example
 * ```typescript
 * import { createAgent } from 'ai-voice-agent';
 * 
 * const agent = await createAgent('config.json');
 * 
 * agent.on('callEnded', () => {
 *   console.log('Call finished!');
 * });
 * 
 * await agent.makeCall({ targetNumber: '+1234567890' });
 * ```
 */
export async function createAgent(config: string | Config, options?: {
  enableCallRecording?: boolean;
  recordingFilename?: string;
}): Promise<VoiceAgent> {
  const resolvedConfig = resolveRuntimeConfig(config);
  const agent = new VoiceAgent(resolvedConfig, options);
  await agent.initialize();
  
  return agent;
}

// Main components (for advanced usage)
export { VoiceAgent } from './voice-agent.js';
export { SIPClient } from './sip-client.js';
export { OpenAIClient } from './openai-client.js';
export { GeminiClient } from './gemini-client.js';
export { AudioBridge } from './audio-bridge.js';

// Configuration utilities
export { loadConfig, createSampleConfig, loadConfigFromEnv } from './config.js';

// Call brief processing
export { CallBriefProcessor, CallBriefError } from './call-brief-processor.js';

// Codec system
export * from './codecs/index.js';

// Types and interfaces
export * from './types.js';

// Logging
export { LogLevel } from './logger.js';

// Performance monitoring
export { PerformanceMonitor } from './performance-monitor.js';

// Re-export everything for convenience
export * as Codecs from './codecs/index.js';
