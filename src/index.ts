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
                        },
                    }
                    : undefined,
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

        // Error handler
        fastify.setErrorHandler((error, _request, reply) => {
            fastify.log.error(error);

            reply.status(error.statusCode || 500).send({
                error: error.message || 'Internal Server Error',
                code: 'INTERNAL_ERROR',
            });
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
