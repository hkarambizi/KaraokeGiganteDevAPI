import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Request } from '../models/Request.js';
import { Event } from '../models/Event.js';
import { Crate } from '../models/Crate.js';
import { verifyClerkToken, requireAdmin } from '../middleware/auth.js';
import { sendPushNotification } from '../services/notifications.js';

const createRequestSchema = z.object({
    songId: z.string(),
    coSingers: z.array(z.string()).optional().default([]),
});

const approveRequestSchema = z.object({
    addToCrate: z.boolean().optional().default(false),
});

const rejectRequestSchema = z.object({
    reason: z.string().min(1),
});

const updateVideoSchema = z.object({
    videoUrl: z.string().url(),
});

export async function requestRoutes(fastify: FastifyInstance) {
    // POST /api/events/:eventId/requests - Create song request
    fastify.post(
        '/api/events/:eventId/requests',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const { eventId } = request.params as { eventId: string };
                const body = createRequestSchema.parse(request.body);

                // Validate event exists
                const event = await Event.findById(eventId);
                if (!event) {
                    return reply.code(404).send({
                        error: 'Event not found',
                        code: 'EVENT_NOT_FOUND',
                    });
                }

                // Check if song is in crate
                const crate = await Crate.findOne({ eventId: new mongoose.Types.ObjectId(eventId) });
                const inCrate = crate?.songIds.some(id => id.toString() === body.songId) || false;

                // Create request
                const songRequest = await Request.create({
                    eventId: new mongoose.Types.ObjectId(eventId),
                    songId: new mongoose.Types.ObjectId(body.songId),
                    userId: request.clerkId!,
                    coSingers: body.coSingers.map(id => new mongoose.Types.ObjectId(id)),
                    status: 'pending_admin',
                    inCrate,
                });

                return songRequest;
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error creating request:', error);
                return reply.code(500).send({
                    error: 'Failed to create request',
                    code: 'REQUEST_CREATE_ERROR',
                });
            }
        }
    );

    // GET /api/events/:eventId/requests - List requests
    fastify.get(
        '/api/events/:eventId/requests',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const { eventId } = request.params as { eventId: string };
                const query = request.query as { status?: string; inCrate?: string };

                const filter: any = { eventId: new mongoose.Types.ObjectId(eventId) };

                if (query.status) {
                    filter.status = query.status;
                }

                if (query.inCrate !== undefined) {
                    filter.inCrate = query.inCrate === 'true';
                }

                const requests = await Request.find(filter)
                    .populate('songId')
                    .populate('userId', '_id clerkId displayName email avatar')
                    .populate('coSingers', '_id clerkId displayName email avatar')
                    .sort({ createdAt: -1 })
                    .lean();

                // Transform to match frontend expectations
                const transformed = requests.map((req: any) => ({
                    ...req,
                    song: req.songId,
                    user: req.userId,
                    coSingersData: req.coSingers,
                }));

                return transformed;
            } catch (error: any) {
                fastify.log.error('Error fetching requests:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch requests',
                    code: 'REQUEST_FETCH_ERROR',
                });
            }
        }
    );

    // GET /api/events/:eventId/queue - Get queue with positions
    fastify.get(
        '/api/events/:eventId/queue',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const { eventId } = request.params as { eventId: string };

                const requests = await Request.find({
                    eventId: new mongoose.Types.ObjectId(eventId),
                    status: { $in: ['approved', 'queued'] },
                })
                    .populate('songId')
                    .populate('userId', '_id clerkId displayName email avatar')
                    .populate('coSingers', '_id clerkId displayName email avatar')
                    .sort({ createdAt: 1 })
                    .lean();

                // Add queue positions
                const withPositions = requests.map((req: any, index: number) => ({
                    ...req,
                    queuePosition: index + 1,
                    song: req.songId,
                    user: req.userId,
                    coSingersData: req.coSingers,
                }));

                return withPositions;
            } catch (error: any) {
                fastify.log.error('Error fetching queue:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch queue',
                    code: 'QUEUE_FETCH_ERROR',
                });
            }
        }
    );

    // POST /api/events/:eventId/requests/:requestId/approve - Approve request
    fastify.post(
        '/api/events/:eventId/requests/:requestId/approve',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { eventId, requestId } = request.params as { eventId: string; requestId: string };
                const body = approveRequestSchema.parse(request.body);

                const songRequest = await Request.findById(requestId);
                if (!songRequest) {
                    return reply.code(404).send({
                        error: 'Request not found',
                        code: 'REQUEST_NOT_FOUND',
                    });
                }

                // Update status
                songRequest.status = 'approved';
                await songRequest.save();

                // Add to crate if requested
                if (body.addToCrate) {
                    let crate = await Crate.findOne({ eventId: new mongoose.Types.ObjectId(eventId) });

                    if (!crate) {
                        crate = await Crate.create({
                            eventId: new mongoose.Types.ObjectId(eventId),
                            songIds: [songRequest.songId],
                        });
                    } else if (!crate.songIds.some(id => id.equals(songRequest.songId))) {
                        crate.songIds.push(songRequest.songId);
                        await crate.save();
                    }

                    songRequest.inCrate = true;
                    await songRequest.save();
                }

                // Send push notification
                await sendPushNotification(songRequest.userId, {
                    title: 'Song Approved! 🎤',
                    body: 'Your song request has been approved',
                    data: { requestId: (songRequest._id as any).toString(), type: 'approval' },
                });

                return songRequest;
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error approving request:', error);
                return reply.code(500).send({
                    error: 'Failed to approve request',
                    code: 'REQUEST_APPROVE_ERROR',
                });
            }
        }
    );

    // POST /api/events/:eventId/requests/:requestId/reject - Reject request
    fastify.post(
        '/api/events/:eventId/requests/:requestId/reject',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { requestId } = request.params as { eventId: string; requestId: string };
                const body = rejectRequestSchema.parse(request.body);

                const songRequest = await Request.findById(requestId);
                if (!songRequest) {
                    return reply.code(404).send({
                        error: 'Request not found',
                        code: 'REQUEST_NOT_FOUND',
                    });
                }

                songRequest.status = 'rejected';
                songRequest.rejectionReason = body.reason;
                await songRequest.save();

                // Send push notification
                await sendPushNotification(songRequest.userId, {
                    title: 'Song Request Update',
                    body: `Your request was declined: ${body.reason}`,
                    data: { requestId: (songRequest._id as any).toString(), type: 'rejection' },
                });

                return songRequest;
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error rejecting request:', error);
                return reply.code(500).send({
                    error: 'Failed to reject request',
                    code: 'REQUEST_REJECT_ERROR',
                });
            }
        }
    );

    // PUT /api/events/:eventId/requests/:requestId/video - Update video URL
    fastify.put(
        '/api/events/:eventId/requests/:requestId/video',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { requestId } = request.params as { eventId: string; requestId: string };
                const body = updateVideoSchema.parse(request.body);

                const songRequest = await Request.findByIdAndUpdate(
                    requestId,
                    { videoUrl: body.videoUrl, updatedAt: new Date() },
                    { new: true }
                );

                if (!songRequest) {
                    return reply.code(404).send({
                        error: 'Request not found',
                        code: 'REQUEST_NOT_FOUND',
                    });
                }

                return songRequest;
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error updating video URL:', error);
                return reply.code(500).send({
                    error: 'Failed to update video URL',
                    code: 'VIDEO_UPDATE_ERROR',
                });
            }
        }
    );
}
