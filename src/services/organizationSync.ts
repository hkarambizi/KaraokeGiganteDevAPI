import { createClerkClient } from '@clerk/backend';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

const clerk = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
});

/**
 * Sync Organization records from Clerk to MongoDB
 *
 * When a user has Clerk organization memberships but MongoDB doesn't have
 * the Organization records, this function creates them automatically.
 *
 * This handles cases where:
 * - Organizations were created directly in Clerk (not through our API)
 * - Users were added to organizations outside our system
 * - Data migration scenarios
 *
 * @param clerkOrgIds - Array of Clerk organization IDs to sync
 * @param clerkId - Optional: Clerk user ID to use for createdBy (first org member if not provided)
 */
export async function syncOrganizationsFromClerk(clerkOrgIds: string[], clerkId?: string): Promise<void> {
    if (clerkOrgIds.length === 0) {
        return;
    }

    // Check which organizations already exist in MongoDB
    const existingOrgs = await Organization.find({
        clerkOrgId: { $in: clerkOrgIds },
    }).lean();

    const existingOrgIds = new Set(existingOrgs.map(org => org.clerkOrgId));
    const missingOrgIds = clerkOrgIds.filter(id => !existingOrgIds.has(id));

    if (missingOrgIds.length === 0) {
        return; // All organizations already synced
    }

    // If clerkId provided, get MongoDB user._id for createdBy
    let createdByUserId: string | undefined;
    if (clerkId) {
        const user = await User.findOne({ clerkId }).lean();
        if (user) {
            createdByUserId = (user._id as any).toString();
        }
    }

    // Fetch missing organizations from Clerk and create MongoDB records
    for (const clerkOrgId of missingOrgIds) {
        try {
            const clerkOrg = await clerk.organizations.getOrganization({
                organizationId: clerkOrgId,
            });

            // Check if org already exists (race condition protection)
            const existing = await Organization.findOne({ clerkOrgId: clerkOrg.id });
            if (existing) {
                console.log(`ℹ️  Organization already exists in MongoDB: ${clerkOrg.name} (${clerkOrg.id})`);
                continue; // Already exists, skip
            }

            // Determine createdBy value:
            // 1. Prefer MongoDB user._id if available
            // 2. Fall back to Clerk org.createdBy (clerkId format)
            // 3. Use first org member as last resort
            let createdBy: string;

            if (createdByUserId) {
                createdBy = createdByUserId; // MongoDB user._id
            } else if (clerkOrg.createdBy) {
                // Try to find MongoDB user by Clerk createdBy
                const creatorUser = await User.findOne({ clerkId: clerkOrg.createdBy }).lean();
                if (creatorUser) {
                    createdBy = (creatorUser._id as any).toString();
                } else {
                    // Fallback: use Clerk ID (will need to be fixed later)
                    createdBy = clerkOrg.createdBy;
                }
            } else {
                // Last resort: get first org member
                try {
                    const members = await clerk.organizations.getOrganizationMembershipList({
                        organizationId: clerkOrg.id,
                    });
                    if (members.data.length > 0) {
                        const firstMemberId = members.data[0].publicUserData?.userId;
                        if (firstMemberId) {
                            const firstMember = await User.findOne({ clerkId: firstMemberId }).lean();
                            if (firstMember) {
                                createdBy = (firstMember._id as any).toString();
                            } else {
                                // Use Clerk ID as fallback
                                createdBy = firstMemberId;
                            }
                        } else {
                            // Can't determine creator, use org ID as last resort
                            createdBy = clerkOrg.id;
                        }
                    } else {
                        // No members, use org ID
                        createdBy = clerkOrg.id;
                    }
                } catch (memberError: any) {
                    // If we can't get members, use org ID
                    createdBy = clerkOrg.id;
                }
            }

            // Create MongoDB Organization record
            const created = await Organization.create({
                clerkOrgId: clerkOrg.id,
                name: clerkOrg.name,
                slug: clerkOrg.slug || clerkOrg.id.replace('org_', ''), // Use ID-based slug if none exists
                logoUrl: clerkOrg.imageUrl || undefined,
                createdBy: createdBy, // Required field - now properly populated
            });

            console.log(`✅ Synced Organization from Clerk: ${clerkOrg.name} (${clerkOrg.id}) → MongoDB _id: ${created._id}, createdBy: ${createdBy}`);
        } catch (error: any) {
            // Check if it's a duplicate key error (org already exists)
            if (error.code === 11000 || error.code === 11001) {
                console.log(`ℹ️  Organization already exists (duplicate key): ${clerkOrgId}`);
                continue; // Already exists, not an error
            }

            // Check if it's a validation error
            if (error.name === 'ValidationError') {
                console.error(`❌ Validation failed for organization ${clerkOrgId}:`, error.message);
                if (error.errors) {
                    Object.keys(error.errors).forEach(key => {
                        console.error(`  - ${key}: ${error.errors[key].message}`);
                    });
                }
            } else {
                console.error(`❌ Failed to sync organization ${clerkOrgId}:`, error.message);
            }

            if (error.stack) {
                console.error('Stack:', error.stack);
            }
            // Continue with other organizations even if one fails
        }
    }
}

/**
 * Sync organizations for a specific user
 *
 * Gets user's Clerk organizations and syncs missing ones to MongoDB
 * Uses the user's MongoDB _id for createdBy field
 */
export async function syncUserOrganizations(clerkId: string): Promise<void> {
    try {
        const clerkOrgs = await clerk.users.getOrganizationMembershipList({
            userId: clerkId,
        });

        const clerkOrgIds = clerkOrgs.data.map(m => m.organization.id);
        // Pass clerkId so we can use user's MongoDB _id for createdBy
        await syncOrganizationsFromClerk(clerkOrgIds, clerkId);
    } catch (error: any) {
        console.error(`❌ Failed to sync organizations for user ${clerkId}:`, error.message);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
        throw error;
    }
}

