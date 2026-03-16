import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareCallContext, resolveRuntimeConfig } from "../src/call-runtime.js";
import { loadConfig, normalizeConfigShape } from "../src/config.js";
import { initializeLogger, LogLevel } from "../src/logger.js";

const ENV_KEYS = [
  "AI_PROVIDER",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_VOICE",
  "GEMINI_VOICE",
  "OPENAI_INSTRUCTIONS",
  "AI_INSTRUCTIONS",
  "SIP_USERNAME",
  "SIP_PASSWORD",
  "SIP_SERVER_IP",
  "SIP_SERVER_PORT",
  "SIP_LOCAL_PORT",
] as const;

describe("config/runtime modernization", () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("normalizes flat legacy config into nested sip/openai shape", () => {
    const config = normalizeConfigShape({
      username: "alice",
      password: "secret",
      serverIp: "192.168.1.1",
      serverPort: 5060,
      localPort: 5062,
      openai: {
        apiKey: "sk-legacy",
        voice: "alloy",
      },
    });

    expect(config.sip.username).toBe("alice");
    expect(config.sip.localPort).toBe(5062);
    expect(config.openai?.openaiApiKey).toBe("sk-legacy");
    expect(config.openai?.voice).toBe("alloy");
  });

  it("surfaces schema validation errors with field context", () => {
    const tempPath = path.join(
      os.tmpdir(),
      `voip-mcp-invalid-${Date.now()}.json`
    );

    fs.writeFileSync(
      tempPath,
      JSON.stringify({
        sip: {
          username: "",
          password: "secret",
          serverIp: "192.168.1.1",
          serverPort: 5060,
          localPort: 5060,
        },
        ai: {
          openaiApiKey: "sk-test",
        },
      })
    );

    try {
      expect(() => loadConfig(tempPath)).toThrow("Missing SIP username (sip.username)");
    } finally {
      fs.unlinkSync(tempPath);
    }
  });

  it("accepts gemini env config for direct-instruction calls", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.SIP_USERNAME = "alice";
    process.env.SIP_PASSWORD = "secret";
    process.env.SIP_SERVER_IP = "192.168.1.1";

    const logger = initializeLogger({
      level: LogLevel.ERROR,
      enableColors: false,
      enableTimestamp: false,
    });

    const result = await prepareCallContext(
      {
        instructions: "Call and say hello.",
        userName: "Alice",
      },
      logger
    );

    expect(result.config.ai?.provider).toBe("gemini");
    expect(result.config.ai?.geminiApiKey).toBe("gemini-test-key");
    expect(result.instructions).toBe("Call and say hello.");
  });

  it("rejects gemini brief generation without an OpenAI key", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.SIP_USERNAME = "alice";
    process.env.SIP_PASSWORD = "secret";
    process.env.SIP_SERVER_IP = "192.168.1.1";

    const logger = initializeLogger({
      level: LogLevel.ERROR,
      enableColors: false,
      enableTimestamp: false,
    });

    await expect(
      prepareCallContext(
        {
          brief: "Call the office and ask for a callback.",
          userName: "Alice",
        },
        logger
      )
    ).rejects.toThrow("Call brief processing requires an OpenAI API key.");
  });

  it("resolves gemini env config without requiring a config file", () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.SIP_USERNAME = "alice";
    process.env.SIP_PASSWORD = "secret";
    process.env.SIP_SERVER_IP = "192.168.1.1";

    const config = resolveRuntimeConfig(undefined);

    expect(config.ai?.provider).toBe("gemini");
    expect(config.ai?.geminiApiKey).toBe("gemini-test-key");
    expect(config.sip.serverPort).toBe(5060);
  });
});
