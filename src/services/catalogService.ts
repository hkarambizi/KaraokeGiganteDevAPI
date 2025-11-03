import { findOrCreateArtist } from '../models/Artist.js';
import { findOrCreateAlbum } from '../models/Album.js';
import { Song, generateSongSignature, hasSource, ISong } from '../models/Song.js';

export interface SpotifyTrackData {
    id: string; // Spotify track ID
    name: string;
    artists: Array<{ name: string; id?: string }>;
    album: {
        name: string;
        id?: string;
        release_date?: string;
        images?: Array<{ url: string }>;
    };
    duration_ms: number;
    popularity?: number;
    external_urls?: { spotify?: string };
}

export interface SaveSongResult {
    inserted: boolean;
    song?: ISong;
    existingId?: string;
    message?: string;
}

/**
 * Save a song from Spotify with full artist/album upsert and deduplication
 */
export async function saveFromSpotifyTrack(
    trackData: SpotifyTrackData
): Promise<SaveSongResult> {
    try {
        // 1. Upsert artist
        const primaryArtist = trackData.artists[0];
        if (!primaryArtist) {
            return {
                inserted: false,
                message: 'No artist data provided',
            };
        }

        const artist = await findOrCreateArtist(
            primaryArtist.name,
            'spotify',
            primaryArtist.id,
            {
                imageUrl: trackData.album.images?.[0]?.url,
            }
        );

        // 2. Upsert album
        const releaseYear = trackData.album.release_date
            ? parseInt(trackData.album.release_date.substring(0, 4))
            : undefined;

        const album = await findOrCreateAlbum(
            trackData.album.name,
            (artist._id as any).toString(),
            releaseYear,
            'spotify',
            trackData.album.id,
            {
                imageUrl: trackData.album.images?.[0]?.url,
            }
        );

        // 3. Generate signature for deduplication
        const durationSec = Math.round(trackData.duration_ms / 1000);
        const title_norm = trackData.name.toLowerCase().trim();
        const signature = generateSongSignature(
            title_norm,
            (artist._id as any).toString(),
            durationSec
        );

        // 4. Check if song already exists by signature
        let song = await Song.findOne({ signature });

        if (song) {
            // Song exists, check if we need to add this source
            const spotifySource = { source: 'spotify' as const, sourceId: trackData.id };

            if (hasSource(song, spotifySource.source, spotifySource.sourceId)) {
                return {
                    inserted: false,
                    existingId: (song._id as any).toString(),
                    song,
                    message: 'Song already exists with this source',
                };
            }

            // Add new source
            song.sources.push(spotifySource);
            await song.save();

            return {
                inserted: false,
                existingId: (song._id as any).toString(),
                song,
                message: 'Source added to existing song',
            };
        }

        // 5. Create new song
        song = await Song.create({
            title: trackData.name,
            title_norm,
            artistId: artist._id,
            artistName: artist.name,
            albumId: album._id,
            albumTitle: album.title,
            durationSec,
            popularity: trackData.popularity,
            albumArt: trackData.album.images?.[0]?.url,
            sources: [
                {
                    source: 'spotify',
                    sourceId: trackData.id,
                },
            ],
            signature,
        });

        return {
            inserted: true,
            song,
            message: 'Song created successfully',
        };
    } catch (error: any) {
        // Handle duplicate key errors
        if (error.code === 11000) {
            // Duplicate signature - try to fetch and add source
            const signature = error.keyValue?.signature;
            if (signature) {
                const existingSong = await Song.findOne({ signature });
                if (existingSong) {
                    return {
                        inserted: false,
                        existingId: (existingSong._id as any).toString(),
                        song: existingSong,
                        message: 'Song already exists (duplicate signature)',
                    };
                }
            }
        }

        throw error;
    }
}

/**
 * Save a song from CSV data
 */
export interface CSVSongData {
    title: string;
    artist: string;
    album?: string;
    duration?: number; // in seconds
    genre?: string;
}

export async function saveFromCSVData(
    csvData: CSVSongData,
    userId: string
): Promise<SaveSongResult> {
    try {
        // 1. Upsert artist
        const artist = await findOrCreateArtist(csvData.artist, 'csv', undefined);

        // 2. Upsert album (if provided)
        let album;
        if (csvData.album) {
            album = await findOrCreateAlbum(
                csvData.album,
                (artist._id as any).toString(),
                undefined,
                'csv',
                undefined
            );
        }

        // 3. Generate signature
        const title_norm = csvData.title.toLowerCase().trim();
        const signature = generateSongSignature(
            title_norm,
            (artist._id as any).toString(),
            csvData.duration
        );

        // 4. Check if exists
        let song = await Song.findOne({ signature });

        if (song) {
            // Add CSV source
            const csvSource = { source: 'csv' as const, sourceId: userId };

            if (!hasSource(song, csvSource.source, csvSource.sourceId)) {
                song.sources.push(csvSource);
                await song.save();
            }

            return {
                inserted: false,
                existingId: (song._id as any).toString(),
                song,
                message: 'Song already exists',
            };
        }

        // 5. Create new song
        song = await Song.create({
            title: csvData.title,
            title_norm,
            artistId: artist._id,
            artistName: artist.name,
            albumId: album?._id,
            albumTitle: album?.title,
            durationSec: csvData.duration,
            genres: csvData.genre ? [csvData.genre] : undefined,
            sources: [
                {
                    source: 'csv',
                    sourceId: userId,
                },
            ],
            signature,
        });

        return {
            inserted: true,
            song,
            message: 'Song created successfully',
        };
    } catch (error: any) {
        if (error.code === 11000) {
            const signature = error.keyValue?.signature;
            if (signature) {
                const existingSong = await Song.findOne({ signature });
                if (existingSong) {
                    return {
                        inserted: false,
                        existingId: (existingSong._id as any).toString(),
                        song: existingSong,
                        message: 'Song already exists (duplicate)',
                    };
                }
            }
        }

        throw error;
    }
}

/**
 * Search catalog using MongoDB text search (fallback if Atlas Search not available)
 */
export async function searchCatalogFallback(
    query: string,
    limit: number = 20
): Promise<ISong[]> {
    // Use MongoDB text search as fallback
    const songs = await Song.find(
        {
            $or: [
                { title_norm: { $regex: query, $options: 'i' } },
                { artistName: { $regex: query, $options: 'i' } },
                { albumTitle: { $regex: query, $options: 'i' } },
            ],
        },
        {
            title: 1,
            artistName: 1,
            albumTitle: 1,
            durationSec: 1,
            genres: 1,
            albumArt: 1,
            popularity: 1,
        }
    )
        .sort({ popularity: -1 })
        .limit(limit)
        .lean();

    return songs as ISong[];
}

/**
 * Get duplicate songs (same signature)
 */
export async function getDuplicateSongs(): Promise<
    Array<{ signature: string; count: number; songs: ISong[] }>
> {
    const duplicates = await Song.aggregate([
        {
            $group: {
                _id: '$signature',
                count: { $sum: 1 },
                songs: { $push: '$$ROOT' },
            },
        },
        {
            $match: {
                count: { $gt: 1 },
            },
        },
        {
            $sort: { count: -1 },
        },
    ]);

    return duplicates.map((d) => ({
        signature: d._id,
        count: d.count,
        songs: d.songs,
    }));
}

