import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createClerkClient } from '@clerk/backend';
import { env } from '../config/env.js';
import { verifyClerkToken, requireAdmin } from '../middleware/auth.js';
import * as spotifyService from '../services/spotifyService.js';

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// Validation schemas
const exchangeCodeSchema = z.object({
    code: z.string().min(1, 'Authorization code is required'),
    redirectUri: z.string().url('Invalid redirect URI'),
});

export async function spotifyRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/spotify/exchange-code
     * Exchange Spotify authorization code for access and refresh tokens
     */
    fastify.post(
        '/exchange-code',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { code, redirectUri } = exchangeCodeSchema.parse(request.body);

                // Verify user is admin
                if (request.role !== 'admin') {
                    return reply.code(403).send({
                        error: 'Only admins can connect Spotify',
                        code: 'INSUFFICIENT_PERMISSIONS',
                    });
                }

                // Get user's organization
                const user = await clerk.users.getUser(request.userId!);
                const orgId = (user.publicMetadata as any).activeOrgId;

                if (!orgId) {
                    return reply.code(400).send({
                        error: 'User must be part of an organization',
                        code: 'NO_ORGANIZATION',
                    });
                }

                request.log.info({ userId: request.userId, orgId }, 'Exchanging Spotify code for tokens');

                // Exchange code for tokens
                const tokenResponse = await spotifyService.exchangeCodeForTokens(code, redirectUri);

                // Store tokens in Clerk metadata
                await spotifyService.storeSpotifyTokens(request.userId!, orgId, tokenResponse);

                request.log.info({ userId: request.userId, orgId }, 'Spotify connected successfully');

                return {
                    success: true,
                    spotifyConnected: true,
                };
            } catch (error: any) {
                request.log.error({ error: error.message, stack: error.stack }, 'Failed to exchange Spotify code');

                if (error.response?.status === 400) {
                    return reply.code(400).send({
                        error: 'Invalid authorization code or redirect URI',
                        code: 'INVALID_CODE',
                    });
                }

                if (error.response?.status === 401) {
                    return reply.code(401).send({
                        error: 'Spotify authentication failed',
                        code: 'SPOTIFY_AUTH_FAILED',
                    });
                }

                return reply.code(500).send({
                    error: 'Failed to connect Spotify',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );

    /**
     * GET /api/spotify/status
     * Check if the organization has an active Spotify connection
     */
    fastify.get(
        '/status',
        {
            preHandler: [verifyClerkToken],
        },
        async (request, reply) => {
            try {
                // Get user's organization
                const user = await clerk.users.getUser(request.userId!);
                const publicMetadata = user.publicMetadata as any;
                const privateMetadata = user.privateMetadata as any;
                const orgId = publicMetadata.activeOrgId;

                if (!orgId) {
                    return {
                        connected: false,
                    };
                }

                // Check if user has Spotify tokens
                const hasTokens = !!privateMetadata.spotifyRefreshToken;

                if (!hasTokens) {
                    return {
                        connected: false,
                    };
                }

                // Get organization metadata
                const org = await clerk.organizations.getOrganization({ organizationId: orgId });
                const orgPrivateMetadata = org.privateMetadata as any;

                return {
                    connected: true,
                    connectedBy: orgPrivateMetadata.playlistUser,
                    connectedAt: orgPrivateMetadata.spotifyConnectedAt,
                    scopes: privateMetadata.spotifyTokenScope?.split(' ') || [],
                };
            } catch (error: any) {
                request.log.error({ error: error.message }, 'Failed to check Spotify status');

                return reply.code(500).send({
                    error: 'Failed to check Spotify status',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );

    /**
     * POST /api/spotify/refresh-token
     * Refresh the Spotify access token using the refresh token
     */
    fastify.post(
        '/refresh-token',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                // Verify user is admin
                if (request.role !== 'admin') {
                    return reply.code(403).send({
                        error: 'Only admins can refresh Spotify token',
                        code: 'INSUFFICIENT_PERMISSIONS',
                    });
                }

                request.log.info({ userId: request.userId }, 'Refreshing Spotify token');

                // Get valid access token (automatically refreshes if needed)
                await spotifyService.getValidAccessToken(request.userId!);

                return {
                    success: true,
                };
            } catch (error: any) {
                request.log.error({ error: error.message }, 'Failed to refresh Spotify token');

                if (error.message.includes('not connected')) {
                    return reply.code(401).send({
                        error: error.message,
                        code: 'SPOTIFY_NOT_CONNECTED',
                    });
                }

                return reply.code(500).send({
                    error: 'Failed to refresh Spotify token',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );

    /**
     * DELETE /api/spotify/disconnect
     * Remove Spotify integration for the organization
     */
    fastify.delete(
        '/disconnect',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                // Verify user is admin
                if (request.role !== 'admin') {
                    return reply.code(403).send({
                        error: 'Only admins can disconnect Spotify',
                        code: 'INSUFFICIENT_PERMISSIONS',
                    });
                }

                // Get user's organization
                const user = await clerk.users.getUser(request.userId!);
                const orgId = (user.publicMetadata as any).activeOrgId;

                if (!orgId) {
                    return reply.code(400).send({
                        error: 'User must be part of an organization',
                        code: 'NO_ORGANIZATION',
                    });
                }

                request.log.info({ userId: request.userId, orgId }, 'Disconnecting Spotify');

                // Clear Spotify tokens
                await spotifyService.clearSpotifyTokens(request.userId!, orgId);

                return {
                    success: true,
                };
            } catch (error: any) {
                request.log.error({ error: error.message }, 'Failed to disconnect Spotify');

                return reply.code(500).send({
                    error: 'Failed to disconnect Spotify',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );
}

