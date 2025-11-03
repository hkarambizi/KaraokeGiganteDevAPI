import mongoose, { Document, Schema } from 'mongoose';

export interface IAlbum extends Document {
    title: string;
    title_norm: string; // Normalized for uniqueness
    artistId: mongoose.Types.ObjectId;
    releaseYear?: number;
    source?: 'spotify' | 'csv' | 'manual';
    sourceId?: string;
    imageUrl?: string;
    genres?: string[];
    createdAt: Date;
    updatedAt: Date;
}

const albumSchema = new Schema<IAlbum>(
    {
        title: {
            type: String,
            required: true,
        },
        title_norm: {
            type: String,
            required: true,
        },
        artistId: {
            type: Schema.Types.ObjectId,
            ref: 'Artist',
            required: true,
            index: true,
        },
        releaseYear: Number,
        source: {
            type: String,
            enum: ['spotify', 'csv', 'manual'],
        },
        sourceId: String,
        imageUrl: String,
        genres: [String],
    },
    {
        timestamps: true,
    }
);

// Compound unique index on (artistId, title_norm, releaseYear)
albumSchema.index(
    { artistId: 1, title_norm: 1, releaseYear: 1 },
    { unique: true }
);

// Normalize title before saving
albumSchema.pre('save', function (next) {
    if (this.isModified('title')) {
        this.title_norm = this.title.toLowerCase().trim();
    }
    next();
});

export const Album = mongoose.model<IAlbum>('Album', albumSchema);

// Helper function to find or create album
export async function findOrCreateAlbum(
    title: string,
    artistId: mongoose.Types.ObjectId | string,
    releaseYear?: number,
    source?: 'spotify' | 'csv' | 'manual',
    sourceId?: string,
    additionalData?: Partial<IAlbum>
): Promise<IAlbum> {
    const title_norm = title.toLowerCase().trim();
    const artistObjectId = typeof artistId === 'string' ? new mongoose.Types.ObjectId(artistId) : artistId;

    // Try to find existing album
    let album = await Album.findOne({
        artistId: artistObjectId,
        title_norm,
        releaseYear: releaseYear || null,
    });

    if (album) {
        return album;
    }

    // Create new album
    album = await Album.create({
        title,
        title_norm,
        artistId: artistObjectId,
        releaseYear,
        source,
        sourceId,
        ...additionalData,
    });

    return album;
}

