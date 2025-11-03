import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
    orgId: string; // Clerk organization ID
    name: string;
    date: Date;
    venue?: string;
    status: 'draft' | 'active' | 'closed';
    createdBy: string; // clerkId
    createdAt: Date;
    updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
    {
        orgId: {
            type: String,
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        venue: String,
        status: {
            type: String,
            enum: ['draft', 'active', 'closed'],
            default: 'draft',
        },
        createdBy: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient queries
eventSchema.index({ status: 1, date: 1 });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
