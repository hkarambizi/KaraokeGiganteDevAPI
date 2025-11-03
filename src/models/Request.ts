import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRequest extends Document {
    eventId: Types.ObjectId;
    songId: Types.ObjectId;
    userId: string; // clerkId
    coSingers: Types.ObjectId[]; // User _ids
    status: 'pending_admin' | 'approved' | 'rejected' | 'queued' | 'performed';
    videoUrl?: string;
    inCrate: boolean;
    rejectionReason?: string;
    queuePosition?: number;
    fastPass?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const requestSchema = new Schema<IRequest>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true,
        },
        songId: {
            type: Schema.Types.ObjectId,
            ref: 'Song',
            required: true,
        },
        userId: {
            type: String,
            required: true,
            index: true,
        },
        coSingers: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        status: {
            type: String,
            enum: ['pending_admin', 'approved', 'rejected', 'queued', 'performed'],
            default: 'pending_admin',
            index: true,
        },
        videoUrl: String,
        inCrate: {
            type: Boolean,
            default: false,
            index: true,
        },
        rejectionReason: String,
        queuePosition: Number,
        fastPass: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient queries
requestSchema.index({ eventId: 1, status: 1 });
requestSchema.index({ eventId: 1, inCrate: 1 });

export const Request = mongoose.model<IRequest>('Request', requestSchema);
