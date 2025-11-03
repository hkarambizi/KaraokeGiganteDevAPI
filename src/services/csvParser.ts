export interface ParsedSong {
    title: string;
    artist: string;
    album?: string;
    duration?: number; // in seconds
    genre?: string;
    rowNumber: number;
    errors?: string[];
}

export interface CSVParseResult {
    success: boolean;
    songs: ParsedSong[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    errors: Array<{ row: number; message: string }>;
}

/**
 * Parse CSV data into song objects
 * Supports various CSV formats and handles common issues
 */
export function parseCSV(csvData: string): CSVParseResult {
    const lines = csvData.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

    if (lines.length === 0) {
        return {
            success: false,
            songs: [],
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            errors: [{ row: 0, message: 'CSV data is empty' }],
        };
    }

    // Parse header
    const header = parseCSVLine(lines[0]);
    const headerMap = mapHeaders(header);

    if (!headerMap.title || !headerMap.artist) {
        return {
            success: false,
            songs: [],
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            errors: [{ row: 1, message: 'CSV must have "title" and "artist" columns' }],
        };
    }

    const songs: ParsedSong[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const rowNumber = i + 1;

        try {
            const fields = parseCSVLine(line);

            if (fields.length === 0) continue;

            const title = fields[headerMap.title]?.trim() || '';
            const artist = fields[headerMap.artist]?.trim() || '';

            if (!title || !artist) {
                errors.push({
                    row: rowNumber,
                    message: 'Missing required fields: title or artist',
                });
                continue;
            }

            const albumField = headerMap.album !== undefined ? fields[headerMap.album]?.trim() : undefined;
            const album = albumField && albumField.length > 0 ? albumField : undefined;

            const durationField = headerMap.duration !== undefined ? fields[headerMap.duration]?.trim() : undefined;
            const durationStr = durationField && durationField.length > 0 ? durationField : undefined;

            const genreField = headerMap.genre !== undefined ? fields[headerMap.genre]?.trim() : undefined;
            const genre = genreField && genreField.length > 0 ? genreField : undefined;

            const duration = parseDuration(durationStr);

            const songErrors: string[] = [];

            if (duration !== undefined && (duration < 0 || duration > 3600)) {
                songErrors.push('Invalid duration (must be between 0 and 3600 seconds)');
            }

            songs.push({
                title,
                artist,
                album,
                duration,
                genre,
                rowNumber,
                errors: songErrors.length > 0 ? songErrors : undefined,
            });
        } catch (error: any) {
            errors.push({
                row: rowNumber,
                message: error.message || 'Failed to parse row',
            });
        }
    }

    return {
        success: true,
        songs,
        totalRows: lines.length - 1, // Exclude header
        validRows: songs.filter((s) => !s.errors || s.errors.length === 0).length,
        invalidRows: songs.filter((s) => s.errors && s.errors.length > 0).length,
        errors,
    };
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                currentField += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Field delimiter
            fields.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }

    // Add last field
    fields.push(currentField);

    return fields.map((f) => f.trim());
}

/**
 * Map CSV headers to known fields
 */
function mapHeaders(headers: string[]): {
    title?: number;
    artist?: number;
    album?: number;
    duration?: number;
    genre?: number;
} {
    const map: {
        title?: number;
        artist?: number;
        album?: number;
        duration?: number;
        genre?: number;
    } = {};

    headers.forEach((header, index) => {
        const normalized = header.toLowerCase().trim();

        if (normalized === 'title' || normalized === 'song' || normalized === 'name') {
            map.title = index;
        } else if (normalized === 'artist' || normalized === 'artists') {
            map.artist = index;
        } else if (normalized === 'album') {
            map.album = index;
        } else if (
            normalized === 'duration' ||
            normalized === 'length' ||
            normalized === 'time'
        ) {
            map.duration = index;
        } else if (normalized === 'genre' || normalized === 'genres') {
            map.genre = index;
        }
    });

    return map;
}

/**
 * Parse duration from various formats
 * Supports: "5:23", "323", "5m23s"
 */
function parseDuration(durationStr?: string): number | undefined {
    if (!durationStr) return undefined;

    const str = durationStr.trim();

    // Try parsing as seconds directly
    const seconds = parseInt(str);
    if (!isNaN(seconds) && seconds >= 0) {
        return seconds;
    }

    // Try parsing MM:SS format
    const mmssMatch = str.match(/^(\d+):(\d{1,2})$/);
    if (mmssMatch) {
        const minutes = parseInt(mmssMatch[1]);
        const secs = parseInt(mmssMatch[2]);
        return minutes * 60 + secs;
    }

    // Try parsing "5m23s" format
    const minsSecsMatch = str.match(/^(\d+)m\s*(\d+)s$/);
    if (minsSecsMatch) {
        const minutes = parseInt(minsSecsMatch[1]);
        const secs = parseInt(minsSecsMatch[2]);
        return minutes * 60 + secs;
    }

    return undefined;
}

/**
 * Validate parsed songs before committing
 */
export function validateSongs(songs: ParsedSong[]): {
    valid: ParsedSong[];
    invalid: ParsedSong[];
} {
    const valid: ParsedSong[] = [];
    const invalid: ParsedSong[] = [];

    for (const song of songs) {
        if (!song.title || song.title.length < 1) {
            song.errors = song.errors || [];
            song.errors.push('Title is required');
            invalid.push(song);
            continue;
        }

        if (!song.artist || song.artist.length < 1) {
            song.errors = song.errors || [];
            song.errors.push('Artist is required');
            invalid.push(song);
            continue;
        }

        if (song.errors && song.errors.length > 0) {
            invalid.push(song);
        } else {
            valid.push(song);
        }
    }

    return { valid, invalid };
}

