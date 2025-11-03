import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { Song } from '../models/Song.js';
import { verifyClerkToken, requireAdmin } from '../middleware/auth.js';
import * as upstash from '../services/upstashClient.js';
import * as csvParser from '../services/csvParser.js';
import * as catalogService from '../services/catalogService.js';

// Validation schemas
const addToPlaylistSchema = z.object({
    songId: z.string().min(1, 'Song ID is required'),
});

const csvPreviewSchema = z.object({
    csvData: z.string().min(1, 'CSV data is required'),
});

const csvCommitSchema = z.object({
    draftId: z.string().min(1, 'Draft ID is required'),
    playlistName: z.string().optional(),
});

export async function importRoutes(fastify: FastifyInstance) {
    /**
     * POST /admin/imports/playlist/add
     * Add a song to the user's import playlist (Redis SET)
     */
    fastify.post(
        '/playlist/add',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const body = addToPlaylistSchema.parse(request.body);
                const { songId } = body;

                // Verify song exists
                const song = await Song.findById(songId);

                if (!song) {
                    return reply.code(404).send({
                        error: 'Song not found',
                        code: 'SONG_NOT_FOUND',
                    });
                }

                // Add to Redis SET
                const result = await upstash.addToPlaylist(request.userId!, songId);

                request.log.info(
                    { userId: request.userId, songId, total: result.total },
                    'Song added to import playlist'
                );

                return {
                    added: result.added,
                    total: result.total,
                    songId,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Validation failed',
                        details: error.errors,
                    });
                }

                request.log.error(
                    { error: error.message, stack: error.stack },
                    'Failed to add to playlist'
                );

                return reply.code(500).send({
                    error: 'Failed to add song to playlist',
                    code: 'ADD_ERROR',
                });
            }
        }
    );

    /**
     * GET /admin/imports/playlist
     * Get all songs in the user's import playlist
     */
    fastify.get(
        '/playlist',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const songIds = await upstash.getPlaylist(request.userId!);

                if (songIds.length === 0) {
                    return {
                        songs: [],
                        total: 0,
                    };
                }

                // Fetch song details from MongoDB
                const songs = await Song.find({ _id: { $in: songIds } })
                    .select('title artistName albumTitle durationSec albumArt genres')
                    .lean();

                return {
                    songs,
                    total: songs.length,
                };
            } catch (error: any) {
                request.log.error(
                    { error: error.message, stack: error.stack },
                    'Failed to get playlist'
                );

                return reply.code(500).send({
                    error: 'Failed to get playlist',
                    code: 'GET_ERROR',
                });
            }
        }
    );

    /**
     * DELETE /admin/imports/playlist/:songId
     * Remove a song from the user's import playlist
     */
    fastify.delete(
        '/playlist/:songId',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { songId } = request.params as { songId: string };

                const result = await upstash.removeFromPlaylist(request.userId!, songId);

                request.log.info(
                    { userId: request.userId, songId, total: result.total },
                    'Song removed from import playlist'
                );

                return {
                    removed: result.removed,
                    total: result.total,
                };
            } catch (error: any) {
                request.log.error(
                    { error: error.message, stack: error.stack },
                    'Failed to remove from playlist'
                );

                return reply.code(500).send({
                    error: 'Failed to remove song',
                    code: 'REMOVE_ERROR',
                });
            }
        }
    );

    /**
     * DELETE /admin/imports/playlist
     * Clear all songs from the user's import playlist
     */
    fastify.delete(
        '/playlist',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const cleared = await upstash.clearPlaylist(request.userId!);

                if (!cleared) {
                    request.log.error({ userId: request.userId }, 'Failed to clear import playlist (Upstash returned false)');
                    return reply.code(500).send({
                        error: 'Failed to clear playlist',
                        code: 'CLEAR_FAILED',
                    });
                }

                request.log.info({ userId: request.userId }, 'Import playlist cleared');

                return {
                    success: true,
                    message: 'Playlist cleared',
                };
            } catch (error: any) {
                request.log.error(
                    { error: error.message, stack: error.stack },
                    'Failed to clear playlist'
                );

                return reply.code(500).send({
                    error: 'Failed to clear playlist',
                    code: 'CLEAR_ERROR',
                });
            }
        }
    );

    /**
     * POST /admin/imports/csv/preview
     * Parse CSV and create a preview draft (stored in Redis for 24h)
     */
    fastify.post(
        '/csv/preview',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const body = csvPreviewSchema.parse(request.body);
                const { csvData } = body;

                request.log.info({ userId: request.userId }, 'Parsing CSV preview');

                // Parse CSV
                const parseResult = csvParser.parseCSV(csvData);

                if (!parseResult.success) {
                    return reply.code(400).send({
                        error: 'CSV parsing failed',
                        errors: parseResult.errors,
                        code: 'PARSE_ERROR',
                    });
                }

                // Generate draft ID
                const draftId = crypto.randomBytes(16).toString('hex');

                // Save draft to Redis (24h TTL)
                const saved = await upstash.saveDraft(request.userId!, draftId, {
                    songs: parseResult.songs,
                });

                if (!saved) {
                    request.log.error({ userId: request.userId, draftId }, 'Failed to save CSV draft (Upstash returned false)');
                    return reply.code(500).send({
                        error: 'Failed to save draft',
                        code: 'DRAFT_SAVE_FAILED',
                    });
                }

                request.log.info(
                    {
                        userId: request.userId,
                        draftId,
                        totalRows: parseResult.totalRows,
                        validRows: parseResult.validRows,
                    },
                    'CSV preview created'
                );

                return {
                    draftId,
                    preview: parseResult.songs.slice(0, 10), // First 10 for preview
                    totalRows: parseResult.totalRows,
                    validRows: parseResult.validRows,
                    invalidRows: parseResult.invalidRows,
                    errors: parseResult.errors,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Validation failed',
                        details: error.errors,
                    });
                }

                request.log.error(
                    { error: error.message, stack: error.stack },
                    'CSV preview failed'
                );

                return reply.code(500).send({
                    error: 'CSV preview failed',
                    code: 'PREVIEW_ERROR',
                });
            }
        }
    );

    /**
     * POST /admin/imports/csv/commit
     * Commit a CSV draft to the database and add to import playlist
     */
    fastify.post(
        '/csv/commit',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const body = csvCommitSchema.parse(request.body);
                const { draftId } = body;

                request.log.info({ userId: request.userId, draftId }, 'Committing CSV import');

                // Load draft from Redis
                const draft = await upstash.getDraft(request.userId!, draftId);

                if (!draft) {
                    return reply.code(404).send({
                        error: 'Draft not found or expired',
                        code: 'DRAFT_NOT_FOUND',
                    });
                }

                // Validate songs
                const { valid, invalid } = csvParser.validateSongs(draft.songs);

                request.log.info(
                    { validCount: valid.length, invalidCount: invalid.length },
                    'Songs validated'
                );

                const results = {
                    inserted: 0,
                    updated: 0,
                    errors: [] as Array<{ row: number; message: string }>,
                    songIds: [] as string[],
                };

                // Process each valid song
                for (const parsedSong of valid) {
                    try {
                        const result = await catalogService.saveFromCSVData(
                            parsedSong,
                            request.userId!
                        );

                        if (result.inserted) {
                            results.inserted++;
                            if (result.song) {
                                results.songIds.push((result.song._id as any).toString());
                            }
                        } else {
                            results.updated++;
                            if (result.existingId) {
                                results.songIds.push(result.existingId);
                            }
                        }
                    } catch (error: any) {
                        results.errors.push({
                            row: parsedSong.rowNumber,
                            message: error.message,
                        });
                    }
                }

                // Add all successful song IDs to import playlist
                for (const songId of results.songIds) {
                    await upstash.addToPlaylist(request.userId!, songId);
                }

                // Delete draft
                await upstash.deleteDraft(request.userId!, draftId);

                request.log.info(
                    {
                        userId: request.userId,
                        draftId,
                        inserted: results.inserted,
                        updated: results.updated,
                        errors: results.errors.length,
                    },
                    'CSV import committed'
                );

                return {
                    success: true,
                    inserted: results.inserted,
                    updated: results.updated,
                    errors: results.errors,
                    totalSaved: results.songIds.length,
                    invalidSongs: invalid.length,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Validation failed',
                        details: error.errors,
                    });
                }

                request.log.error(
                    { error: error.message, stack: error.stack },
                    'CSV commit failed'
                );

                return reply.code(500).send({
                    error: 'CSV commit failed',
                    code: 'COMMIT_ERROR',
                });
            }
        }
    );
}

