import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Crate } from '../models/Crate.js';
import { Event } from '../models/Event.js';
import { verifyClerkToken, requireAdmin } from '../middleware/auth.js';

const addSongSchema = z.object({
    songId: z.string(),
});

const mergeCratesSchema = z.object({
    crateIds: z.array(z.string()).min(1),
});

export async function crateRoutes(fastify: FastifyInstance) {
    // GET /api/events/:eventId/crate - Get event's crate
    fastify.get(
        '/api/events/:eventId/crate',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const { eventId } = request.params as { eventId: string };

                // Validate event exists
                const event = await Event.findById(eventId);
                if (!event) {
                    return reply.code(404).send({
                        error: 'Event not found',
                        code: 'EVENT_NOT_FOUND',
                    });
                }

                // Get or create crate
                let crate = await Crate.findOne({ eventId: new mongoose.Types.ObjectId(eventId) })
                    .populate('songIds')
                    .lean();

                if (!crate) {
                    const newCrate = await Crate.create({
                        eventId: new mongoose.Types.ObjectId(eventId),
                        songIds: [],
                    });

                    return {
                        _id: newCrate._id,
                        eventId: newCrate.eventId,
                        songIds: newCrate.songIds,
                        songs: [],
                    };
                }

                return {
                    _id: crate._id,
                    eventId: crate.eventId,
                    songIds: crate.songIds,
                    songs: crate.songIds || [],
                };
            } catch (error: any) {
                fastify.log.error('Error fetching crate:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch crate',
                    code: 'CRATE_FETCH_ERROR',
                });
            }
        }
    );

    // POST /api/events/:eventId/crate/songs - Add song to crate
    fastify.post(
        '/api/events/:eventId/crate/songs',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { eventId } = request.params as { eventId: string };
                const body = addSongSchema.parse(request.body);

                const songId = new mongoose.Types.ObjectId(body.songId);

                // Get or create crate
                let crate = await Crate.findOne({ eventId: new mongoose.Types.ObjectId(eventId) });

                if (!crate) {
                    crate = await Crate.create({
                        eventId: new mongoose.Types.ObjectId(eventId),
                        songIds: [songId],
                    });
                } else {
                    // Check for duplicate
                    if (crate.songIds.some(id => id.equals(songId))) {
                        return reply.code(409).send({
                            error: 'Song already in crate',
                            code: 'SONG_DUPLICATE',
                        });
                    }

                    crate.songIds.push(songId);
                    await crate.save();
                }

                // Populate and return
                const populated = await Crate.findById(crate._id).populate('songIds').lean();

                return {
                    _id: populated!._id,
                    eventId: populated!.eventId,
                    songIds: populated!.songIds,
                    songs: populated!.songIds,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error adding song to crate:', error);
                return reply.code(500).send({
                    error: 'Failed to add song to crate',
                    code: 'CRATE_ADD_ERROR',
                });
            }
        }
    );

    // DELETE /api/events/:eventId/crate/songs/:songId - Remove song from crate
    fastify.delete(
        '/api/events/:eventId/crate/songs/:songId',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { eventId, songId } = request.params as { eventId: string; songId: string };

                const crate = await Crate.findOne({ eventId: new mongoose.Types.ObjectId(eventId) });

                if (!crate) {
                    return reply.code(404).send({
                        error: 'Crate not found',
                        code: 'CRATE_NOT_FOUND',
                    });
                }

                crate.songIds = crate.songIds.filter(id => !id.equals(new mongoose.Types.ObjectId(songId)));
                await crate.save();

                const populated = await Crate.findById(crate._id).populate('songIds').lean();

                return {
                    _id: populated!._id,
                    eventId: populated!.eventId,
                    songIds: populated!.songIds,
                    songs: populated!.songIds,
                };
            } catch (error: any) {
                fastify.log.error('Error removing song from crate:', error);
                return reply.code(500).send({
                    error: 'Failed to remove song from crate',
                    code: 'CRATE_REMOVE_ERROR',
                });
            }
        }
    );

    // POST /api/events/:eventId/crate/merge - Merge crates
    fastify.post(
        '/api/events/:eventId/crate/merge',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { eventId } = request.params as { eventId: string };
                const body = mergeCratesSchema.parse(request.body);

                // Get target crate
                let targetCrate = await Crate.findOne({ eventId: new mongoose.Types.ObjectId(eventId) });

                if (!targetCrate) {
                    targetCrate = await Crate.create({
                        eventId: new mongoose.Types.ObjectId(eventId),
                        songIds: [],
                    });
                }

                // Fetch source crates
                const sourceCrates = await Crate.find({
                    _id: { $in: body.crateIds.map(id => new mongoose.Types.ObjectId(id)) },
                });

                let added = 0;
                let skipped = 0;
                const duplicates: string[] = [];

                // Merge songs
                for (const sourceCrate of sourceCrates) {
                    for (const songId of sourceCrate.songIds) {
                        if (targetCrate.songIds.some(id => id.equals(songId))) {
                            skipped++;
                            duplicates.push(songId.toString());
                        } else {
                            targetCrate.songIds.push(songId);
                            added++;
                        }
                    }
                }

                await targetCrate.save();

                return {
                    added,
                    skipped,
                    duplicates,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error merging crates:', error);
                return reply.code(500).send({
                    error: 'Failed to merge crates',
                    code: 'CRATE_MERGE_ERROR',
                });
            }
        }
    );
}
