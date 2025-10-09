import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Event } from '../models/Event.js';
import { verifyClerkToken, requireAdmin } from '../middleware/auth.js';

const createEventSchema = z.object({
    name: z.string().min(1),
    date: z.string().datetime(),
    venue: z.string().optional(),
});

const updateEventSchema = z.object({
    name: z.string().optional(),
    date: z.string().datetime().optional(),
    venue: z.string().optional(),
    status: z.enum(['draft', 'active', 'closed']).optional(),
});

export async function eventRoutes(fastify: FastifyInstance) {
    // GET /api/events - List all events (admin only)
    fastify.get(
        '/api/events',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const events = await Event.find({ orgId: request.orgId })
                    .sort({ date: -1 })
                    .lean();

                return events;
            } catch (error: any) {
                fastify.log.error('Error fetching events:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch events',
                    code: 'EVENT_FETCH_ERROR',
                });
            }
        }
    );

    // POST /api/events - Create event (admin only)
    fastify.post(
        '/api/events',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const body = createEventSchema.parse(request.body);

                const event = await Event.create({
                    ...body,
                    date: new Date(body.date),
                    orgId: request.orgId!,
                    createdBy: request.clerkId!,
                    status: 'draft',
                });

                return event;
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error creating event:', error);
                return reply.code(500).send({
                    error: 'Failed to create event',
                    code: 'EVENT_CREATE_ERROR',
                });
            }
        }
    );

    // GET /api/events/active - Get currently active event (singers)
    fastify.get(
        '/api/events/active',
        {
            preHandler: verifyClerkToken,
        },
        async (_request, reply) => {
            try {
                const event = await Event.findOne({ status: 'active' })
                    .sort({ date: 1 })
                    .lean();

                return event || null;
            } catch (error: any) {
                fastify.log.error('Error fetching active event:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch active event',
                    code: 'EVENT_FETCH_ERROR',
                });
            }
        }
    );

    // GET /api/events/:id - Get specific event
    fastify.get(
        '/api/events/:id',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const { id } = request.params as { id: string };

                const event = await Event.findById(id).lean();

                if (!event) {
                    return reply.code(404).send({
                        error: 'Event not found',
                        code: 'EVENT_NOT_FOUND',
                    });
                }

                return event;
            } catch (error: any) {
                fastify.log.error('Error fetching event:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch event',
                    code: 'EVENT_FETCH_ERROR',
                });
            }
        }
    );

    // PATCH /api/events/:id - Update event (admin only)
    fastify.patch(
        '/api/events/:id',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { id } = request.params as { id: string };
                const body = updateEventSchema.parse(request.body);

                const event = await Event.findOneAndUpdate(
                    { _id: id, orgId: request.orgId },
                    {
                        ...body,
                        ...(body.date && { date: new Date(body.date) }),
                        updatedAt: new Date(),
                    },
                    { new: true }
                );

                if (!event) {
                    return reply.code(404).send({
                        error: 'Event not found',
                        code: 'EVENT_NOT_FOUND',
                    });
                }

                return event;
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error updating event:', error);
                return reply.code(500).send({
                    error: 'Failed to update event',
                    code: 'EVENT_UPDATE_ERROR',
                });
            }
        }
    );
}
