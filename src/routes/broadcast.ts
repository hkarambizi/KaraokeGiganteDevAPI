import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyClerkToken, requireAdmin } from '../middleware/auth.js';
import { sendBroadcastNotification } from '../services/notifications.js';

const broadcastSchema = z.object({
    eventId: z.string().optional(),
    message: z.string().min(1),
});

export async function broadcastRoutes(fastify: FastifyInstance) {
    // POST /api/broadcast - Send broadcast notification (admin only)
    fastify.post(
        '/api/broadcast',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const body = broadcastSchema.parse(request.body);

                const sent = await sendBroadcastNotification({
                    title: 'Announcement 📢',
                    body: body.message,
                    data: {
                        eventId: body.eventId,
                        type: 'broadcast',
                    },
                });

                return {
                    sent,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error sending broadcast:', error);
                return reply.code(500).send({
                    error: 'Failed to send broadcast',
                    code: 'BROADCAST_ERROR',
                });
            }
        }
    );
}
