import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPerformance extends Document {
    eventId: Types.ObjectId;
    requestId: Types.ObjectId;
    songId: Types.ObjectId;
    userId: string; // clerkId
    coSingers: Types.ObjectId[];
    performedAt: Date;
    videoUrl?: string;
    rating?: number;
    createdAt: Date;
    updatedAt: Date;
}

const performanceSchema = new Schema<IPerformance>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            index: true,
        },
        requestId: {
            type: Schema.Types.ObjectId,
            ref: 'Request',
            required: true,
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
        performedAt: {
            type: Date,
            required: true,
        },
        videoUrl: String,
        rating: Number,
    },
    {
        timestamps: true,
    }
);

export const Performance = mongoose.model<IPerformance>('Performance', performanceSchema);
