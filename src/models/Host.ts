import mongoose, { Document, Schema } from 'mongoose';

export interface IHost extends Document {
    clerkId: string; // Clerk user ID
    userId: mongoose.Types.ObjectId; // Reference to User (profile)

    // Host-specific data
    calendar: mongoose.Types.ObjectId[]; // Array of Event._id references
    imports: Array<{
        source: 'spotify' | 'csv';
        importId?: string;
        songIds: mongoose.Types.ObjectId[];
        importedAt: Date;
    }>;

    // View preference for switching between Host and Guest views
    currentView: 'host' | 'guest'; // 'host' = admin routes, 'guest' = singer routes

    createdAt: Date;
    updatedAt: Date;
}

const hostSchema = new Schema<IHost>(
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
        calendar: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
        }],
        imports: [{
            source: {
                type: String,
                enum: ['spotify', 'csv'],
            },
            importId: String,
            songIds: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Song',
            }],
            importedAt: Date,
        }],
        currentView: {
            type: String,
            enum: ['host', 'guest'],
            default: 'host',
        },
    },
    {
        timestamps: true,
    }
);

// Index for lookup by clerkId
hostSchema.index({ clerkId: 1 });
// Index for lookup by userId
hostSchema.index({ userId: 1 });

export const Host = mongoose.model<IHost>('Host', hostSchema);









