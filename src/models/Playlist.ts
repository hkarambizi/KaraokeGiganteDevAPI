import mongoose, { Document, Schema } from 'mongoose';

export interface IPlaylist extends Document {
    orgId: string; // Reference to Organization
    authorId: string; // Reference to User (admin who created it)
    name: string;
    description?: string;
    songIds: string[]; // Array of Song._id references

    // Spotify-specific data (only populated if published to Spotify)
    spotifyPlaylist?: {
        playlistId: string; // Spotify playlist ID
        name: string; // Name on Spotify
        description: string; // Description on Spotify
        href: string; // Spotify API URL
        playlistUrl: string; // Spotify web player URL
        tracksUrl: string; // URL to get tracks
    };

    isPublished: boolean; // Whether published to Spotify
    publishedAt?: Date; // When it was published
    publishedBy?: string; // User who published it

    createdAt: Date;
    updatedAt: Date;
}

const playlistSchema = new Schema<IPlaylist>(
    {
        orgId: {
            type: String,
            required: true,
            index: true,
        },
        authorId: {
            type: String,
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
        },
        description: String,
        songIds: {
            type: [String],
            default: [],
        },
        spotifyPlaylist: {
            playlistId: String,
            name: String,
            description: String,
            href: String,
            playlistUrl: String,
            tracksUrl: String,
        },
        isPublished: {
            type: Boolean,
            default: false,
        },
        publishedAt: Date,
        publishedBy: String,
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient queries
playlistSchema.index({ orgId: 1, createdAt: -1 });
playlistSchema.index({ authorId: 1, createdAt: -1 });
playlistSchema.index({ 'spotifyPlaylist.playlistId': 1 });

export const Playlist = mongoose.model<IPlaylist>('Playlist', playlistSchema);

