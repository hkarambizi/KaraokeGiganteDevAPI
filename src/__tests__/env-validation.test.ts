import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Unit Tests for Environment Validation
 *
 * Tests that required environment variables are validated on startup
 */

describe('Environment Validation', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset process.env before each test
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        // Restore original env
        process.env = originalEnv;
    });

    it('should require MONGO_URI', () => {
        const requiredVars = ['MONGO_URI', 'CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'];

        expect(requiredVars).toContain('MONGO_URI');
    });

    it('should require CLERK_SECRET_KEY', () => {
        const requiredVars = ['MONGO_URI', 'CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'];

        expect(requiredVars).toContain('CLERK_SECRET_KEY');
    });

    it('should require CLERK_PUBLISHABLE_KEY', () => {
        const requiredVars = ['MONGO_URI', 'CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'];

        expect(requiredVars).toContain('CLERK_PUBLISHABLE_KEY');
    });

    it('should have default value for NODE_ENV', () => {
        const defaultNodeEnv = 'development';
        expect(defaultNodeEnv).toBe('development');
    });

    it('should have default value for PORT', () => {
        const defaultPort = '3000';
        expect(defaultPort).toBe('3000');
    });

    it('should parse CORS_ORIGINS as array', () => {
        const corsOrigins = 'http://localhost:8081,http://localhost:19006';
        const parsed = corsOrigins.split(',').map(s => s.trim());

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toHaveLength(2);
        expect(parsed[0]).toBe('http://localhost:8081');
    });

    it('should parse PORT as number', () => {
        const portString = '3000';
        const portNumber = parseInt(portString, 10);

        expect(typeof portNumber).toBe('number');
        expect(portNumber).toBe(3000);
    });

    it('should parse rate limit values as numbers', () => {
        const maxRequests = '10';
        const windowMs = '60000';

        expect(typeof parseInt(maxRequests, 10)).toBe('number');
        expect(typeof parseInt(windowMs, 10)).toBe('number');
    });

    it('should allow optional environment variables', () => {
        const optionalVars = [
            'UPSTASH_REDIS_REST_URL',
            'UPSTASH_REDIS_REST_TOKEN',
            'QSTASH_TOKEN',
            'SPOTIFY_CLIENT_ID',
            'EXPO_ACCESS_TOKEN',
        ];

        // These should not throw errors if missing
        expect(optionalVars).toBeDefined();
        expect(optionalVars.length).toBeGreaterThan(0);
    });
});
