import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Song } from '../models/Song.js';
import { verifyClerkToken } from '../middleware/auth.js';

const searchQuerySchema = z.object({
    q: z.string().min(1),
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('20'),
});

function normalizeString(str: string): string {
    return str.toLowerCase().trim().replace(/[^\w\s]/g, '');
}

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

                // Search using text index or regex
                const searchRegex = new RegExp(query.q, 'i');
                const songs = await Song.find({
                    $or: [
                        { title: searchRegex },
                        { artists: searchRegex },
                        { album: searchRegex },
                    ],
                })
                    .skip(skip)
                    .limit(limit)
                    .select('_id spotifyId title artists album coverArt durationMs videoUrl')
                    .lean();

                const total = await Song.countDocuments({
                    $or: [
                        { title: searchRegex },
                        { artists: searchRegex },
                        { album: searchRegex },
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

    // POST /api/songs/saveFromSpotify - Save song from Spotify
    fastify.post(
        '/api/songs/saveFromSpotify',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const body = request.body as {
                    trackId: string;
                    title: string;
                    artists: string[];
                    album?: string;
                    coverArt?: string;
                    durationMs?: number;
                };

                const { trackId, title, artists, album, coverArt, durationMs } = body;

                if (!trackId || !title || !artists || artists.length === 0) {
                    return reply.code(400).send({
                        error: 'Missing required fields',
                        code: 'MISSING_FIELDS',
                    });
                }

                const titleNorm = normalizeString(title);
                const artistNorm = normalizeString(artists.join(' '));

                // Check for duplicate
                const existing = await Song.findOne({
                    source: 'spotify',
                    sourceId: trackId,
                    titleNorm,
                    artistNorm,
                });

                if (existing) {
                    return {
                        duplicate: true,
                        song: existing,
                    };
                }

                const song = await Song.create({
                    spotifyId: trackId,
                    source: 'spotify',
                    sourceId: trackId,
                    title,
                    titleNorm,
                    artists,
                    artistNorm,
                    album,
                    coverArt,
                    durationMs,
                });

                return {
                    duplicate: false,
                    song,
                };
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
