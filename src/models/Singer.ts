import mongoose, { Document, Schema } from 'mongoose';

export interface ISinger extends Document {
    clerkId: string; // Clerk user ID
    userId: mongoose.Types.ObjectId; // Reference to User (profile)

    // Singer-specific data
    favorites: mongoose.Types.ObjectId[]; // Array of Song._id references
    checkIns: Array<{
        eventId: mongoose.Types.ObjectId;
        timestamp: Date;
    }>;
    friends: mongoose.Types.ObjectId[]; // Array of User._id references

    createdAt: Date;
    updatedAt: Date;
}

const singerSchema = new Schema<ISinger>(
    {
        clerkId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        favorites: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Song',
        }],
        checkIns: [{
            eventId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
            },
            timestamp: Date,
        }],
        friends: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
    },
    {
        timestamps: true,
    }
);

// Index for lookup by clerkId
singerSchema.index({ clerkId: 1 });
// Index for lookup by userId
singerSchema.index({ userId: 1 });

export const Singer = mongoose.model<ISinger>('Singer', singerSchema);









