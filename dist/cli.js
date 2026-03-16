#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { VoiceAgent } from './voice-agent.js';
import { loadConfig, createSampleConfig } from './config.js';
import { initializeLogger, LogLevel } from './logger.js';
import { prepareCallContext } from './call-runtime.js';
const program = new Command();
program
    .name('ai-voice-agent')
    .description('AI Voice Agent for SIP calls using OpenAI Realtime API')
    .version('1.0.0')
    .option('--mcp', 'Start MCP server mode over stdio for local MCP clients')
    .option('--mcp-http', 'Start MCP server over HTTP for remote clients')
    .option('--mcp-host <host>', 'Host interface for HTTP MCP server', '0.0.0.0')
    .option('--mcp-port <port>', 'Port for HTTP MCP server', '3001')
    .option('--mcp-token <token>', 'Authentication token embedded in MCP HTTP URL');
program
    .command('call')
    .description('Make a call to a phone number')
    .argument('<number>', 'Phone number to call')
    .option('-c, --config <path>', 'Configuration file path', 'config.json')
    .option('-d, --duration <seconds>', 'Maximum call duration in seconds', '600')
    .option('-v, --verbose', 'Verbose mode - show all debug information')
    .option('-q, --quiet', 'Quiet mode - show only transcripts, errors, and warnings')
    .option('--log-level <level>', 'Set log level (quiet|error|warn|info|debug|verbose)', 'info')
    .option('--no-colors', 'Disable colored output')
    .option('--no-timestamp', 'Disable timestamps in logs')
    .option('--record [filename]', 'Enable stereo call recording (optional filename, defaults to call-recording-TIMESTAMP.wav)')
    .option('--brief <text>', 'Call brief to generate instructions from (e.g., "Call Bocca di Bacco and book a table for 2 at 19:30 for Torben")')
    .option('--instructions <text>', 'Direct instructions for the AI agent (overrides config and brief)')
    .option('--user-name <name>', 'Your name for the AI to use when calling on your behalf')
    .option('--voice <name>', 'Voice to use (auto, alloy, ash, ballad, cedar, coral, echo, marin, sage, shimmer, verse). Default: auto')
    .action(async (number, options) => {
    try {
        // Determine log level from options (default to info mode)
        let logLevel = LogLevel.INFO;
        if (options.verbose) {
            logLevel = LogLevel.VERBOSE;
        }
        else if (options.quiet) {
            logLevel = LogLevel.QUIET;
        }
        else if (options.logLevel) {
            logLevel = options.logLevel;
        }
        // Initialize logger
        const logger = initializeLogger({
            level: logLevel,
            enableColors: !options.noColors,
            enableTimestamp: !options.noTimestamp,
            transcriptOnly: logLevel === LogLevel.QUIET
        });
        logger.info(`Starting AI voice agent call to ${number}...`, "CONFIG");
        const { config } = await prepareCallContext({
            config: options.config,
            instructions: options.instructions,
            brief: options.brief,
            userName: options.userName,
            voice: options.voice,
            envUserName: process.env.USER_NAME,
        }, logger);
        const agent = new VoiceAgent(config, {
            enableCallRecording: options.record !== undefined,
            recordingFilename: options.record === true ? undefined : options.record
        });
        agent.on('sipEvent', (event) => {
            logger.sip.debug(`${event.type}`);
        });
        agent.on('callInitiated', ({ target }) => {
            logger.sip.info(`Call initiated to ${target}`);
        });
        agent.on('callEnded', () => {
            // In quiet mode, show final transcript summary
            if (logLevel === LogLevel.QUIET) {
                const transcript = logger.getFullTranscript();
                if (transcript.length === 0) {
                    logger.info('No conversation recorded.');
                }
            }
            process.exit(0);
        });
        agent.on('error', (error) => {
            logger.error(`Agent error: ${error.message}`);
            process.exit(1);
        });
        await agent.initialize();
        await agent.makeCall({
            targetNumber: number,
            duration: parseInt(options.duration)
        });
        if (options.duration) {
            setTimeout(async () => {
                logger.info(`Call duration reached (${options.duration}s), ending call...`, "CONFIG");
                await agent.endCall();
            }, parseInt(options.duration) * 1000);
        }
        process.on('SIGINT', async () => {
            logger.info('\nReceived SIGINT, shutting down gracefully...', "CONFIG");
            await agent.shutdown();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            logger.info('\nReceived SIGTERM, shutting down gracefully...', "CONFIG");
            await agent.shutdown();
            process.exit(0);
        });
    }
    catch (error) {
        // Initialize basic logger if not already done
        const logger = initializeLogger({ level: LogLevel.ERROR, enableColors: true, enableTimestamp: false });
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
});
program
    .command('status')
    .description('Check agent and connection status')
    .option('-c, --config <path>', 'Configuration file path', 'config.json')
    .action(async (options) => {
    try {
        const logger = initializeLogger({ level: LogLevel.INFO, enableColors: true, enableTimestamp: false });
        const config = loadConfig(options.config);
        const agent = new VoiceAgent(config, {
            enableCallRecording: false // No recording needed for status check
        });
        logger.info('Initializing agent to check status...');
        await agent.initialize();
        const status = agent.getStatus();
        logger.info('\nAgent Status:');
        logger.info(`  SIP Connected: ${status.sipConnected ? '✓' : '✗'}`);
        logger.info(`  AI Connected: ${status.aiConnected ? '✓' : '✗'}`);
        logger.info(`  Audio Bridge: ${status.audioBridgeActive ? '✓' : '✗'}`);
        logger.info(`  Call Active: ${status.callActive ? '✓' : '✗'}`);
        if (status.currentCallId) {
            logger.info(`  Current Call ID: ${status.currentCallId}`);
        }
        await agent.shutdown();
    }
    catch (error) {
        const logger = initializeLogger({ level: LogLevel.ERROR, enableColors: true, enableTimestamp: false });
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
});
program
    .command('init')
    .description('Create a sample configuration file')
    .option('-o, --output <path>', 'Output configuration file path', 'config.json')
    .action((options) => {
    try {
        const logger = initializeLogger({ level: LogLevel.INFO, enableColors: true, enableTimestamp: false });
        createSampleConfig(options.output);
        logger.info('\nPlease edit the configuration file and add your credentials:');
        logger.info(`  - SIP username and password for your Fritz Box`);
        logger.info(`  - OpenAI API key`);
        logger.info(`  - SIP server IP (your Fritz Box IP address)`);
    }
    catch (error) {
        const logger = initializeLogger({ level: LogLevel.ERROR, enableColors: true, enableTimestamp: false });
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
});
program
    .command('test-sip')
    .description('Test SIP connection only')
    .option('-c, --config <path>', 'Configuration file path', 'config.json')
    .action(async (options) => {
    try {
        const config = loadConfig(options.config);
        console.log('Testing SIP connection...');
        const { SIPClient } = await import('./sip-client.js');
        const sipClient = new SIPClient(config.sip, (event) => {
            console.log(`SIP Event: ${event.type}`);
            if (event.type === 'REGISTERED') {
                console.log('✓ SIP registration successful!');
                process.exit(0);
            }
            else if (event.type === 'REGISTER_FAILED') {
                console.error('✗ SIP registration failed');
                console.error(event.message);
                process.exit(1);
            }
        });
        await sipClient.connect();
        setTimeout(() => {
            console.error('✗ SIP connection timeout');
            process.exit(1);
        }, 10000);
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
});
// Check for MCP mode before parsing to avoid Commander.js help display
if (process.argv.includes('--mcp') || process.argv.includes('--mcp-http')) {
    startMCPServerFromArgs();
}
else {
    program.parse();
}
async function startMCPServerFromArgs() {
    const mcpHttpEnabled = process.argv.includes('--mcp-http');
    const mcpStdioEnabled = process.argv.includes('--mcp');
    if (mcpHttpEnabled && mcpStdioEnabled) {
        console.error('Invalid MCP startup flags: use either --mcp (stdio) or --mcp-http (HTTP), not both.');
        process.exit(1);
    }
    const readArgValue = (flag) => {
        const index = process.argv.indexOf(flag);
        if (index === -1 || index + 1 >= process.argv.length) {
            return undefined;
        }
        const value = process.argv[index + 1];
        return value.startsWith('--') ? undefined : value;
    };
    try {
        if (mcpHttpEnabled) {
            const { startMCPHttpServer } = await import('./mcp-server.js');
            const host = readArgValue('--mcp-host') || process.env.MCP_HTTP_HOST || '0.0.0.0';
            const port = parseInt(readArgValue('--mcp-port') || process.env.MCP_HTTP_PORT || '3001', 10);
            const token = readArgValue('--mcp-token') || process.env.MCP_HTTP_TOKEN;
            if (!Number.isFinite(port) || port <= 0 || port > 65535) {
                throw new Error('Invalid --mcp-port value. Must be a valid TCP port between 1 and 65535.');
            }
            await startMCPHttpServer({ host, port, token });
            return;
        }
        const { startMCPServer } = await import('./mcp-server.js');
        await startMCPServer();
    }
    catch (error) {
        console.error('Failed to start MCP server:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}
//# sourceMappingURL=cli.js.map