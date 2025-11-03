import mongoose, { Document, Schema } from 'mongoose';

export interface IOrganization extends Document {
    clerkOrgId: string;
    name: string;
    slug: string; // URL-friendly unique slug
    logoUrl?: string; // Optional logo
    createdBy: string; // clerkId of the creator
    createdAt: Date;
    updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
    {
        clerkOrgId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            index: true,
            lowercase: true,
        },
        logoUrl: String,
        createdBy: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
