import { z } from "zod";

const envSchema = z.object({
    VITE_AUTH0_DOMAIN: z.string().min(1, "VITE_AUTH0_DOMAIN is required"),
    VITE_AUTH0_CLIENT_ID: z.string().min(1, "VITE_AUTH0_CLIENT_ID is required"),
    VITE_AUTH0_AUDIENCE: z.string().min(1, "VITE_AUTH0_AUDIENCE is required"),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
    console.error(
        "❌ Invalid environment variables:",
        parsedEnv.error.format()
    );
    throw new Error("Missing or invalid environment variables");
}

export default parsedEnv.data;
