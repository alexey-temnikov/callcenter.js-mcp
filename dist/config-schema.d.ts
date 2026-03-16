import { z } from "zod";
export declare const normalizedConfigSchema: z.ZodObject<{
    sip: z.ZodObject<{
        username: z.ZodString;
        password: z.ZodString;
        serverIp: z.ZodString;
        serverPort: z.ZodDefault<z.ZodNumber>;
        localPort: z.ZodDefault<z.ZodNumber>;
    }, z.core.$loose>;
    ai: z.ZodOptional<z.ZodObject<{
        provider: z.ZodOptional<z.ZodEnum<{
            openai: "openai";
            gemini: "gemini";
        }>>;
        openaiApiKey: z.ZodOptional<z.ZodString>;
        geminiApiKey: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        voice: z.ZodOptional<z.ZodString>;
        instructions: z.ZodOptional<z.ZodString>;
        brief: z.ZodOptional<z.ZodString>;
        userName: z.ZodOptional<z.ZodString>;
        language: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>;
    openai: z.ZodOptional<z.ZodObject<{
        provider: z.ZodOptional<z.ZodEnum<{
            openai: "openai";
            gemini: "gemini";
        }>>;
        openaiApiKey: z.ZodOptional<z.ZodString>;
        geminiApiKey: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        voice: z.ZodOptional<z.ZodString>;
        instructions: z.ZodOptional<z.ZodString>;
        brief: z.ZodOptional<z.ZodString>;
        userName: z.ZodOptional<z.ZodString>;
        language: z.ZodOptional<z.ZodString>;
        apiKey: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>;
    audio: z.ZodOptional<z.ZodUnknown>;
    logging: z.ZodOptional<z.ZodUnknown>;
    call: z.ZodOptional<z.ZodUnknown>;
}, z.core.$loose>;
export declare function formatConfigSchemaError(error: z.ZodError): string;
//# sourceMappingURL=config-schema.d.ts.map