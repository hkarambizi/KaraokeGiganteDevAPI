import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import axios from 'axios';
import { Song } from '../models/Song.js';
import { verifyClerkToken, requireAdmin } from '../middleware/auth.js';
import * as catalogService from '../services/catalogService.js';
import * as upstash from '../services/upstashClient.js';
import { env } from '../config/env.js';

// Validation schemas
const searchQuerySchema = z.object({
    q: z.string().min(1, 'Query is required'),
    artistId: z.string().optional(),
    albumId: z.string().optional(),
    genre: z.string().optional(),
});

const spotifySearchSchema = z.object({
    q: z.string().min(1, 'Query is required'),
    limit: z.number().int().min(1).max(50).optional().default(20),
});

const saveFromSpotifySchema = z.object({
    trackId: z.string().min(1, 'Track ID is required'),
});

export async function catalogRoutes(fastify: FastifyInstance) {
    /**
     * GET /catalog/search
     * Search songs using Atlas Search or fallback to MongoDB regex
     */
    fastify.get(
        '/search',
        {
            preHandler: [verifyClerkToken],
        },
        async (request, reply) => {
            try {
                const query = searchQuerySchema.parse(request.query);
                const { q, artistId, albumId, genre } = query;

                request.log.info({ query: q, artistId, albumId, genre }, 'Searching catalog');

                // Check Redis cache first
                const cached = await upstash.getCachedSearch<any[]>(q);

                if (cached) {
                    request.log.debug({ query: q }, 'Cache hit for search');
                    return { songs: cached, cached: true };
                }

                // Try Atlas Search first
                let songs: any[];

                try {
                    const pipeline: any[] = [
                        {
                            $search: {
                                index: 'songs_search',
                                compound: {
                                    should: [
                                        {
                                            autocomplete: {
                                                query: q,
                                                path: 'title',
                                                fuzzy: { maxEdits: 1 },
                                            },
                                        },
                                        {
                                            autocomplete: {
                                                query: q,
                                                path: 'artistName',
                                                fuzzy: { maxEdits: 1 },
                                            },
                                        },
                                        {
                                            autocomplete: {
                                                query: q,
                                                path: 'albumTitle',
                                                fuzzy: { maxEdits: 1 },
                                            },
                                        },
                                    ],
                                    filter: [],
                                },
                            },
                        },
                        { $limit: 20 },
                        {
                            $project: {
                                title: 1,
                                artistName: 1,
                                albumTitle: 1,
                                durationSec: 1,
                                genres: 1,
                                albumArt: 1,
                                popularity: 1,
                                score: { $meta: 'searchScore' },
                            },
                        },
                    ];

                    // Add optional filters
                    if (artistId) {
                        (pipeline[0].$search.compound.filter as any[]).push({
                            equals: { path: 'artistId', value: artistId },
                        });
                    }

                    if (albumId) {
                        (pipeline[0].$search.compound.filter as any[]).push({
                            equals: { path: 'albumId', value: albumId },
                        });
                    }

                    if (genre) {
                        (pipeline[0].$search.compound.filter as any[]).push({
                            text: { query: genre, path: 'genres' },
                        });
                    }

                    songs = await Song.aggregate(pipeline);

                    request.log.debug({ query: q, results: songs.length }, 'Atlas Search results');
                } catch (searchError: any) {
                    // Fallback to MongoDB regex search if Atlas Search not available
                    request.log.warn(
                        { error: searchError.message },
                        'Atlas Search failed, using fallback'
                    );

                    songs = await catalogService.searchCatalogFallback(q, 20);
                }

                // Cache results
                if (songs.length > 0) {
                    await upstash.setCachedSearch(q, songs, 60);
                }

                return { songs, cached: false };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Validation failed',
                        details: error.errors,
                    });
                }

                request.log.error({ error: error.message, stack: error.stack }, 'Search failed');

                return reply.code(500).send({
                    error: 'Search failed',
                    code: 'SEARCH_ERROR',
                });
            }
        }
    );

    /**
     * POST /import/spotify/search
     * Server-side Spotify search (no auth required, uses backend secret)
     */
    fastify.post('/import/spotify/search', async (request, reply) => {
        try {
            const body = spotifySearchSchema.parse(request.body);
            const { q, limit } = body;

            if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
                return reply.code(503).send({
                    error: 'Spotify integration not configured',
                    code: 'SPOTIFY_NOT_CONFIGURED',
                });
            }

            request.log.info({ query: q }, 'Spotify search proxy');

            // Get Spotify access token (client credentials flow)
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

            // Search Spotify
            const searchResponse = await axios.get('https://api.spotify.com/v1/search', {
                params: {
                    q,
                    type: 'track',
                    limit,
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            // Transform results to trimmed format
            const tracks = searchResponse.data.tracks.items.map((track: any) => ({
                sourceId: track.id,
                title: track.name,
                artist: track.artists.map((a: any) => a.name).join(', '),
                albumName: track.album.name,
                duration: Math.round(track.duration_ms / 1000),
                albumArt: track.album.images[0]?.url,
                spotifyUrl: track.external_urls.spotify,
                popularity: track.popularity,
            }));

            request.log.debug({ query: q, results: tracks.length }, 'Spotify search results');

            return { tracks };
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    details: error.errors,
                });
            }

            request.log.error(
                { error: error.message, stack: error.stack },
                'Spotify search failed'
            );

            return reply.code(500).send({
                error: 'Spotify search failed',
                code: 'SPOTIFY_SEARCH_ERROR',
            });
        }
    });

    /**
     * POST /songs/saveFromSpotify
     * Save a Spotify track to the database with deduplication
     */
    fastify.post(
        '/saveFromSpotify',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const body = saveFromSpotifySchema.parse(request.body);
                const { trackId } = body;

                request.log.info({ trackId, userId: request.userId }, 'Saving Spotify track');

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

                // Save to database with deduplication
                const result = await catalogService.saveFromSpotifyTrack(trackData);

                request.log.info(
                    {
                        trackId,
                        inserted: result.inserted,
                        songId: result.song?._id || result.existingId,
                    },
                    'Spotify track saved'
                );

                if (result.inserted) {
                    return reply.code(201).send({
                        inserted: true,
                        song: result.song,
                        message: result.message,
                    });
                } else {
                    return {
                        inserted: false,
                        existingId: result.existingId,
                        song: result.song,
                        message: result.message,
                    };
                }
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Validation failed',
                        details: error.errors,
                    });
                }

                if (error.response?.status === 404) {
                    return reply.code(404).send({
                        error: 'Spotify track not found',
                        code: 'TRACK_NOT_FOUND',
                    });
                }

                request.log.error(
                    { error: error.message, stack: error.stack },
                    'Failed to save Spotify track'
                );

                return reply.code(500).send({
                    error: 'Failed to save track',
                    code: 'SAVE_ERROR',
                });
            }
        }
    );
}

