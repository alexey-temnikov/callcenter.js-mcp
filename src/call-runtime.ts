import { CallBriefError, CallBriefProcessor } from "./call-brief-processor.js";
import { loadConfig, loadConfigFromEnv, normalizeConfigShape } from "./config.js";
import { isValidLanguageCode } from "./language-utils.js";
import { VoIPLogger } from "./logger.js";
import { AIVoiceConfig, Config, LegacyOpenAIConfig } from "./types.js";
import { sanitizeVoiceName } from "./voice-characteristics.js";

type RuntimeAIConfig = AIVoiceConfig | LegacyOpenAIConfig;

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

function isLegacyOpenAIConfig(
  aiConfig: RuntimeAIConfig
): aiConfig is LegacyOpenAIConfig {
  return "apiKey" in aiConfig;
}

export function resolveRuntimeConfig(
  configInput: string | Config | undefined,
  logger?: VoIPLogger
): Config {
  if (typeof configInput === "string") {
    try {
      return loadConfig(configInput);
    } catch (error) {
      logger?.warn(
        "Failed to load config file, trying environment variables...",
        "CONFIG"
      );
      return loadConfigFromEnvironment();
    }
  }

  if (configInput) {
    return normalizeConfigShape(configInput);
  }

  return loadConfigFromEnvironment();
}

export async function prepareCallContext(
  input: CallPreparationInput,
  logger: VoIPLogger
): Promise<PreparedCallContext> {
  const config = resolveRuntimeConfig(input.config, logger);
  const aiConfig = getAIConfig(config);

  if (!aiConfig) {
    throw new Error("AI configuration is required (either ai or openai section)");
  }

  const effectiveUserName =
    input.userName ?? input.envUserName ?? aiConfig.userName;

  const requestedVoice = input.voice ?? aiConfig.voice ?? "auto";
  const validatedVoice = sanitizeVoiceName(requestedVoice);

  if (!validatedVoice) {
    logger.warn(
      `Invalid voice '${requestedVoice}', defaulting to auto selection`,
      "CONFIG"
    );
  }

  const voiceToUse = validatedVoice ?? "auto";
  logger.info(`Using voice mode: ${voiceToUse}`, "CONFIG");

  let finalInstructions: string | undefined;
  let detectedLanguage: string | undefined;
  let selectedVoice: string | undefined;

  if (input.instructions) {
    finalInstructions = input.instructions;
    logger.info("Using instructions provided via call options", "CONFIG");
  } else if (input.brief) {
    logger.info("Generating instructions from call brief...", "AI");
    ({ instructions: finalInstructions, detectedLanguage, selectedVoice } =
      await generateInstructionsFromBrief(
        input.brief,
        effectiveUserName,
        voiceToUse,
        aiConfig
      ));
    logger.info("Successfully generated instructions from call brief", "AI");
  } else if (aiConfig.instructions) {
    finalInstructions = aiConfig.instructions;
    logger.info("Using instructions from config", "CONFIG");
  } else if (aiConfig.brief) {
    logger.info("Generating instructions from config call brief...", "AI");
    ({ instructions: finalInstructions, detectedLanguage, selectedVoice } =
      await generateInstructionsFromBrief(
        aiConfig.brief,
        effectiveUserName,
        voiceToUse,
        aiConfig
      ));
    logger.info(
      "Successfully generated instructions from config call brief",
      "AI"
    );
  } else {
    throw new Error(
      "No instructions or brief provided. Provide instructions, brief, or set them in config file."
    );
  }

  if (!finalInstructions) {
    throw new Error("Instruction preparation failed");
  }

  const finalVoice = selectedVoice || (voiceToUse !== "auto" ? voiceToUse : "marin");
  aiConfig.instructions = finalInstructions;
  aiConfig.voice = finalVoice;

  if (detectedLanguage && isValidLanguageCode(detectedLanguage)) {
    aiConfig.language = detectedLanguage;
    logger.info(
      `Detected language for transcription: ${detectedLanguage}`,
      "AI"
    );
  } else if (detectedLanguage) {
    logger.warn(
      `Invalid detected language '${detectedLanguage}' - Whisper will auto-detect`,
      "AI"
    );
  }

  if (selectedVoice) {
    logger.info(`Auto-selected voice: ${selectedVoice}`, "AI");
  }

  return {
    config,
    instructions: finalInstructions,
    voice: finalVoice,
    detectedLanguage,
    selectedVoice,
    userName: effectiveUserName,
  };
}

function getAIConfig(config: Config): RuntimeAIConfig | undefined {
  const aiConfig = config.ai ?? config.openai;

  if (aiConfig && isLegacyOpenAIConfig(aiConfig) && aiConfig.apiKey && !aiConfig.openaiApiKey) {
    aiConfig.openaiApiKey = aiConfig.apiKey;
  }

  return aiConfig;
}

function loadConfigFromEnvironment(): Config {
  const envConfig = normalizeConfigShape(loadConfigFromEnv());
  const aiConfig = getAIConfig(envConfig);

  if (!envConfig.sip?.username || !hasConfiguredAIKey(aiConfig)) {
    throw new Error(
      "No valid configuration found. Either provide a config file or set environment variables."
    );
  }

  return envConfig;
}

function hasConfiguredAIKey(aiConfig: RuntimeAIConfig | undefined): boolean {
  if (!aiConfig) {
    return false;
  }

  if (aiConfig.provider === "gemini") {
    return Boolean(aiConfig.geminiApiKey || process.env.GEMINI_API_KEY);
  }

  return Boolean(getOpenAIApiKey(aiConfig));
}

function getOpenAIApiKey(aiConfig: RuntimeAIConfig | undefined): string {
  if (!aiConfig) {
    return "";
  }

  const apiKey =
    aiConfig.openaiApiKey ??
    (isLegacyOpenAIConfig(aiConfig) ? aiConfig.apiKey : undefined) ??
    process.env.OPENAI_API_KEY ??
    "";

  if (apiKey && !aiConfig.openaiApiKey) {
    aiConfig.openaiApiKey = apiKey;
  }

  return apiKey;
}

async function generateInstructionsFromBrief(
  brief: string,
  userName: string | undefined,
  voice: string,
  aiConfig: RuntimeAIConfig
): Promise<{
  instructions: string;
  detectedLanguage?: string;
  selectedVoice?: string;
}> {
  try {
    const openaiApiKey = getOpenAIApiKey(aiConfig);

    if (!openaiApiKey) {
      throw new Error(
        "Call brief processing requires an OpenAI API key."
      );
    }

    const processor = new CallBriefProcessor({
      openaiApiKey,
      defaultUserName: userName,
      voice,
    });

    const result = await processor.generateInstructions(brief, userName, voice);

    return {
      instructions: result.instructions,
      detectedLanguage: result.language,
      selectedVoice: result.selectedVoice,
    };
  } catch (error) {
    if (error instanceof CallBriefError) {
      throw new Error(error.message);
    }

    throw new Error(
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
