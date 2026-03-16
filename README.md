# CallCenter.js MCP + CLI

VoIP calling for coding agents and scripts.

This project bridges a SIP connection to a realtime AI voice provider so an MCP client, CLI, or TypeScript app can place phone calls and handle the conversation.

## Status

This is still a side project. Treat it as experimental.

- It can place real calls.
- It has been tested mainly against Fritz!Box.
- Other SIP profiles are included, but not all combinations are field-tested.

## What You Get

- MCP server for Claude Code and other MCP clients
- CLI for direct outbound calls
- TypeScript API for embedding in other tools
- G.722 + G.711 codec support
- OpenAI Realtime and Gemini Live provider support

## Requirements

- Node.js 20+
- SIP credentials
- One AI provider:
  - OpenAI Realtime: `OPENAI_API_KEY`
  - Gemini Live: `AI_PROVIDER=gemini` and `GEMINI_API_KEY`
- Optional native build tools if you want to rebuild the native codec instead of using the bundled WASM artifact

## Quick Start

Fastest path:

```bash
export SIP_USERNAME="your_extension"
export SIP_PASSWORD="your_password"
export SIP_SERVER_IP="192.168.1.1"
export OPENAI_API_KEY="sk-your-key"

npx github:alexey-temnikov/callcenter.js-mcp call "+1234567890" \
  --brief "Call the restaurant and book a table for 2 at 7 PM" \
  --user-name "Your Name"
```

Gemini Live:

```bash
export SIP_USERNAME="your_extension"
export SIP_PASSWORD="your_password"
export SIP_SERVER_IP="192.168.1.1"
export AI_PROVIDER="gemini"
export GEMINI_API_KEY="your-gemini-key"

npx github:alexey-temnikov/callcenter.js-mcp call "+1234567890" \
  --instructions "Call the restaurant, ask if they are open, and keep the conversation short." \
  --user-name "Your Name"
```

## MCP Setup

For Claude Code:

```bash
claude mcp add \
  --env SIP_USERNAME=your_extension \
  --env SIP_PASSWORD=your_password \
  --env SIP_SERVER_IP=192.168.1.1 \
  --env OPENAI_API_KEY=sk-your-key \
  --env USER_NAME="Your Name" \
  -- callcenter.js npx -- github:alexey-temnikov/callcenter.js-mcp --mcp
```

Then ask Claude to make the call.

## Local Install

```bash
git clone https://github.com/alexey-temnikov/callcenter.js-mcp
cd callcenter.js-mcp
npm install
cp config.example.json config.json
```

Run:

```bash
npm start -- call "+1234567890" --brief "Call and ask about opening hours"
```

## Minimal Config

OpenAI:

```json
{
  "sip": {
    "username": "your_sip_username",
    "password": "your_sip_password",
    "serverIp": "192.168.1.1",
    "serverPort": 5060,
    "localPort": 5060
  },
  "ai": {
    "provider": "openai",
    "openaiApiKey": "sk-your-openai-key",
    "voice": "alloy",
    "instructions": "You are a concise phone assistant.",
    "userName": "Your Name"
  }
}
```

Gemini:

```json
{
  "sip": {
    "username": "your_sip_username",
    "password": "your_sip_password",
    "serverIp": "192.168.1.1",
    "serverPort": 5060,
    "localPort": 5060
  },
  "ai": {
    "provider": "gemini",
    "geminiApiKey": "your-gemini-key",
    "model": "models/gemini-2.0-flash-live-001",
    "voice": "Puck",
    "instructions": "You are a concise phone assistant.",
    "userName": "Your Name"
  }
}
```

Example configs:

- `config.example.json`
- `config.asterisk.example.json`
- `config.cisco.example.json`
- `config.3cx.example.json`
- `config.generic.example.json`

## CLI

Common commands:

```bash
ai-voice-agent call "+1234567890" --brief "Call and ask about pricing" --user-name "Alex"
ai-voice-agent status
ai-voice-agent init
ai-voice-agent test-sip
```

Key options:

- `--brief` generates instructions from a short task description
- `--instructions` bypasses brief generation and uses your prompt directly
- `--voice` selects a voice or `auto`
- `--record [filename]` enables call recording
- `--mcp` starts stdio MCP mode
- `--mcp-http --mcp-token ...` starts HTTP MCP mode

## TypeScript API

```ts
import { makeCall } from "ai-voice-agent";

const result = await makeCall({
  number: "+1234567890",
  brief: "Call the office and ask them to call me back.",
  userName: "Alex",
  config: "config.json",
});

console.log(result.success, result.duration);
```

## Build Notes

- `npm run build` builds the TypeScript output and refreshes the WASM codec
- `npm run build:all` rebuilds native + WASM + TypeScript
- `npm run build:native` rebuilds the native codec addon
- `npm run build:wasm` regenerates the bundled G.722 WASM codec

The project ships a prebuilt G.722 WASM codec so `npx github:...` can work without a compiler. Native rebuilds are optional.

## Docs

- Full API guide: [API.md](./API.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Architecture note: [docs/architecture-callgraph.md](./docs/architecture-callgraph.md)

## Safety

Do not treat this as production telephony software.

- Review prompts before use.
- Use test numbers and non-critical workflows first.
- Expect provider-specific SIP quirks.
