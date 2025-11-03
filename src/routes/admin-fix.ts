import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createClerkClient } from '@clerk/backend';
import { User } from '../models/User.js';
import { Singer } from '../models/Singer.js';
import { Host } from '../models/Host.js';
import { verifyClerkToken } from '../middleware/auth.js';
import { env } from '../config/env.js';

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// Validation schemas
const switchViewSchema = z.object({
    view: z.enum(['host', 'guest'], {
        errorMap: () => ({ message: "View must be 'host' or 'guest'" }),
    }),
});

export async function adminFixRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/admin/force-promote
     * Promote ANY user to Host (admin access)
     * Creates Host record if it doesn't exist
     */
    fastify.post(
        '/force-promote',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const clerkId = request.clerkId!;

                request.log.info({ clerkId }, 'Force promoting user to Host');

                // Get user from MongoDB
                const user = await User.findOne({ clerkId });

                if (!user) {
                    return reply.code(404).send({
                        error: 'User not found',
                        code: 'USER_NOT_FOUND',
                    });
                }

                // Check if Host record already exists
                let host = await Host.findOne({ clerkId });

                if (!host) {
                    // Create Host record
                    host = await Host.create({
                        clerkId,
                        userId: user._id,
                        calendar: [],
                        imports: [],
                        currentView: 'host',
                    });
                    request.log.info({ clerkId, userId: user._id }, 'Host record created');
                } else {
                    // Set view to host
                    host.currentView = 'host';
                    await host.save();
                    request.log.info({ clerkId }, 'Host record already exists, set to host view');
                }

                // Get user's organizations from Clerk
                const clerkOrgs = await clerk.users.getOrganizationMembershipList({
                    userId: clerkId,
                });

                return {
                    success: true,
                    message: 'User promoted to Host successfully',
                    isHost: true,
                    currentView: 'host',
                    hasOrganizations: clerkOrgs.data.length > 0,
                };
            } catch (error: any) {
                request.log.error({ error: error.message }, 'Failed to promote user');

                return reply.code(500).send({
                    error: 'Failed to promote user',
                    code: 'PROMOTE_ERROR',
                });
            }
        }
    );

    /**
     * GET /api/admin/check-role
     * Check user's role status (Host, Singer, or both)
     */
    fastify.get(
        '/check-role',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const clerkId = request.clerkId!;

                // Get user from MongoDB
                const user = await User.findOne({ clerkId });

                if (!user) {
                    return reply.code(404).send({
                        error: 'User not found',
                        code: 'USER_NOT_FOUND',
                    });
                }

                // Check for Singer and Host records
                const singer = await Singer.findOne({ clerkId });
                const host = await Host.findOne({ clerkId });

                // Get organizations
                const clerkOrgs = await clerk.users.getOrganizationMembershipList({
                    userId: clerkId,
                });

                return {
                    isSinger: !!singer,
                    isHost: !!host,
                    currentView: host?.currentView || 'guest',
                    effectiveRole: host && host.currentView === 'host' ? 'admin' : 'singer',
                    clerkOrganizations: clerkOrgs.data.map((m) => ({
                        id: m.organization.id,
                        name: m.organization.name,
                        role: m.role,
                    })),
                };
            } catch (error: any) {
                request.log.error({ error: error.message }, 'Failed to check role');

                return reply.code(500).send({
                    error: 'Failed to check role',
                    code: 'CHECK_ERROR',
                });
            }
        }
    );

    /**
     * POST /api/admin/switch-view
     * Switch between Host View (admin routes) and Guest View (singer routes)
     * Only works if user has a Host record
     */
    fastify.post(
        '/switch-view',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const body = switchViewSchema.parse(request.body);
                const { view } = body;
                const clerkId = request.clerkId!;

                request.log.info({ clerkId, newView: view }, 'Switching user view');

                // Check if user has Host record
                const host = await Host.findOne({ clerkId });

                if (!host) {
                    return reply.code(403).send({
                        error: 'User is not a Host. Only Hosts can switch views.',
                        code: 'NOT_HOST',
                    });
                }

                // Update view preference
                host.currentView = view;
                await host.save();

                request.log.info(
                    { clerkId, newView: view },
                    'User view switched successfully'
                );

                return {
                    success: true,
                    message: `View switched to ${view === 'host' ? 'Host View' : 'Guest View'}`,
                    currentView: view,
                    effectiveRole: view === 'host' ? 'admin' : 'singer',
                    viewMode: view === 'host' ? 'Admin Portal' : 'Singer Experience',
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Validation failed',
                        details: error.errors,
                    });
                }

                request.log.error({ error: error.message }, 'Failed to switch view');

                return reply.code(500).send({
                    error: 'Failed to switch view',
                    code: 'SWITCH_ERROR',
                });
            }
        }
    );
}
