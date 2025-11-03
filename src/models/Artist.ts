import mongoose, { Document, Schema } from 'mongoose';

export interface IArtist extends Document {
    name: string;
    name_norm: string; // Normalized for uniqueness (lowercase, trimmed)
    source?: 'spotify' | 'csv' | 'manual';
    sourceId?: string; // External ID from source
    imageUrl?: string;
    genres?: string[];
    popularity?: number;
    createdAt: Date;
    updatedAt: Date;
}

const artistSchema = new Schema<IArtist>(
    {
        name: {
            type: String,
            required: true,
        },
        name_norm: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        source: {
            type: String,
            enum: ['spotify', 'csv', 'manual'],
        },
        sourceId: String,
        imageUrl: String,
        genres: [String],
        popularity: Number,
    },
    {
        timestamps: true,
    }
);

// Normalize name before saving
artistSchema.pre('save', function (next) {
    if (this.isModified('name')) {
        this.name_norm = this.name.toLowerCase().trim();
    }
    next();
});

export const Artist = mongoose.model<IArtist>('Artist', artistSchema);

// Helper function to find or create artist
export async function findOrCreateArtist(
    name: string,
    source?: 'spotify' | 'csv' | 'manual',
    sourceId?: string,
    additionalData?: Partial<IArtist>
): Promise<IArtist> {
    const name_norm = name.toLowerCase().trim();

    // Try to find existing artist
    let artist = await Artist.findOne({ name_norm });

    if (artist) {
        return artist;
    }

    // Create new artist
    artist = await Artist.create({
        name,
        name_norm,
        source,
        sourceId,
        ...additionalData,
    });

    return artist;
}

