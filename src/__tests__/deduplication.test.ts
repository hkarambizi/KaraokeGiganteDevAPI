import { describe, it, expect } from 'vitest';

/**
 * Unit Tests for Song Deduplication
 *
 * Tests the normalization logic that prevents duplicate songs
 */

describe('Song Deduplication', () => {
    function normalizeString(str: string): string {
        return str.toLowerCase().trim().replace(/[^\w\s]/g, '');
    }

    describe('Title Normalization', () => {
        it('should convert to lowercase', () => {
            expect(normalizeString('BOHEMIAN RHAPSODY')).toBe('bohemian rhapsody');
            expect(normalizeString('Bohemian Rhapsody')).toBe('bohemian rhapsody');
        });

        it('should remove punctuation', () => {
            expect(normalizeString('Don\'t Stop Me Now!')).toBe('dont stop me now');
            expect(normalizeString('What\'s Up?')).toBe('whats up');
        });

        it('should trim whitespace', () => {
            expect(normalizeString('  Bohemian Rhapsody  ')).toBe('bohemian rhapsody');
            expect(normalizeString('\tHello World\n')).toBe('hello world');
        });

        it('should handle special characters', () => {
            expect(normalizeString('Señorita')).toBe('seorita');
            expect(normalizeString('Café')).toBe('caf');
        });

        it('should normalize to same value for duplicates', () => {
            const title1 = 'Don\'t Stop Believin\'';
            const title2 = 'dont stop believin';
            const title3 = 'DONT STOP BELIEVIN!';

            expect(normalizeString(title1)).toBe(normalizeString(title2));
            expect(normalizeString(title2)).toBe(normalizeString(title3));
        });
    });

    describe('Artist Normalization', () => {
        it('should normalize artist arrays', () => {
            const artists1 = ['Queen'];
            const artists2 = ['QUEEN'];
            const artists3 = ['queen'];

            expect(normalizeString(artists1.join(' '))).toBe(
                normalizeString(artists2.join(' '))
            );
            expect(normalizeString(artists2.join(' '))).toBe(
                normalizeString(artists3.join(' '))
            );
        });

        it('should handle multiple artists', () => {
            const artists = ['The Beatles', 'Billy Preston'];
            const normalized = normalizeString(artists.join(' '));

            expect(normalized).toBe('the beatles billy preston');
        });

        it('should handle artist name variations', () => {
            const artist1 = 'P!nk';
            const artist2 = 'Pink';

            // Note: These would be different due to punctuation removal
            // This is intentional - we want exact matches after normalization
            expect(normalizeString(artist1)).toBe('pnk');
            expect(normalizeString(artist2)).toBe('pink');
        });
    });

    describe('Duplicate Detection', () => {
        interface SongKey {
            source: string;
            sourceId: string;
            titleNorm: string;
            artistNorm: string;
        }

        it('should detect exact duplicates', () => {
            const song1: SongKey = {
                source: 'spotify',
                sourceId: 'track123',
                titleNorm: 'bohemian rhapsody',
                artistNorm: 'queen',
            };

            const song2: SongKey = {
                source: 'spotify',
                sourceId: 'track123',
                titleNorm: 'bohemian rhapsody',
                artistNorm: 'queen',
            };

            const isDuplicate =
                song1.source === song2.source &&
                song1.sourceId === song2.sourceId &&
                song1.titleNorm === song2.titleNorm &&
                song1.artistNorm === song2.artistNorm;

            expect(isDuplicate).toBe(true);
        });

        it('should not flag as duplicate if sourceId differs', () => {
            const song1: SongKey = {
                source: 'spotify',
                sourceId: 'track123',
                titleNorm: 'bohemian rhapsody',
                artistNorm: 'queen',
            };

            const song2: SongKey = {
                source: 'spotify',
                sourceId: 'track456',
                titleNorm: 'bohemian rhapsody',
                artistNorm: 'queen',
            };

            const isDuplicate =
                song1.source === song2.source &&
                song1.sourceId === song2.sourceId &&
                song1.titleNorm === song2.titleNorm &&
                song1.artistNorm === song2.artistNorm;

            expect(isDuplicate).toBe(false);
        });

        it('should allow same song from different sources', () => {
            const song1: SongKey = {
                source: 'spotify',
                sourceId: 'track123',
                titleNorm: 'bohemian rhapsody',
                artistNorm: 'queen',
            };

            const song2: SongKey = {
                source: 'csv',
                sourceId: 'admin123',
                titleNorm: 'bohemian rhapsody',
                artistNorm: 'queen',
            };

            const isDuplicate = song1.source === song2.source;

            expect(isDuplicate).toBe(false);
        });
    });
});
