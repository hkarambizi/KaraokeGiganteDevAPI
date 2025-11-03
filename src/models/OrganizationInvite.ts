import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOrganizationInvite extends Document {
    orgId: Types.ObjectId;
    email: string;
    role: 'admin' | 'member';
    invitedBy: string; // clerkId
    clerkInviteId?: string; // Clerk invitation ID
    status: 'pending' | 'accepted' | 'revoked';
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const organizationInviteSchema = new Schema<IOrganizationInvite>(
    {
        orgId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            index: true,
        },
        role: {
            type: String,
            enum: ['admin', 'member'],
            required: true,
        },
        invitedBy: {
            type: String,
            required: true,
        },
        clerkInviteId: String,
        status: {
            type: String,
            enum: ['pending', 'accepted', 'revoked'],
            default: 'pending',
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient queries
organizationInviteSchema.index({ email: 1, status: 1 });
organizationInviteSchema.index({ orgId: 1, status: 1 });

export const OrganizationInvite = mongoose.model<IOrganizationInvite>('OrganizationInvite', organizationInviteSchema);
