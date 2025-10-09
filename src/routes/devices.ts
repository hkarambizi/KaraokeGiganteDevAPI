import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Expo } from 'expo-server-sdk';
import { User } from '../models/User.js';
import { verifyClerkToken } from '../middleware/auth.js';

const registerDeviceSchema = z.object({
    token: z.string(),
    platform: z.enum(['ios', 'android', 'web']).optional(),
});

export async function deviceRoutes(fastify: FastifyInstance) {
    // POST /api/devices/register - Register device for push notifications
    fastify.post(
        '/api/devices/register',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const body = registerDeviceSchema.parse(request.body);

                // Validate Expo push token
                if (!Expo.isExpoPushToken(body.token)) {
                    return reply.code(400).send({
                        error: 'Invalid Expo push token',
                        code: 'INVALID_PUSH_TOKEN',
                    });
                }

                // Update user with push token
                await User.findOneAndUpdate(
                    { clerkId: request.clerkId },
                    {
                        pushToken: body.token,
                        updatedAt: new Date(),
                    }
                );

                fastify.log.info(`Push token registered for user ${request.clerkId}`);

                return {
                    success: true,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error registering device:', error);
                return reply.code(500).send({
                    error: 'Failed to register device',
                    code: 'DEVICE_REGISTER_ERROR',
                });
            }
        }
    );
}
