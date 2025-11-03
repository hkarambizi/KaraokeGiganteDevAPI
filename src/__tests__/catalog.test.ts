import { describe, it, expect } from 'vitest';
import { generateSongSignature, hasSource } from '../models/Song.js';
import { parseCSV, validateSongs } from '../services/csvParser.js';
import type { ISong } from '../models/Song.js';

describe('Catalog - Song Signature Generation', () => {
    it('should generate consistent signatures for same song', () => {
        const title_norm = 'bohemian rhapsody';
        const artistId = '507f1f77bcf86cd799439011';
        const duration = 354;

        const sig1 = generateSongSignature(title_norm, artistId, duration);
        const sig2 = generateSongSignature(title_norm, artistId, duration);

        expect(sig1).toBe(sig2);
        expect(sig1).toHaveLength(40); // SHA1 produces 40-char hex string
    });

    it('should generate different signatures for different songs', () => {
        const artistId = '507f1f77bcf86cd799439011';

        const sig1 = generateSongSignature('bohemian rhapsody', artistId, 354);
        const sig2 = generateSongSignature('we will rock you', artistId, 132);

        expect(sig1).not.toBe(sig2);
    });

    it('should round duration to nearest 3 seconds for fuzzy matching', () => {
        const title = 'test song';
        const artistId = '507f1f77bcf86cd799439011';

        const sig1 = generateSongSignature(title, artistId, 354); // 354s
        const sig2 = generateSongSignature(title, artistId, 355); // 355s (within 3s)
        const sig3 = generateSongSignature(title, artistId, 356); // 356s (within 3s)

        // All should produce same signature (rounded to 354)
        expect(sig1).toBe(sig2);
        expect(sig2).toBe(sig3);
    });

    it('should handle missing duration', () => {
        const title = 'test song';
        const artistId = '507f1f77bcf86cd799439011';

        const sig1 = generateSongSignature(title, artistId);
        const sig2 = generateSongSignature(title, artistId, undefined);

        expect(sig1).toBe(sig2);
    });
});

describe('Catalog - Source Management', () => {
    it('should detect existing source', () => {
        const mockSong = {
            sources: [
                { source: 'spotify', sourceId: 'abc123' },
                { source: 'csv', sourceId: 'user_xyz' },
            ],
        } as ISong;

        expect(hasSource(mockSong, 'spotify', 'abc123')).toBe(true);
        expect(hasSource(mockSong, 'csv', 'user_xyz')).toBe(true);
    });

    it('should detect non-existing source', () => {
        const mockSong = {
            sources: [{ source: 'spotify', sourceId: 'abc123' }],
        } as ISong;

        expect(hasSource(mockSong, 'spotify', 'different_id')).toBe(false);
        expect(hasSource(mockSong, 'csv', 'abc123')).toBe(false);
    });

    it('should handle empty sources array', () => {
        const mockSong = {
            sources: [],
        } as unknown as ISong;

        expect(hasSource(mockSong, 'spotify', 'any_id')).toBe(false);
    });
});

describe('CSV Parser - Basic Parsing', () => {
    it('should parse valid CSV with all fields', () => {
        const csvData = `title,artist,album,duration,genre
"Bohemian Rhapsody","Queen","A Night at the Opera",354,"Rock"
"Billie Jean","Michael Jackson","Thriller",294,"Pop"`;

        const result = parseCSV(csvData);

        expect(result.success).toBe(true);
        expect(result.songs).toHaveLength(2);
        expect(result.validRows).toBe(2);
        expect(result.invalidRows).toBe(0);

        const song1 = result.songs[0];
        expect(song1.title).toBe('Bohemian Rhapsody');
        expect(song1.artist).toBe('Queen');
        expect(song1.album).toBe('A Night at the Opera');
        expect(song1.duration).toBe(354);
        expect(song1.genre).toBe('Rock');
    });

    it('should parse CSV with minimal fields (title and artist only)', () => {
        const csvData = `title,artist
"Test Song","Test Artist"`;

        const result = parseCSV(csvData);

        expect(result.success).toBe(true);
        expect(result.songs).toHaveLength(1);
        expect(result.songs[0].title).toBe('Test Song');
        expect(result.songs[0].artist).toBe('Test Artist');
        expect(result.songs[0].album).toBeUndefined();
    });

    it('should handle quoted fields with commas', () => {
        const csvData = `title,artist
"Song, Part 1","Artist, The"`;

        const result = parseCSV(csvData);

        expect(result.success).toBe(true);
        expect(result.songs[0].title).toBe('Song, Part 1');
        expect(result.songs[0].artist).toBe('Artist, The');
    });

    it('should handle empty rows', () => {
        const csvData = `title,artist
"Song 1","Artist 1"

"Song 2","Artist 2"`;

        const result = parseCSV(csvData);

        expect(result.success).toBe(true);
        expect(result.songs).toHaveLength(2);
    });

    it('should reject CSV without required headers', () => {
        const csvData = `name,performer
"Test","Test Artist"`;

        const result = parseCSV(csvData);

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('title');
    });

    it('should reject empty CSV', () => {
        const csvData = '';

        const result = parseCSV(csvData);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain('empty');
    });
});

