import { FastifyRequest, FastifyReply } from 'fastify';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { User } from '../models/User.js';
import { Singer } from '../models/Singer.js';
import { Host } from '../models/Host.js';
import { syncUserOrganizations } from '../services/organizationSync.js';
import { env } from '../config/env.js';

// Initialize Clerk with secret key
const clerk = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
});

// Extend FastifyRequest to include user data
declare module 'fastify' {
    interface FastifyRequest {
        userId?: string;
        clerkId?: string;
        role?: 'singer' | 'admin';
        orgId?: string;
        userDoc?: any;
    }
}

export async function verifyClerkToken(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            request.log.warn('No authorization header provided');
            return reply.code(401).send({
                error: 'Missing authorization header',
                code: 'MISSING_AUTH_HEADER',
            });
        }

        if (!authHeader.startsWith('Bearer ')) {
            request.log.warn({ authHeader: authHeader.substring(0, 20) }, 'Authorization header does not start with Bearer');
            return reply.code(401).send({
                error: 'Invalid authorization header format',
                code: 'INVALID_AUTH_HEADER',
            });
        }

        const token = authHeader.substring(7);

        if (!token || token.length < 10) {
            request.log.warn('Token is empty or too short');
            return reply.code(401).send({
                error: 'Invalid token',
                code: 'INVALID_TOKEN',
            });
        }

        // Verify the JWT token with Clerk
        let decoded;
        try {
            decoded = await verifyToken(token, {
                secretKey: env.CLERK_SECRET_KEY,
            });
        } catch (verifyError: any) {
            request.log.error({
                error: verifyError.message,
                tokenPreview: token.substring(0, 20) + '...',
            }, 'Clerk token verification failed');
            return reply.code(401).send({
                error: 'Token verification failed',
                code: 'TOKEN_VERIFICATION_FAILED',
                details: verifyError.message,
            });
        }

        if (!decoded || !decoded.sub) {
            request.log.warn({ decoded }, 'Decoded token missing sub claim');
            return reply.code(401).send({
                error: 'Invalid token payload',
                code: 'INVALID_TOKEN_PAYLOAD',
            });
        }

        // Get or create user in MongoDB
        const clerkId = decoded.sub;
        let user = await User.findOne({ clerkId });

        if (!user) {
            request.log.info({ clerkId }, 'Bootstrapping new user from Clerk');

            try {
                // Bootstrap user from Clerk data
                const clerkUser = await clerk.users.getUser(clerkId);

                // Username is REQUIRED per frontend requirements
                const username = clerkUser.username;
                if (!username) {
                    request.log.error({ clerkId }, 'User missing required username field');
                    return reply.code(400).send({
                        error: 'Username is required. Please complete your profile in the app.',
                        code: 'MISSING_USERNAME',
                    });
                }

                // Create User profile
                user = await User.create({
                    clerkId,
                    username, // REQUIRED
                    email: clerkUser.emailAddresses[0]?.emailAddress || undefined, // OPTIONAL
                    phoneNumber: clerkUser.phoneNumbers[0]?.phoneNumber || undefined, // OPTIONAL
                    firstName: clerkUser.firstName || '',
                    lastName: clerkUser.lastName || '',
                    displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || username,
                    avatar: clerkUser.imageUrl || '',
                });

                // Get organization memberships from Clerk
                const clerkOrgs = await clerk.users.getOrganizationMembershipList({
                    userId: clerkId,
                });
                const hasOrganization = clerkOrgs.data.length > 0;

                // Sync organizations from Clerk to MongoDB (auto-create missing ones)
                if (hasOrganization) {
                    try {
                        await syncUserOrganizations(clerkId);
                        request.log.debug({ clerkId }, 'Synced organizations from Clerk to MongoDB');
                    } catch (syncError: any) {
                        request.log.warn({
                            clerkId,
                            error: syncError.message,
                        }, 'Failed to sync organizations (non-fatal)');
                        // Continue with user creation even if sync fails
                    }
                }

                // Always create Singer record
                await Singer.create({
                    clerkId,
                    userId: user._id,
                    favorites: [],
                    checkIns: [],
                    friends: [],
                });

                // Create Host record if user has/will have organization access
                if (hasOrganization) {
                    await Host.create({
                        clerkId,
                        userId: user._id,
                        calendar: [],
                        imports: [],
                        currentView: 'host', // Default to host view for org members
                    });
                    request.log.info({ clerkId, userId: user._id }, 'User bootstrapped as Singer + Host (org member)');
                } else {
                    request.log.info({ clerkId, userId: user._id }, 'User bootstrapped as Singer only');
                }

            } catch (clerkError: any) {
                request.log.error({
                    clerkId,
                    error: clerkError.message,
                }, 'Failed to fetch user from Clerk');
                return reply.code(401).send({
                    error: 'Failed to fetch user data',
                    code: 'USER_FETCH_FAILED',
                });
            }
        }

        // Check if user is a Host (has access to admin features)
        const host = await Host.findOne({ clerkId });
        const isHost = !!host;

        // Determine role and view based on Host record and preference
        let role: 'singer' | 'admin' = 'singer';
        let activeView: 'host' | 'guest' = 'guest';

        if (isHost && host) {
            // User is a Host - check their view preference
            activeView = host.currentView || 'host';
            role = activeView === 'host' ? 'admin' : 'singer';
        }

        // Get activeOrgId from Clerk if user is admin
        let activeOrgId: string | undefined;
        if (role === 'admin') {
            const clerkOrgs = await clerk.users.getOrganizationMembershipList({
                userId: clerkId,
            });
            activeOrgId = clerkOrgs.data[0]?.organization.id;
        }

        // Attach user data to request
        request.userId = (user._id as any).toString();
        request.clerkId = clerkId;
        request.role = role;
        request.orgId = activeOrgId;
        request.userDoc = user;

        request.log.debug({
            clerkId,
            userId: request.userId,
            role: request.role,
        }, 'Authentication successful');
    } catch (error: any) {
        request.log.error({
            error: error.message,
            stack: error.stack,
        }, 'Unexpected authentication error');
        return reply.code(401).send({
            error: 'Authentication failed',
            code: 'AUTH_FAILED',
            details: env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
}

export async function requireAdmin(
    request: FastifyRequest,
    reply: FastifyReply
) {
    if (request.role !== 'admin') {
        return reply.code(403).send({
            error: 'Admin access required',
            code: 'INSUFFICIENT_PERMISSIONS',
        });
    }
}

export async function requireOrgMember(orgId: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (request.role !== 'admin' || request.orgId !== orgId) {
            return reply.code(403).send({
                error: 'Organization membership required',
                code: 'NOT_ORG_MEMBER',
            });
        }
    };
}
