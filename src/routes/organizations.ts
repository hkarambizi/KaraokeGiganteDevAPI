import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import mongoose from 'mongoose';
import { createClerkClient } from '@clerk/backend';
import { Organization } from '../models/Organization.js';
import { OrganizationInvite } from '../models/OrganizationInvite.js';
import { User } from '../models/User.js';
import { Host } from '../models/Host.js';
import { syncOrganizationsFromClerk } from '../services/organizationSync.js';
import { verifyClerkToken, requireAdmin } from '../middleware/auth.js';
import { env } from '../config/env.js';

const clerk = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
});

const createOrgSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'),
    logoUrl: z.string().url().optional(),
});

const sendInviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'member']).default('member'),
});

export async function organizationRoutes(fastify: FastifyInstance) {
    // POST /api/orgs - Create organization and set user as admin
    fastify.post(
        '/api/orgs',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const body = createOrgSchema.parse(request.body);
                const clerkId = request.clerkId!;

                // Check for duplicate slug in MongoDB first
                const existingOrg = await Organization.findOne({ slug: body.slug });
                if (existingOrg) {
                    return reply.code(409).send({
                        error: 'Organization slug already exists',
                        code: 'SLUG_EXISTS',
                    });
                }

                // Create Clerk organization (map Clerk conflicts to 409)
                let clerkOrg: any;
                try {
                    clerkOrg = await clerk.organizations.createOrganization({
                        name: body.name,
                        slug: body.slug,
                        createdBy: clerkId,
                    });
                } catch (clerkError: any) {
                    request.log.error({
                        clerkId,
                        name: body.name,
                        slug: body.slug,
                        error: clerkError?.message,
                        status: clerkError?.status,
                        data: clerkError?.data,
                    }, 'Clerk createOrganization failed');

                    // If Clerk reports slug conflict, return 409 to frontend
                    const message = String(clerkError?.message || '').toLowerCase();
                    if (clerkError?.status === 409 || message.includes('slug') || message.includes('already in use')) {
                        return reply.code(409).send({
                            error: 'Organization slug already exists in Clerk',
                            code: 'SLUG_EXISTS_CLERK',
                        });
                    }

                    return reply.code(502).send({
                        error: 'Failed to create organization in Clerk',
                        code: 'CLERK_ORG_CREATE_FAILED',
                        details: env.NODE_ENV === 'development' ? clerkError?.message : undefined,
                    });
                }

                // Add user as admin member in Clerk (skip if already a member)
                try {
                    // Check if membership already exists
                    try {
                        const existingMemberships = await clerk.organizations.getOrganizationMembershipList({
                            organizationId: clerkOrg.id,
                        });
                        const alreadyMember = existingMemberships.data?.some(m => m.publicUserData?.userId === clerkId);
                        if (!alreadyMember) {
                            await clerk.organizations.createOrganizationMembership({
                                organizationId: clerkOrg.id,
                                userId: clerkId,
                                role: 'org:admin',
                            });
                        } else {
                            fastify.log.info({ clerkId, organizationId: clerkOrg.id }, 'User already a member of organization; skipping membership create');
                        }
                    } catch (listError: any) {
                        // If listing fails, attempt to create membership directly
                        fastify.log.warn({
                            organizationId: clerkOrg.id,
                            error: listError?.message,
                        }, 'Failed to list memberships; attempting membership create');
                        await clerk.organizations.createOrganizationMembership({
                            organizationId: clerkOrg.id,
                            userId: clerkId,
                            role: 'org:admin',
                        });
                    }
                } catch (membershipError: any) {
                    request.log.error({
                        clerkId,
                        organizationId: clerkOrg?.id,
                        error: membershipError?.message,
                        status: membershipError?.status,
                        data: membershipError?.data,
                    }, 'Clerk createOrganizationMembership failed');

                    // If Clerk indicates membership exists, continue as success
                    const msg = String(membershipError?.message || '').toLowerCase();
                    if (membershipError?.status === 409 || msg.includes('already') || msg.includes('exists')) {
                        fastify.log.info({ clerkId, organizationId: clerkOrg.id }, 'Membership already exists; proceeding');
                    } else {
                        // Partial success: org created but membership failed - return org so frontend can recover
                        return reply.code(502).send({
                            error: 'Failed to add admin membership in Clerk',
                            code: 'CLERK_MEMBERSHIP_CREATE_FAILED',
                            details: env.NODE_ENV === 'development' ? membershipError?.message : undefined,
                            partial: true,
                            organization: {
                                clerkOrgId: clerkOrg.id,
                                name: body.name,
                                slug: body.slug,
                            },
                        });
                    }
                }

                // Create organization in MongoDB
                const org = await Organization.create({
                    clerkOrgId: clerkOrg.id,
                    name: body.name,
                    slug: body.slug,
                    logoUrl: body.logoUrl,
                    createdBy: clerkId,
                });

                // Get user record
                const user = await User.findOne({ clerkId });
                if (!user) {
                    return reply.code(404).send({
                        error: 'User not found',
                        code: 'USER_NOT_FOUND',
                    });
                }

                // Create Host record if it doesn't exist
                let host = await Host.findOne({ clerkId });
                if (!host) {
                    host = await Host.create({
                        clerkId,
                        userId: user._id,
                        calendar: [],
                        imports: [],
                        currentView: 'host',
                    });
                    fastify.log.info(`Host record created for user ${clerkId}`);
                } else {
                    host.currentView = 'host';
                    await host.save();
                }

                fastify.log.info(`Organization created: ${clerkOrg.id} by ${clerkId}`);

                return {
                    _id: org._id,
                    clerkOrgId: clerkOrg.id,
                    name: body.name,
                    slug: body.slug,
                    logoUrl: body.logoUrl,
                    createdBy: clerkId,
                    createdAt: org.createdAt,
                    updatedAt: org.updatedAt,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error({
                    error: error?.message,
                    stack: error?.stack,
                }, 'Error creating organization');
                return reply.code(500).send({
                    error: 'Failed to create organization',
                    code: 'ORG_CREATE_ERROR',
                    details: env.NODE_ENV === 'development' ? error?.message : undefined,
                });
            }
        }
    );

    // GET /api/orgs/my - List my organizations
    fastify.get(
        '/api/orgs/my',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const clerkId = request.clerkId!;

                // Get user's organizations from Clerk
                const clerkOrgs = await clerk.users.getOrganizationMembershipList({
                    userId: clerkId,
                });

                fastify.log.debug({
                    clerkId,
                    clerkOrgCount: clerkOrgs.data.length,
                    clerkOrgIds: clerkOrgs.data.map(m => m.organization.id),
                }, 'Fetched Clerk organizations');

                // Sync missing organizations from Clerk to MongoDB
                const clerkOrgIds = clerkOrgs.data.map(m => m.organization.id);
                if (clerkOrgIds.length > 0) {
                    try {
                        // Pass clerkId so sync can use user's MongoDB _id for createdBy
                        await syncOrganizationsFromClerk(clerkOrgIds, clerkId);
                        fastify.log.debug({ clerkOrgIds, clerkId }, 'Synced organizations from Clerk to MongoDB');
                    } catch (syncError: any) {
                        fastify.log.warn({
                            clerkId,
                            clerkOrgIds,
                            error: syncError.message,
                            stack: syncError.stack,
                        }, 'Failed to sync organizations (non-fatal)');
                        // Continue even if sync fails
                    }
                }

                // Fetch corresponding MongoDB records (should all exist now after sync)
                const orgs = await Organization.find({ clerkOrgId: { $in: clerkOrgIds } }).lean();

                fastify.log.debug({
                    clerkId,
                    clerkOrgCount: clerkOrgIds.length,
                    mongoOrgCount: orgs.length,
                    clerkOrgIds,
                    mongoOrgIds: orgs.map(o => o.clerkOrgId),
                }, 'Fetched MongoDB organizations');

                // If MongoDB returns fewer orgs than Clerk, there might be a sync issue
                // Return MongoDB records, but log the mismatch
                if (orgs.length < clerkOrgIds.length) {
                    fastify.log.warn({
                        clerkId,
                        clerkOrgCount: clerkOrgIds.length,
                        mongoOrgCount: orgs.length,
                        missingOrgIds: clerkOrgIds.filter(id => !orgs.some(o => o.clerkOrgId === id)),
                    }, 'Mismatch: Clerk has more organizations than MongoDB');
                }

                // Return MongoDB organizations (empty array if none found)
                return orgs;
            } catch (error: any) {
                fastify.log.error({
                    err: error,
                    stack: error.stack,
                    clerkId: request.clerkId,
                }, 'Error fetching user organizations');
                return reply.code(500).send({
                    error: 'Failed to fetch organizations',
                    code: 'ORG_FETCH_ERROR',
                    details: env.NODE_ENV === 'development' ? error.message : undefined,
                });
            }
        }
    );

    // GET /api/orgs/:orgId - Get specific organization
    fastify.get(
        '/api/orgs/:orgId',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const { orgId } = request.params as { orgId: string };

                const org = await Organization.findById(orgId).lean();

                if (!org) {
                    return reply.code(404).send({
                        error: 'Organization not found',
                        code: 'ORG_NOT_FOUND',
                    });
                }

                // Verify user is a member
                const clerkMembership = await clerk.organizations.getOrganizationMembershipList({
                    organizationId: org.clerkOrgId,
                });

                const isMember = clerkMembership.data.some(m => m.publicUserData?.userId === request.clerkId);

                if (!isMember) {
                    return reply.code(403).send({
                        error: 'Not a member of this organization',
                        code: 'NOT_ORG_MEMBER',
                    });
                }

                return org;
            } catch (error: any) {
                fastify.log.error('Error fetching organization:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch organization',
                    code: 'ORG_FETCH_ERROR',
                });
            }
        }
    );

    // GET /api/orgs/:orgId/members - List organization members
    fastify.get(
        '/api/orgs/:orgId/members',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const { orgId } = request.params as { orgId: string };

                const org = await Organization.findById(orgId);

                if (!org) {
                    return reply.code(404).send({
                        error: 'Organization not found',
                        code: 'ORG_NOT_FOUND',
                    });
                }

                // Get members from Clerk
                const clerkMembers = await clerk.organizations.getOrganizationMembershipList({
                    organizationId: org.clerkOrgId,
                });

                // Fetch corresponding user data from MongoDB
                const members = [];
                for (const member of clerkMembers.data) {
                    if (!member.publicUserData) continue;

                    const user = await User.findOne({ clerkId: member.publicUserData.userId }).lean();

                    members.push({
                        userId: user?._id,
                        clerkUserId: member.publicUserData.userId,
                        role: member.role === 'org:admin' ? 'admin' : 'member',
                        joinedAt: member.createdAt,
                        user: user ? {
                            _id: user._id,
                            clerkId: user.clerkId,
                            username: user.username,
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            displayName: user.displayName,
                            avatar: user.avatar,
                        } : null,
                    });
                }

                return members;
            } catch (error: any) {
                fastify.log.error('Error fetching organization members:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch members',
                    code: 'MEMBERS_FETCH_ERROR',
                });
            }
        }
    );

    // POST /api/orgs/:orgId/invites - Send invitation
    fastify.post(
        '/api/orgs/:orgId/invites',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { orgId } = request.params as { orgId: string };
                const body = sendInviteSchema.parse(request.body);

                const org = await Organization.findById(orgId);

                if (!org) {
                    return reply.code(404).send({
                        error: 'Organization not found',
                        code: 'ORG_NOT_FOUND',
                    });
                }

                // Create invitation in Clerk
                const clerkInvite = await clerk.organizations.createOrganizationInvitation({
                    organizationId: org.clerkOrgId,
                    emailAddress: body.email,
                    role: body.role === 'admin' ? 'org:admin' : 'org:member',
                    inviterUserId: request.clerkId!,
                });

                // Create invitation in MongoDB
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

                const invite = await OrganizationInvite.create({
                    orgId: new mongoose.Types.ObjectId(orgId),
                    email: body.email,
                    role: body.role,
                    invitedBy: request.clerkId!,
                    clerkInviteId: clerkInvite.id,
                    status: 'pending',
                    expiresAt,
                });

                return {
                    _id: invite._id,
                    orgId: invite.orgId,
                    email: invite.email,
                    role: invite.role,
                    invitedBy: invite.invitedBy,
                    clerkInviteId: invite.clerkInviteId,
                    status: invite.status,
                    expiresAt: invite.expiresAt,
                    createdAt: invite.createdAt,
                };
            } catch (error: any) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Invalid input',
                        code: 'VALIDATION_ERROR',
                        details: error.errors,
                    });
                }

                fastify.log.error('Error sending invitation:', error);
                return reply.code(500).send({
                    error: 'Failed to send invitation',
                    code: 'INVITE_SEND_ERROR',
                });
            }
        }
    );

    // GET /api/orgs/:orgId/invites - List organization invitations
    fastify.get(
        '/api/orgs/:orgId/invites',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { orgId } = request.params as { orgId: string };
                const query = request.query as { status?: string };

                const filter: any = { orgId: new mongoose.Types.ObjectId(orgId) };

                if (query.status) {
                    filter.status = query.status;
                }

                const invites = await OrganizationInvite.find(filter)
                    .populate('orgId')
                    .sort({ createdAt: -1 })
                    .lean();

                // Populate inviter details
                const invitesWithInviter = await Promise.all(
                    invites.map(async (invite: any) => {
                        const inviter = await User.findOne({ clerkId: invite.invitedBy })
                            .select('_id clerkId username displayName email avatar')
                            .lean();

                        return {
                            ...invite,
                            inviter,
                        };
                    })
                );

                return invitesWithInviter;
            } catch (error: any) {
                fastify.log.error('Error fetching invitations:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch invitations',
                    code: 'INVITES_FETCH_ERROR',
                });
            }
        }
    );

    // GET /api/orgs/invites/my - List my invitations
    fastify.get(
        '/api/orgs/invites/my',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const user = request.userDoc;
                const email = user.email;

                if (!email) {
                    return [];
                }

                const invites = await OrganizationInvite.find({
                    email,
                    status: 'pending',
                    expiresAt: { $gt: new Date() }, // Not expired
                })
                    .populate('orgId')
                    .lean();

                // Populate inviter and organization details
                const invitesWithDetails = await Promise.all(
                    invites.map(async (invite: any) => {
                        const inviter = await User.findOne({ clerkId: invite.invitedBy })
                            .select('_id clerkId username displayName email')
                            .lean();

                        return {
                            ...invite,
                            organization: invite.orgId,
                            inviter,
                        };
                    })
                );

                return invitesWithDetails;
            } catch (error: any) {
                fastify.log.error('Error fetching my invitations:', error);
                return reply.code(500).send({
                    error: 'Failed to fetch invitations',
                    code: 'INVITES_FETCH_ERROR',
                });
            }
        }
    );

    // POST /api/orgs/invites/:inviteId/accept - Accept invitation
    fastify.post(
        '/api/orgs/invites/:inviteId/accept',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const { inviteId } = request.params as { inviteId: string };
                const user = request.userDoc;

                const invite = await OrganizationInvite.findById(inviteId).populate('orgId');

                if (!invite) {
                    return reply.code(404).send({
                        error: 'Invitation not found',
                        code: 'INVITE_NOT_FOUND',
                    });
                }

                // Verify email matches
                if (invite.email !== user.email) {
                    return reply.code(403).send({
                        error: 'Email does not match invitation',
                        code: 'EMAIL_MISMATCH',
                    });
                }

                // Check expiration
                if (new Date() > invite.expiresAt) {
                    return reply.code(403).send({
                        error: 'Invitation has expired',
                        code: 'INVITE_EXPIRED',
                    });
                }

                // Check status
                if (invite.status !== 'pending') {
                    return reply.code(400).send({
                        error: 'Invitation is not pending',
                        code: 'INVITE_NOT_PENDING',
                    });
                }

                const org = invite.orgId as any;

                // Add user to Clerk organization
                await clerk.organizations.createOrganizationMembership({
                    organizationId: org.clerkOrgId,
                    userId: request.clerkId!,
                    role: invite.role === 'admin' ? 'org:admin' : 'org:member',
                });

                // Create Host record if it doesn't exist (accepting invite makes user a host)
                let host = await Host.findOne({ clerkId: request.clerkId });
                if (!host) {
                    host = await Host.create({
                        clerkId: request.clerkId!,
                        userId: user._id,
                        calendar: [],
                        imports: [],
                        currentView: 'host',
                    });
                    fastify.log.info(`Host record created for user ${request.clerkId} (invite accepted)`);
                } else {
                    // Ensure view is set to host
                    host.currentView = 'host';
                    await host.save();
                }

                // Update invitation status
                invite.status = 'accepted';
                await invite.save();

                return {
                    success: true,
                };
            } catch (error: any) {
                fastify.log.error('Error accepting invitation:', error);
                return reply.code(500).send({
                    error: 'Failed to accept invitation',
                    code: 'INVITE_ACCEPT_ERROR',
                });
            }
        }
    );

    // POST /api/orgs/invites/:inviteId/decline - Decline invitation
    fastify.post(
        '/api/orgs/invites/:inviteId/decline',
        {
            preHandler: verifyClerkToken,
        },
        async (request, reply) => {
            try {
                const { inviteId } = request.params as { inviteId: string };
                const user = request.userDoc;

                const invite = await OrganizationInvite.findById(inviteId);

                if (!invite) {
                    return reply.code(404).send({
                        error: 'Invitation not found',
                        code: 'INVITE_NOT_FOUND',
                    });
                }

                // Verify email matches
                if (invite.email !== user.email) {
                    return reply.code(403).send({
                        error: 'Email does not match invitation',
                        code: 'EMAIL_MISMATCH',
                    });
                }

                // Update status to revoked
                invite.status = 'revoked';
                await invite.save();

                return {
                    success: true,
                };
            } catch (error: any) {
                fastify.log.error('Error declining invitation:', error);
                return reply.code(500).send({
                    error: 'Failed to decline invitation',
                    code: 'INVITE_DECLINE_ERROR',
                });
            }
        }
    );

    // DELETE /api/orgs/invites/:inviteId/revoke - Revoke invitation (admin only)
    fastify.delete(
        '/api/orgs/invites/:inviteId/revoke',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { inviteId } = request.params as { inviteId: string };

                const invite = await OrganizationInvite.findById(inviteId).populate('orgId');

                if (!invite) {
                    return reply.code(404).send({
                        error: 'Invitation not found',
                        code: 'INVITE_NOT_FOUND',
                    });
                }

                const org = invite.orgId as any;

                // Revoke in Clerk if has Clerk invite ID
                if (invite.clerkInviteId) {
                    try {
                        await clerk.organizations.revokeOrganizationInvitation({
                            organizationId: org.clerkOrgId,
                            invitationId: invite.clerkInviteId,
                            requestingUserId: request.clerkId!,
                        });
                    } catch (clerkError: any) {
                        fastify.log.warn({ error: clerkError.message }, 'Failed to revoke in Clerk (may already be revoked)');
                    }
                }

                // Update status
                invite.status = 'revoked';
                await invite.save();

                return {
                    success: true,
                };
            } catch (error: any) {
                fastify.log.error('Error revoking invitation:', error);
                return reply.code(500).send({
                    error: 'Failed to revoke invitation',
                    code: 'INVITE_REVOKE_ERROR',
                });
            }
        }
    );

    // POST /api/orgs/invites/:inviteId/resend - Resend invitation (admin only)
    fastify.post(
        '/api/orgs/invites/:inviteId/resend',
        {
            preHandler: [verifyClerkToken, requireAdmin],
        },
        async (request, reply) => {
            try {
                const { inviteId } = request.params as { inviteId: string };

                const invite = await OrganizationInvite.findById(inviteId).populate('orgId');

                if (!invite) {
                    return reply.code(404).send({
                        error: 'Invitation not found',
                        code: 'INVITE_NOT_FOUND',
                    });
                }

                if (invite.status !== 'pending') {
                    return reply.code(400).send({
                        error: 'Can only resend pending invitations',
                        code: 'INVITE_NOT_PENDING',
                    });
                }

                const org = invite.orgId as any;

                // Revoke old Clerk invitation and create new one
                if (invite.clerkInviteId) {
                    try {
                        await clerk.organizations.revokeOrganizationInvitation({
                            organizationId: org.clerkOrgId,
                            invitationId: invite.clerkInviteId,
                            requestingUserId: request.clerkId!,
                        });
                    } catch (error) {
                        // Old invite may already be revoked, that's fine
                    }
                }

                // Create new Clerk invitation
                const newClerkInvite = await clerk.organizations.createOrganizationInvitation({
                    organizationId: org.clerkOrgId,
                    emailAddress: invite.email,
                    role: invite.role === 'admin' ? 'org:admin' : 'org:member',
                    inviterUserId: request.clerkId!,
                });

                // Update invitation with new Clerk ID and extended expiration
                const newExpiresAt = new Date();
                newExpiresAt.setDate(newExpiresAt.getDate() + 7);

                invite.clerkInviteId = newClerkInvite.id;
                invite.expiresAt = newExpiresAt;
                await invite.save();

                return {
                    success: true,
                };
            } catch (error: any) {
                fastify.log.error('Error resending invitation:', error);
                return reply.code(500).send({
                    error: 'Failed to resend invitation',
                    code: 'INVITE_RESEND_ERROR',
                });
            }
        }
    );
}
