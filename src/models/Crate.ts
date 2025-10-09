import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICrate extends Document {
    eventId: Types.ObjectId;
    songIds: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const crateSchema = new Schema<ICrate>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: 'Event',
            required: true,
            unique: true,
            index: true,
        },
        songIds: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Song',
            },
        ],
    },
    {
        timestamps: true,
    }
);

export const Crate = mongoose.model<ICrate>('Crate', crateSchema);
