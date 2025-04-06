import { z } from "zod";

const envSchema = z.object({
    PORT: z
        .string()
        .min(1, "PORT is required")
        .transform((val) => parseInt(val, 10))
        .optional()
        .default("5174"),
    GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
    AUTH0_DOMAIN: z.string().min(1, "AUTH0_DOMAIN is required"),
    AUTH0_AUDIENCE: z.string().min(1, "AUTH0_AUDIENCE is required"),
    FIREBASE_SERVICE_ACCOUNT_KEY: z
        .string()
        .min(1, "FIREBASE_SERVICE_ACCOUNT_KEY is required"),
    FRONTEND_ORIGIN: z
        .string()
        .min(1, "FRONTEND_ORIGIN is required")
        .url("FRONTEND_ORIGIN must be a valid URL"),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error(
        "❌ Invalid environment variables:",
        parsedEnv.error.format()
    );
    throw new Error("Missing or invalid environment variables");
}

const env = parsedEnv.data;

export default env;
