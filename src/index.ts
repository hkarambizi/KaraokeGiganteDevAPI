import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';

// Routes
import { devRoutes } from './routes/dev.js';
import { debugRoutes } from './routes/debug.js';
import { userRoutes } from './routes/users.js';
import { organizationRoutes } from './routes/organizations.js';
import { songRoutes } from './routes/songs.js';
import { eventRoutes } from './routes/events.js';
import { requestRoutes } from './routes/requests.js';
import { crateRoutes } from './routes/crates.js';
import { deviceRoutes } from './routes/devices.js';
import { broadcastRoutes } from './routes/broadcast.js';
import { spotifyRoutes } from './routes/spotify.js';
import { playlistRoutes } from './routes/playlists.js';
import { catalogRoutes } from './routes/catalog.js';
import { importRoutes } from './routes/imports.js';
import { adminFixRoutes } from './routes/admin-fix.js';

async function main() {
    // Create Fastify instance with logging
    const fastify = Fastify({
        logger: {
            level: env.NODE_ENV === 'development' ? 'debug' : 'info',
            transport:
                env.NODE_ENV === 'development'
                    ? {
                        target: 'pino-pretty',
                        options: {
                            translateTime: 'HH:MM:ss Z',
                            ignore: 'pid,hostname',
                            colorize: true,
                            singleLine: false,
                        },
                    }
                    : undefined,
            serializers: {
                req: (req) => ({
                    method: req.method,
                    url: req.url,
                    headers: env.NODE_ENV === 'development' ? req.headers : undefined,
                    query: req.query,
                    body: env.NODE_ENV === 'development' ? req.body : undefined,
                }),
                res: (res) => ({
                    statusCode: res.statusCode,
                    headers: env.NODE_ENV === 'development' ? res.headers : undefined,
                }),
                err: (err: any) => ({
                    type: err.constructor?.name || 'Error',
                    message: err.message,
                    stack: env.NODE_ENV === 'development' ? (err.stack || '') : '',
                    statusCode: err.statusCode,
                    code: err.code,
                    details: err.details || err.cause || err.issues,
                }),
            },
        },
        requestIdLogLabel: 'reqId',
        disableRequestLogging: false,
        requestIdHeader: 'x-request-id',
    });

    try {
        // Register CORS
        await fastify.register(cors, {
            origin: env.CORS_ORIGINS_ARRAY,
            credentials: true,
        });

        // Connect to MongoDB
        await connectDatabase();

        // Enhanced logging hooks for DEBUG mode
        if (env.NODE_ENV === 'development') {
            // Log request body in DEBUG mode (after body parsing)
            fastify.addHook('preValidation', async (request) => {
                if (request.body && Object.keys(request.body).length > 0) {
                    request.log.debug({
                        body: request.body,
                        contentType: request.headers['content-type'],
                    }, '📥 Request body');
                }
            });

            // Log response body in DEBUG mode
            fastify.addHook('onSend', async (request, reply, payload) => {
                // Only log if response is JSON
                const contentType = reply.getHeader('content-type');
                if (typeof contentType === 'string' && contentType.includes('application/json')) {
                    try {
                        const body = typeof payload === 'string' ? JSON.parse(payload) : payload;
                        request.log.debug({
                            statusCode: reply.statusCode,
                            responseBody: body,
                        }, '📤 Response body');
                    } catch (e) {
                        // If payload is not JSON, log as-is (truncated)
                        request.log.debug({
                            statusCode: reply.statusCode,
                            responsePreview: typeof payload === 'string'
                                ? payload.substring(0, 200)
                                : String(payload).substring(0, 200),
                        }, '📤 Response body (non-JSON)');
                    }
                }
            });

            // Log validation errors in detail
            fastify.setValidatorCompiler(() => {
                return (data) => ({ value: data });
            });
        }

        // Health check
        fastify.get('/health', async () => {
            return {
                status: 'ok',
                timestamp: new Date().toISOString(),
                environment: env.NODE_ENV,
            };
        });

        // Register routes
        await fastify.register(devRoutes);
        await fastify.register(debugRoutes);
        await fastify.register(userRoutes);
        await fastify.register(organizationRoutes);
        await fastify.register(songRoutes);
        await fastify.register(eventRoutes);
        await fastify.register(requestRoutes);
        await fastify.register(crateRoutes);
        await fastify.register(deviceRoutes);
        await fastify.register(broadcastRoutes);

        // Spotify Integration & Playlists
        await fastify.register(spotifyRoutes, { prefix: '/api/spotify' });
        await fastify.register(playlistRoutes, { prefix: '/api/playlists' });

        // Catalog Search & Import System
        await fastify.register(catalogRoutes, { prefix: '/api/catalog' });
        await fastify.register(importRoutes, { prefix: '/api/admin/imports' });
        await fastify.register(adminFixRoutes, { prefix: '/api/admin' });

        // Enhanced error handler with detailed logging
        fastify.setErrorHandler((error, request, reply) => {
            const statusCode = error.statusCode || 500;
            const isValidationError = error.validation || error.name === 'ZodError';

            // Enhanced error logging for DEBUG mode
            if (env.NODE_ENV === 'development') {
                const errorDetails: any = {
                    err: error,
                    type: error.constructor?.name || 'Error',
                    message: error.message,
                    stack: error.stack,
                    statusCode: statusCode,
                    code: error.code || 'INTERNAL_ERROR',
                    requestBody: request.body,
                    requestQuery: request.query,
                    requestParams: request.params,
                    url: request.url,
                    method: request.method,
                };

                // Add validation/error details if they exist
                if ('validation' in error) errorDetails.validation = (error as any).validation;
                if ('issues' in error) errorDetails.issues = (error as any).issues;
                if ('cause' in error) errorDetails.cause = (error as any).cause;

                request.log.error(errorDetails, '❌ Error occurred');
            } else {
                // Production: log minimal details
                fastify.log.error({
                    err: error,
                    statusCode: statusCode,
                    code: error.code || 'INTERNAL_ERROR',
                    url: request.url,
                    method: request.method,
                }, 'Error occurred');
            }

            // Prepare error response
            const errorResponse: any = {
                error: error.message || 'Internal Server Error',
                code: error.code || (isValidationError ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR'),
            };

            // Add validation details in development
            if (env.NODE_ENV === 'development' && isValidationError) {
                const validationError = error as any;
                errorResponse.details = validationError.validation || validationError.issues || validationError.cause;
                errorResponse.stack = error.stack;
            }

            reply.status(statusCode).send(errorResponse);
        });

        // Start server
        await fastify.listen({
            port: env.PORT,
            host: '0.0.0.0',
        });

        fastify.log.info(`🚀 Server running on port ${env.PORT}`);
        fastify.log.info(`📦 Environment: ${env.NODE_ENV}`);
        fastify.log.info(`🔐 Clerk authentication enabled`);

        if (env.NODE_ENV === 'development') {
            fastify.log.warn('⚠️  Development mode active - changelog endpoints enabled');
        }
    } catch (error) {
        fastify.log.error(error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⏳ Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⏳ Shutting down gracefully...');
    process.exit(0);
});

// Start the server
main();
