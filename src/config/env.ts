import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'staging']).default('development'),
    PORT: z.string().default('3000'),
    MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
    MONGO_URI_CI: z.string().min(1, 'MONGO_URI_CI is required'),
    CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
    CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    QSTASH_URL: z.string().optional(),
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
    SPOTIFY_CLIENT_ID: z.string().optional(),
    SPOTIFY_CLIENT_SECRET: z.string().optional(),
    EXPO_ACCESS_TOKEN: z.string().optional(),
    CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:19006,http://localhost:19000'),
    RATE_LIMIT_MAX_REQUESTS: z.string().default('10'),
    RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
});

export function validateEnvironment() {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        console.error('\n❌ Invalid environment configuration:\n');

        const errors = parsed.error.flatten().fieldErrors;
        for (const [field, messages] of Object.entries(errors)) {
            console.error(`  ${field}: ${messages?.join(', ')}`);
        }

        console.error('\n📝 Required environment variables:');
        console.error('  - MONGO_URI');
        console.error('  - CLERK_SECRET_KEY');
        console.error('  - CLERK_PUBLISHABLE_KEY');
        console.error('\n💡 See ENV_TEMPLATE.md for detailed configuration guide\n');

        throw new Error('Invalid environment variables');
    }

    return parsed.data;
}

const validatedEnv = validateEnvironment();

export const env = {
    ...validatedEnv,
    PORT: parseInt(validatedEnv.PORT, 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(validatedEnv.RATE_LIMIT_MAX_REQUESTS, 10),
    RATE_LIMIT_WINDOW_MS: parseInt(validatedEnv.RATE_LIMIT_WINDOW_MS, 10),
    CORS_ORIGINS_ARRAY: validatedEnv.CORS_ORIGINS.split(',').map(s => s.trim()),
};

export type Env = typeof env;

// Log configuration on startup (without sensitive values)
if (env.NODE_ENV === 'development') {
    console.log('\n✅ Environment validated successfully:');
    console.log(`  - NODE_ENV: ${env.NODE_ENV}`);
    console.log(`  - PORT: ${env.PORT}`);
    console.log(`  - MONGO_URI: ${env.MONGO_URI.replace(/\/\/.*@/, '//*****@')}`);
    console.log(`  - CLERK_SECRET_KEY: ${env.CLERK_SECRET_KEY.substring(0, 15)}...`);
    console.log(`  - CORS_ORIGINS: ${env.CORS_ORIGINS_ARRAY.length} origin(s)`);
    console.log('');
}
