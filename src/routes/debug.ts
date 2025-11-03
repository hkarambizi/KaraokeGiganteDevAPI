import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { verifyToken } from '@clerk/backend';

/**
 * Debug Routes (Development Only)
 *
 * These endpoints help debug authentication issues
 */

export async function debugRoutes(fastify: FastifyInstance) {
    // Only register in development
    if (env.NODE_ENV !== 'development') {
        return;
    }

    // GET /api/debug/auth - Debug authentication issues
    fastify.get('/api/debug/auth', async (request, _reply) => {
        const authHeader = request.headers.authorization;

        const debugInfo: any = {
            hasAuthHeader: !!authHeader,
            authHeaderPreview: authHeader ? authHeader.substring(0, 30) + '...' : null,
            startsWithBearer: authHeader?.startsWith('Bearer '),
            clerkSecretKeyConfigured: !!env.CLERK_SECRET_KEY,
            clerkSecretKeyPrefix: env.CLERK_SECRET_KEY.substring(0, 10) + '...',
        };

        if (!authHeader) {
            return {
                ...debugInfo,
                error: 'No Authorization header provided',
                solution: 'Add Authorization: Bearer <your-clerk-jwt> to the request',
            };
        }

        if (!authHeader.startsWith('Bearer ')) {
            return {
                ...debugInfo,
                error: 'Authorization header does not start with "Bearer "',
                solution: 'Format should be: Authorization: Bearer <token>',
            };
        }

        const token = authHeader.substring(7);
        debugInfo.tokenLength = token.length;
        debugInfo.tokenPreview = token.substring(0, 20) + '...';

        // Try to verify the token
        try {
            const decoded = await verifyToken(token, {
                secretKey: env.CLERK_SECRET_KEY,
            });

            return {
                ...debugInfo,
                success: true,
                decoded: {
                    sub: decoded.sub,
                    iat: decoded.iat,
                    exp: decoded.exp,
                    iss: decoded.iss,
                },
                message: '✅ Token is valid!',
            };
        } catch (error: any) {
            return {
                ...debugInfo,
                success: false,
                error: error.message,
                errorType: error.name,
                solution: 'Token verification failed. Check that:',
                checks: [
                    '1. Token is a valid Clerk JWT',
                    '2. Token is not expired',
                    '3. CLERK_SECRET_KEY matches your Clerk dashboard',
                    '4. Token was generated for the same Clerk application',
                ],
            };
        }
    });

    // POST /api/debug/verify-token - Verify a specific token
    fastify.post('/api/debug/verify-token', async (request, reply) => {
        const body = request.body as { token: string };

        if (!body.token) {
            return reply.code(400).send({
                error: 'Missing token in request body',
                code: 'MISSING_TOKEN',
            });
        }

        try {
            const decoded = await verifyToken(body.token, {
                secretKey: env.CLERK_SECRET_KEY,
            });

            return {
                success: true,
                valid: true,
                decoded: {
                    sub: decoded.sub,
                    iat: decoded.iat,
                    exp: decoded.exp,
                    iss: decoded.iss,
                },
                expiresAt: new Date((decoded.exp || 0) * 1000).toISOString(),
                isExpired: (decoded.exp || 0) * 1000 < Date.now(),
            };
        } catch (error: any) {
            return {
                success: false,
                valid: false,
                error: error.message,
                errorType: error.name,
            };
        }
    });

    fastify.log.info('✅ Debug endpoints registered:');
    fastify.log.info('   GET  /api/debug/auth - Debug authentication issues');
    fastify.log.info('   POST /api/debug/verify-token - Verify specific token');
}