describe('CSV Parser - Duration Parsing', () => {
    it('should parse duration as seconds', () => {
        const csvData = `title,artist,duration
"Test","Artist",354`;

        const result = parseCSV(csvData);

        expect(result.songs[0].duration).toBe(354);
    });

    it('should parse duration as MM:SS', () => {
        const csvData = `title,artist,duration
"Test","Artist","5:34"`;

        const result = parseCSV(csvData);

        expect(result.songs[0].duration).toBe(334); // 5*60 + 34
    });

    it('should parse duration as XmXXs format', () => {
        const csvData = `title,artist,duration
"Test","Artist","5m34s"`;

        const result = parseCSV(csvData);

        expect(result.songs[0].duration).toBe(334);
    });

    it('should handle invalid duration formats', () => {
        const csvData = `title,artist,duration
"Test","Artist","invalid"`;

        const result = parseCSV(csvData);

        expect(result.songs[0].duration).toBeUndefined();
    });
});

describe('CSV Parser - Validation', () => {
    it('should identify valid songs', () => {
        const songs = [
            { title: 'Valid Song', artist: 'Valid Artist', rowNumber: 2 },
            { title: '', artist: 'Artist', rowNumber: 3 },
            { title: 'Song', artist: '', rowNumber: 4 },
        ];

        const { valid, invalid } = validateSongs(songs);

        expect(valid).toHaveLength(1);
        expect(invalid).toHaveLength(2);
        expect(valid[0].title).toBe('Valid Song');
    });

    it('should mark songs with errors as invalid', () => {
        const songs = [
            {
                title: 'Song',
                artist: 'Artist',
                rowNumber: 2,
                errors: ['Invalid duration'],
            },
            { title: 'Valid', artist: 'Valid', rowNumber: 3 },
        ];

        const { valid, invalid } = validateSongs(songs);

        expect(valid).toHaveLength(1);
        expect(invalid).toHaveLength(1);
        expect(invalid[0].errors).toContain('Invalid duration');
    });
});

describe('CSV Parser - Edge Cases', () => {
    it('should handle escaped quotes in fields', () => {
        const csvData = `title,artist
"Song ""Quoted""","Artist"`;

        const result = parseCSV(csvData);

        expect(result.songs[0].title).toBe('Song "Quoted"');
    });

    it('should trim whitespace from fields', () => {
        const csvData = `title,artist
"  Spaced Song  ","  Spaced Artist  "`;

        const result = parseCSV(csvData);

        expect(result.songs[0].title).toBe('Spaced Song');
        expect(result.songs[0].artist).toBe('Spaced Artist');
    });

    it('should track row numbers correctly', () => {
        const csvData = `title,artist
"Song 1","Artist 1"
"Song 2","Artist 2"
"Song 3","Artist 3"`;

        const result = parseCSV(csvData);

        expect(result.songs[0].rowNumber).toBe(2);
        expect(result.songs[1].rowNumber).toBe(3);
        expect(result.songs[2].rowNumber).toBe(4);
    });

    it('should handle rows with missing optional fields', () => {
        const csvData = `title,artist,album,duration
"Song 1","Artist 1",,
"Song 2","Artist 2","Album 2",300`;

        const result = parseCSV(csvData);

        expect(result.songs).toHaveLength(2);
        expect(result.songs[0].album).toBeUndefined();
        expect(result.songs[0].duration).toBeUndefined();
        expect(result.songs[1].album).toBe('Album 2');
        expect(result.songs[1].duration).toBe(300);
    });
});

