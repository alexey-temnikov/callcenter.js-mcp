import { z } from "zod";

const sipSchema = z.object({
  username: z.string().min(1, "Missing SIP username"),
  password: z.string().min(1, "Missing SIP password"),
  serverIp: z.string().min(1, "Missing SIP server IP"),
  serverPort: z.number().int().min(1).max(65535).default(5060),
  localPort: z.number().int().min(1).max(65535).default(5060),
}).passthrough();

const aiSchema = z.object({
  provider: z.enum(["openai", "gemini"]).optional(),
  openaiApiKey: z.string().optional(),
  geminiApiKey: z.string().optional(),
  model: z.string().optional(),
  voice: z.string().optional(),
  instructions: z.string().optional(),
  brief: z.string().optional(),
  userName: z.string().optional(),
  language: z.string().optional(),
}).passthrough();

const legacyOpenAISchema = aiSchema.extend({
  apiKey: z.string().optional(),
});

export const normalizedConfigSchema = z.object({
  sip: sipSchema,
  ai: aiSchema.optional(),
  openai: legacyOpenAISchema.optional(),
  audio: z.unknown().optional(),
  logging: z.unknown().optional(),
  call: z.unknown().optional(),
}).passthrough();

export function formatConfigSchemaError(error: z.ZodError): string {
  const issue = error.issues[0];

  if (!issue) {
    return "Invalid configuration";
  }

  const field = issue.path.join(".");
  return field ? `${issue.message} (${field})` : issue.message;
}
