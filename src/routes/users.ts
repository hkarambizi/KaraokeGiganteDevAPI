import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { User } from '../models/User.js';
import { verifyClerkToken } from '../middleware/auth.js';

const updateUserSchema = z.object({
    username: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    displayName: z.string().optional(),
    avatar: z.string().optional(),
    phoneNumber: z.string().optional(),
    email: z.string().email().optional(),
});

const searchQuerySchema = z.object({
    q: z.string().min(1),
});

export async function userRoutes(fastify: FastifyInstance) {
    // GET /api/users/me - Get current user
    fastify.get(
        '/api/users/me',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const user = request.userDoc;

                return {
                    _id: user._id,
                    clerkId: user.clerkId,
                    username: user.username, // REQUIRED per frontend
                    email: user.email, // OPTIONAL - may be null
                    phoneNumber: user.phoneNumber,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    displayName: user.displayName,
                    avatar: user.avatar,
                    role: user.role || 'singer',
                    orgId: user.orgId,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                };
            } catch (error: any) {
                fastify.log.error('Error fetching user:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch user',
                    code: 'USER_FETCH_ERROR',
                });
            }
        }
    );

    // PUT /api/users/me - Update current user
    fastify.put(
        '/api/users/me',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const body = updateUserSchema.parse(request.body);

                const user = await User.findOneAndUpdate(
                    { clerkId: request.clerkId },
                    {
                        ...body,
                        updatedAt: new Date(),
                    },
                    { new: true }
                );

                if (!user) {
                    return reply.code(404).send({
                        error: 'User not found',
                        code: 'USER_NOT_FOUND',
                    });
                }

                return {
                    _id: user._id,
                    clerkId: user.clerkId,
                    username: user.username,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    displayName: user.displayName,
                    avatar: user.avatar,
                    role: user.role,
                    orgId: user.orgId,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error updating user:', error);
                return reply.code(500).send({
                    error: 'Failed to update user',
                    code: 'USER_UPDATE_ERROR',
                });
            }
        }
    );

    // GET /api/users/search - Search users
    fastify.get(
        '/api/users/search',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const query = searchQuerySchema.parse(request.query);

                const users = await User.find({
                    $or: [
                        { username: { $regex: query.q, $options: 'i' } }, // Search by username
                        { displayName: { $regex: query.q, $options: 'i' } },
                        { firstName: { $regex: query.q, $options: 'i' } },
                        { lastName: { $regex: query.q, $options: 'i' } },
                        { email: { $regex: query.q, $options: 'i' } },
                    ],
                })
                    .limit(20)
                    .select('_id clerkId username displayName email avatar')
                    .lean();

                return users;
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid query',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error searching users:', error);
                return reply.code(500).send({
                    error: 'Failed to search users',
                    code: 'USER_SEARCH_ERROR',
                });
            }
        }
    );
}
