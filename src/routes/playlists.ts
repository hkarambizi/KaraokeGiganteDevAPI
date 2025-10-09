import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Playlist } from '../models/Playlist.js';
import { Song } from '../models/Song.js';
import { verifyClerkToken, requireAdmin } from '../middleware/auth.js';
import * as spotifyService from '../services/spotifyService.js';
import mongoose from 'mongoose';

// Validation schemas
const createPlaylistSchema = z.object({
    name: z.string().min(1, 'Playlist name is required').max(100, 'Name too long'),
    description: z.string().max(500, 'Description too long').optional(),
    songIds: z.array(z.string()).default([]),
});

const updatePlaylistSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    songIds: z.array(z.string()).optional(),
});

const listPlaylistsSchema = z.object({
    orgId: z.string().optional(),
});

export async function playlistRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/playlists
     * Create a new playlist
     */
    fastify.post(
        '/',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                // Verify user is admin
                if (request.role !== 'admin') {
                    return reply.code(403).send({
                        error: 'Only admins can create playlists',
                        code: 'INSUFFICIENT_PERMISSIONS',
                    });
                }

                const body = createPlaylistSchema.parse(request.body);

                // Get user's organization from their publicMetadata
                const orgId = request.orgId;

                if (!orgId) {
                    return reply.code(400).send({
                        error: 'User must be part of an organization',
                        code: 'NO_ORGANIZATION',
                    });
                }

                // Validate song IDs exist
                if (body.songIds.length > 0) {
                    const validSongIds = await Song.find({ _id: { $in: body.songIds } }).distinct('_id');

                    if (validSongIds.length !== body.songIds.length) {
                        return reply.code(400).send({
                            error: 'Some song IDs are invalid',
                            code: 'INVALID_SONG_IDS',
                        });
                    }
                }

                // Create playlist
                const playlist = await Playlist.create({
                    orgId,
                    authorId: request.userId,
                    name: body.name,
                    description: body.description,
                    songIds: body.songIds,
                    isPublished: false,
                });

                request.log.info({ playlistId: playlist._id, orgId }, 'Playlist created');

                return { playlist };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Validation failed',
                        details: error.errors,
                    });
                }

                request.log.error({ error: error.message, stack: error.stack }, 'Failed to create playlist');

                return reply.code(500).send({
                    error: 'Failed to create playlist',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );

    /**
     * GET /api/playlists
     * List playlists for an organization
     */
    fastify.get(
        '/',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const query = listPlaylistsSchema.parse(request.query);

                // Use orgId from query or user's organization
                const orgId = query.orgId || request.orgId;

                if (!orgId) {
                    return reply.code(400).send({
                        error: 'Organization ID is required',
                        code: 'NO_ORGANIZATION',
                    });
                }

                // Verify user has access to this organization
                if (query.orgId && query.orgId !== request.orgId) {
                    return reply.code(403).send({
                        error: 'Access denied to this organization',
                        code: 'ACCESS_DENIED',
                    });
                }

                const playlists = await Playlist.find({ orgId }).sort({ createdAt: -1 }).lean();

                return { playlists };
            } catch (error: any) {
                request.log.error({ error: error.message }, 'Failed to list playlists');

                return reply.code(500).send({
                    error: 'Failed to list playlists',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );

    /**
     * GET /api/playlists/:id
     * Get a single playlist
     */
    fastify.get(
        '/:id',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { id } = request.params as { id: string };

                if (!mongoose.Types.ObjectId.isValid(id)) {
                    return reply.code(400).send({
                        error: 'Invalid playlist ID',
                        code: 'INVALID_ID',
                    });
                }

                const playlist = await Playlist.findById(id).lean();

                if (!playlist) {
                    return reply.code(404).send({
                        error: 'Playlist not found',
                        code: 'NOT_FOUND',
                    });
                }

                // Verify user has access to this organization
                if (playlist.orgId !== request.orgId) {
                    return reply.code(403).send({
                        error: 'Access denied to this playlist',
                        code: 'ACCESS_DENIED',
                    });
                }

                return { playlist };
            } catch (error: any) {
                request.log.error({ error: error.message }, 'Failed to get playlist');

                return reply.code(500).send({
                    error: 'Failed to get playlist',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );

    /**
     * PUT /api/playlists/:id
     * Update a playlist
     */
    fastify.put(
        '/:id',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                // Verify user is admin
                if (request.role !== 'admin') {
                    return reply.code(403).send({
                        error: 'Only admins can update playlists',
                        code: 'INSUFFICIENT_PERMISSIONS',
                    });
                }

                const { id } = request.params as { id: string };
                const body = updatePlaylistSchema.parse(request.body);

                if (!mongoose.Types.ObjectId.isValid(id)) {
                    return reply.code(400).send({
                        error: 'Invalid playlist ID',
                        code: 'INVALID_ID',
                    });
                }

                const playlist = await Playlist.findById(id);

                if (!playlist) {
                    return reply.code(404).send({
                        error: 'Playlist not found',
                        code: 'NOT_FOUND',
                    });
                }

                // Verify user has access to this organization
                if (playlist.orgId !== request.orgId) {
                    return reply.code(403).send({
                        error: 'Access denied to this playlist',
                        code: 'ACCESS_DENIED',
                    });
                }

                // Validate song IDs if provided
                if (body.songIds && body.songIds.length > 0) {
                    const validSongIds = await Song.find({ _id: { $in: body.songIds } }).distinct('_id');

                    if (validSongIds.length !== body.songIds.length) {
                        return reply.code(400).send({
                            error: 'Some song IDs are invalid',
                            code: 'INVALID_SONG_IDS',
                        });
                    }
                }

                // Update playlist
                if (body.name !== undefined) playlist.name = body.name;
                if (body.description !== undefined) playlist.description = body.description;
                if (body.songIds !== undefined) playlist.songIds = body.songIds;

                await playlist.save();

                request.log.info({ playlistId: id }, 'Playlist updated');

                return { playlist };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Validation failed',
                        details: error.errors,
                    });
                }

                request.log.error({ error: error.message }, 'Failed to update playlist');

                return reply.code(500).send({
                    error: 'Failed to update playlist',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );

    /**
     * DELETE /api/playlists/:id
     * Delete a playlist
     */
    fastify.delete(
        '/:id',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                // Verify user is admin
                if (request.role !== 'admin') {
                    return reply.code(403).send({
                        error: 'Only admins can delete playlists',
                        code: 'INSUFFICIENT_PERMISSIONS',
                    });
                }

                const { id } = request.params as { id: string };

                if (!mongoose.Types.ObjectId.isValid(id)) {
                    return reply.code(400).send({
                        error: 'Invalid playlist ID',
                        code: 'INVALID_ID',
                    });
                }

                const playlist = await Playlist.findById(id);

                if (!playlist) {
                    return reply.code(404).send({
                        error: 'Playlist not found',
                        code: 'NOT_FOUND',
                    });
                }

                // Verify user has access to this organization
                if (playlist.orgId !== request.orgId) {
                    return reply.code(403).send({
                        error: 'Access denied to this playlist',
                        code: 'ACCESS_DENIED',
                    });
                }

                await playlist.deleteOne();

                request.log.info({ playlistId: id }, 'Playlist deleted');

                return { success: true };
            } catch (error: any) {
                request.log.error({ error: error.message }, 'Failed to delete playlist');

                return reply.code(500).send({
                    error: 'Failed to delete playlist',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );

    /**
     * POST /api/playlists/:id/publish
     * Publish a playlist to Spotify
     */
    fastify.post(
        '/:id/publish',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                // Verify user is admin
                if (request.role !== 'admin') {
                    return reply.code(403).send({
                        error: 'Only admins can publish playlists',
                        code: 'INSUFFICIENT_PERMISSIONS',
                    });
                }

                const { id } = request.params as { id: string };

                if (!mongoose.Types.ObjectId.isValid(id)) {
                    return reply.code(400).send({
                        error: 'Invalid playlist ID',
                        code: 'INVALID_ID',
                    });
                }

                const playlist = await Playlist.findById(id);

                if (!playlist) {
                    return reply.code(404).send({
                        error: 'Playlist not found',
                        code: 'NOT_FOUND',
                    });
                }

                // Verify user has access to this organization
                if (playlist.orgId !== request.orgId) {
                    return reply.code(403).send({
                        error: 'Access denied to this playlist',
                        code: 'ACCESS_DENIED',
                    });
                }

                // Check if already published
                if (playlist.isPublished) {
                    return reply.code(400).send({
                        error: 'Playlist is already published to Spotify',
                        code: 'ALREADY_PUBLISHED',
                    });
                }

                request.log.info({ playlistId: id }, 'Publishing playlist to Spotify');

                // Get valid Spotify access token (auto-refreshes if needed)
                const accessToken = await spotifyService.getValidAccessToken(request.userId!);

                // Get Spotify user profile
                const spotifyProfile = await spotifyService.getSpotifyUserProfile(accessToken);

                // Create Spotify playlist
                const spotifyPlaylist = await spotifyService.createSpotifyPlaylist(
                    accessToken,
                    spotifyProfile.id,
                    playlist.name,
                    playlist.description || '',
                    false // Private playlist
                );

                // Get songs with Spotify IDs and construct URIs
                const songs = await Song.find({ _id: { $in: playlist.songIds } }).lean();
                const spotifyUris = songs
                    .filter((song) => song.spotifyId)
                    .map((song) => `spotify:track:${song.spotifyId}`);

                if (spotifyUris.length === 0) {
                    return reply.code(400).send({
                        error: 'No songs with Spotify URIs found in playlist',
                        code: 'NO_SPOTIFY_URIS',
                    });
                }

                // Add tracks to Spotify playlist
                await spotifyService.addTracksToSpotifyPlaylist(accessToken, spotifyPlaylist.id, spotifyUris);

                // Update playlist with Spotify data
                playlist.spotifyPlaylist = {
                    playlistId: spotifyPlaylist.id,
                    name: spotifyPlaylist.name,
                    description: spotifyPlaylist.description,
                    href: spotifyPlaylist.href,
                    playlistUrl: spotifyPlaylist.external_urls.spotify,
                    tracksUrl: spotifyPlaylist.tracks.href,
                };
                playlist.isPublished = true;
                playlist.publishedAt = new Date();
                playlist.publishedBy = request.userId;

                await playlist.save();

                request.log.info(
                    { playlistId: id, spotifyPlaylistId: spotifyPlaylist.id },
                    'Playlist published to Spotify successfully'
                );

                return {
                    success: true,
                    playlist,
                };
            } catch (error: any) {
                request.log.error({ error: error.message, stack: error.stack }, 'Failed to publish playlist');

                if (error.message.includes('not connected')) {
                    return reply.code(401).send({
                        error: 'Spotify not connected. Please connect Spotify first.',
                        code: 'SPOTIFY_NOT_CONNECTED',
                    });
                }

                if (error.response?.status === 403) {
                    return reply.code(403).send({
                        error: 'Insufficient Spotify permissions. Please reconnect with required scopes.',
                        code: 'INSUFFICIENT_SPOTIFY_PERMISSIONS',
                    });
                }

                return reply.code(500).send({
                    error: 'Failed to publish playlist to Spotify',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );

    /**
     * DELETE /api/playlists/:id/unpublish
     * Remove Spotify association from a playlist (does not delete from Spotify)
     */
    fastify.delete(
        '/:id/unpublish',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                // Verify user is admin
                if (request.role !== 'admin') {
                    return reply.code(403).send({
                        error: 'Only admins can unpublish playlists',
                        code: 'INSUFFICIENT_PERMISSIONS',
                    });
                }

                const { id } = request.params as { id: string };

                if (!mongoose.Types.ObjectId.isValid(id)) {
                    return reply.code(400).send({
                        error: 'Invalid playlist ID',
                        code: 'INVALID_ID',
                    });
                }

                const playlist = await Playlist.findById(id);

                if (!playlist) {
                    return reply.code(404).send({
                        error: 'Playlist not found',
                        code: 'NOT_FOUND',
                    });
                }

                // Verify user has access to this organization
                if (playlist.orgId !== request.orgId) {
                    return reply.code(403).send({
                        error: 'Access denied to this playlist',
                        code: 'ACCESS_DENIED',
                    });
                }

                // Clear Spotify association
                playlist.spotifyPlaylist = undefined;
                playlist.isPublished = false;
                playlist.publishedAt = undefined;
                playlist.publishedBy = undefined;

                await playlist.save();

                request.log.info({ playlistId: id }, 'Playlist unpublished from Spotify');

                return { success: true };
            } catch (error: any) {
                request.log.error({ error: error.message }, 'Failed to unpublish playlist');

                return reply.code(500).send({
                    error: 'Failed to unpublish playlist',
                    code: 'SERVER_ERROR',
                });
            }
        }
    );
}

