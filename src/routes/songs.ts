import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Song } from '../models/Song.js';
import { verifyClerkToken } from '../middleware/auth.js';
import * as catalogService from '../services/catalogService.js';
import axios from 'axios';
import { env } from '../config/env.js';

const searchQuerySchema = z.object({
    q: z.string().min(1),
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('20'),
});

export async function songRoutes(fastify: FastifyInstance) {
    // GET /api/songs/search - Search songs
    fastify.get(
        '/api/songs/search',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const query = searchQuerySchema.parse(request.query);
                const page = parseInt(query.page, 10);
                const limit = Math.min(parseInt(query.limit, 10), 50); // Max 50 per page
                const skip = (page - 1) * limit;

                // Search using new catalog structure
                const searchRegex = new RegExp(query.q, 'i');
                const songs = await Song.find({
                    $or: [
                        { title: searchRegex },
                        { artistName: searchRegex },
                        { albumTitle: searchRegex },
                    ],
                })
                    .skip(skip)
                    .limit(limit)
                    .select('_id title artistName albumTitle albumArt durationSec sources')
                    .lean();

                const total = await Song.countDocuments({
                    $or: [
                        { title: searchRegex },
                        { artistName: searchRegex },
                        { albumTitle: searchRegex },
                    ],
                });

                return {
                    page,
                    limit,
                    total,
                    nextPage: skip + limit < total ? page + 1 : null,
                    songs,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid query',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error searching songs:', error);
                return reply.code(500).send({
                    error: 'Failed to search songs',
                    code: 'SONG_SEARCH_ERROR',
                });
            }
        }
    );

    // POST /api/songs/saveFromSpotify - Save song from Spotify (uses new catalog system)
    fastify.post(
        '/api/songs/saveFromSpotify',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const body = request.body as {
                    trackId: string;
                };

                const { trackId } = body;

                if (!trackId) {
                    return reply.code(400).send({
                        error: 'Missing required field: trackId',
                        code: 'MISSING_FIELDS',
                    });
                }

                request.log.info({ trackId, userId: request.userId }, 'Saving Spotify track (legacy endpoint)');

                if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
                    return reply.code(503).send({
                        error: 'Spotify integration not configured',
                        code: 'SPOTIFY_NOT_CONFIGURED',
                    });
                }

                // Get Spotify access token (client credentials)
                const tokenResponse = await axios.post(
                    'https://accounts.spotify.com/api/token',
                    new URLSearchParams({
                        grant_type: 'client_credentials',
                    }).toString(),
                    {
                        headers: {
                            'Authorization': `Basic ${Buffer.from(
                                `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
                            ).toString('base64')}`,
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    }
                );

                const accessToken = tokenResponse.data.access_token;

                // Fetch track details from Spotify
                const trackResponse = await axios.get(
                    `https://api.spotify.com/v1/tracks/${trackId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    }
                );

                const trackData: catalogService.SpotifyTrackData = trackResponse.data;

                // Save using new catalog service
                const result = await catalogService.saveFromSpotifyTrack(trackData);

                if (result.inserted) {
                    return reply.code(201).send({
                        duplicate: false,
                        inserted: true,
                        song: result.song,
                    });
                } else {
                    return {
                        duplicate: true,
                        inserted: false,
                        song: result.song,
                        existingId: result.existingId,
                    };
                }
            } catch (error: any) {
                fastify.log.error('Error saving song:', error);
                return reply.code(500).send({
                    error: 'Failed to save song',
                    code: 'SONG_SAVE_ERROR',
                });
            }
        }
    );
}
