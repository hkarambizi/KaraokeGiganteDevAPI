import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export interface ISongSource {
    source: 'spotify' | 'csv' | 'youtube' | 'manual';
    sourceId: string;
}

export interface ISong extends Document {
    title: string;
    title_norm: string; // Normalized for search/dedup
    artistId: mongoose.Types.ObjectId;
    artistName: string; // Denormalized for fast search
    albumId?: mongoose.Types.ObjectId;
    albumTitle?: string; // Denormalized for fast search
    durationSec?: number;
    genres?: string[];
    popularity?: number;
    albumArt?: string;
    videoUrl?: string;

    // Multi-source support with deduplication
    sources: ISongSource[];

    // Fuzzy signature for cross-source dedup
    // Format: sha1(title_norm|artistId|round(durationSec,3))
    signature: string;

    createdAt: Date;
    updatedAt: Date;
}

const songSourceSchema = new Schema<ISongSource>(
    {
        source: {
            type: String,
            enum: ['spotify', 'csv', 'youtube', 'manual'],
            required: true,
        },
        sourceId: {
            type: String,
            required: true,
        },
    },
    { _id: false }
);

const songSchema = new Schema<ISong>(
    {
        title: {
            type: String,
            required: true,
        },
        title_norm: {
            type: String,
            required: true,
            index: true,
        },
        artistId: {
            type: Schema.Types.ObjectId,
            ref: 'Artist',
            required: true,
            index: true,
        },
        artistName: {
            type: String,
            required: true,
            index: true,
        },
        albumId: {
            type: Schema.Types.ObjectId,
            ref: 'Album',
        },
        albumTitle: String,
        durationSec: Number,
        genres: [String],
        popularity: Number,
        albumArt: String,
        videoUrl: String,
        sources: {
            type: [songSourceSchema],
            default: [],
        },
        signature: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for efficient queries
songSchema.index({ artistId: 1, title_norm: 1 });
songSchema.index({ albumId: 1 });
songSchema.index({ 'sources.source': 1, 'sources.sourceId': 1 });

// Normalize fields before saving
songSchema.pre('save', function (next) {
    if (this.isModified('title')) {
        this.title_norm = this.title.toLowerCase().trim();
    }
    next();
});

export const Song = mongoose.model<ISong>('Song', songSchema);

/**
 * Generate signature for deduplication
 * Format: sha1(title_norm|artistId|round(durationSec,3))
 */
export function generateSongSignature(
    title_norm: string,
    artistId: string,
    durationSec?: number
): string {
    // Round duration to nearest 3 seconds for fuzzy matching
    const roundedDuration = durationSec ? Math.round(durationSec / 3) * 3 : 0;
    const signatureInput = `${title_norm}|${artistId}|${roundedDuration}`;

    return crypto.createHash('sha1').update(signatureInput).digest('hex');
}

/**
 * Check if a source already exists for this song
 */
export function hasSource(song: ISong, source: string, sourceId: string): boolean {
    return song.sources.some((s) => s.source === source && s.sourceId === sourceId);
}

/**
 * Add a source to a song if it doesn't already exist
 */
export async function addSourceToSong(
    songId: mongoose.Types.ObjectId | string,
    source: 'spotify' | 'csv' | 'youtube' | 'manual',
    sourceId: string
): Promise<ISong | null> {
    const song = await Song.findById(songId);

    if (!song) {
        return null;
    }

    // Check if source already exists
    if (hasSource(song, source, sourceId)) {
        return song;
    }

    // Add new source
    song.sources.push({ source, sourceId });
    await song.save();

    return song;
}
