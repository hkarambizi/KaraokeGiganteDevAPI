/**
 * API Contracts & Types
 *
 * IMPORTANT: These types MUST stay in sync between frontend and backend.
 * Any changes here should be communicated to the frontend team immediately.
 *
 * Version: 4.0.1
 * Last Updated: 2025-11-03
 *
 * CHANGELOG:
 * - v4.0.1: Org creation contract aligned (name, slug, logoUrl?), explicit GET/POST /api/users/me support
 * - v4.0.0: NEW ARCHITECTURE - Singer/Host separation, role management via collections
 * - v3.0.0: Added Catalog system (Artist, Album, multi-source Songs), Import system
 * - v2.0.0: Added Spotify integration and Playlist types
 * - v1.1.0: Added username field (REQUIRED), email now optional
 *
 * BREAKING CHANGES IN v4.0.0:
 * - User no longer has role or orgId fields (profile only)
 * - New Singer collection for singer-specific data
 * - New Host collection for admin-specific data + view preference
 * - Host record presence = admin access
 * - View switching via Host.currentView instead of Clerk metadata
 */

// ==========================================
// USER TYPES
// ==========================================

// User - Profile only (v4.0.0: removed role and orgId)
export interface User {
    _id: string;
    clerkId: string;
    username: string; // REQUIRED - Added in v1.1.0
    email?: string; // OPTIONAL - Changed in v1.1.0 (was required)
    phoneNumber?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatar?: string;
    pushToken?: string;
    createdAt: string;
    updatedAt: string;
}

// Singer - Singer-specific data (v4.0.0: new collection)
export interface Singer {
    _id: string;
    clerkId: string;
    userId: string; // Reference to User._id
    favorites: string[]; // Array of Song IDs
    checkIns: Array<{
        eventId: string;
        timestamp: string;
    }>;
    friends: string[]; // Array of User IDs
    createdAt: string;
    updatedAt: string;
}

// Host - Admin-specific data + view preference (v4.0.0: new collection)
export interface Host {
    _id: string;
    clerkId: string;
    userId: string; // Reference to User._id
    calendar: string[]; // Array of Event IDs
    imports: Array<{
        source: 'spotify' | 'csv';
        importId?: string;
        songIds: string[];
        importedAt: string;
    }>;
    currentView: 'host' | 'guest'; // View preference for switching experiences
    createdAt: string;
    updatedAt: string;
}

export interface UserSearchResult {
    _id: string;
    clerkId: string;
    username: string; // Added in v1.1.0
    displayName: string;
    email?: string; // Now optional in v1.1.0
    avatar?: string;
}

export interface UpdateUserRequest {
    username?: string; // Added in v1.1.0
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatar?: string;
    phoneNumber?: string;
    email?: string; // Added in v1.1.0
}

// ==========================================
// ORGANIZATION TYPES
// ==========================================

export interface Organization {
    _id: string;
    clerkOrgId: string;
    name: string;
    slug: string;
    logoUrl?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateOrganizationRequest {
    name: string;
    slug: string; // lowercase, hyphenated
    logoUrl?: string;
}

export interface CreateOrganizationResponse {
    orgId: string; // MongoDB _id
    clerkOrgId: string;
    name: string;
    slug: string;
    logoUrl?: string;
    createdAt: string;
    updatedAt: string;
}

// ==========================================
// SONG TYPES
// ==========================================

export interface Song {
    _id: string;
    spotifyId?: string;
    source: 'spotify' | 'csv' | 'manual';
    sourceId?: string;
    title: string;
    artists: string[];
    album?: string;
    coverArt?: string;
    durationMs?: number;
    videoUrl?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SongSearchResponse {
    page: number;
    limit: number;
    total: number;
    nextPage: number | null;
    songs: Song[];
}

export interface SaveSongFromSpotifyRequest {
    trackId: string;
    title: string;
    artists: string[];
    album?: string;
    coverArt?: string;
    durationMs?: number;
}

export interface SaveSongFromSpotifyResponse {
    duplicate: boolean;
    song: Song;
}

// ==========================================
// EVENT TYPES
// ==========================================

export interface Event {
    _id: string;
    orgId: string;
    name: string;
    date: string;
    venue?: string;
    status: 'draft' | 'active' | 'closed';
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateEventRequest {
    name: string;
    date: string;
    venue?: string;
}

export interface UpdateEventRequest {
    name?: string;
    date?: string;
    venue?: string;
    status?: 'draft' | 'active' | 'closed';
}

// ==========================================
// REQUEST TYPES
// ==========================================

export interface Request {
    _id: string;
    eventId: string;
    songId: string;
    userId: string;
    coSingers: string[];
    status: 'pending_admin' | 'approved' | 'rejected' | 'queued' | 'performed';
    videoUrl?: string;
    inCrate: boolean;
    rejectionReason?: string;
    queuePosition?: number;
    fastPass?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface RequestWithPopulated extends Omit<Request, 'songId' | 'userId' | 'coSingers'> {
    song: Song;
    user: User;
    coSingersData: User[];
}

export interface CreateRequestRequest {
    songId: string;
    coSingers?: string[];
}

export interface ApproveRequestRequest {
    addToCrate?: boolean;
}

export interface RejectRequestRequest {
    reason: string;
}

export interface UpdateVideoRequest {
    videoUrl: string;
}

// ==========================================
// CRATE TYPES
// ==========================================

export interface Crate {
    _id: string;
    eventId: string;
    songIds: string[];
    songs: Song[];
    createdAt: string;
    updatedAt: string;
}

export interface AddSongToCrateRequest {
    songId: string;
}

export interface MergeCratesRequest {
    crateIds: string[];
}

export interface MergeCratesResponse {
    added: number;
    skipped: number;
    duplicates: string[];
}

// ==========================================
// NOTIFICATION TYPES
// ==========================================

export interface RegisterDeviceRequest {
    token: string;
    platform?: 'ios' | 'android' | 'web';
}

export interface BroadcastRequest {
    eventId?: string;
    message: string;
}

export interface BroadcastResponse {
    sent: number;
}

// ==========================================
// ERROR TYPES
// ==========================================

export interface ApiError {
    error: string;
    code: string;
    details?: any;
}

// ==========================================
// HEALTH CHECK
// ==========================================

export interface HealthCheckResponse {
    status: 'ok' | 'error';
    timestamp: string;
    environment: 'development' | 'production' | 'test';
}

// ==========================================
// DEVELOPMENT (DEV MODE ONLY)
// ==========================================

export interface ChangelogEntry {
    agent: 'frontend' | 'backend';
    timestamp: string;
    tasks: string[];
    notes: string[];
    pendingRequirements?: string[];
    questions?: string[];
}

export interface ChangelogResponse {
    exists: boolean;
    content: string | null;
    lastModified: string | null;
}

// ==========================================
// USERS (ME) ENDPOINTS
// ==========================================
/**
 * Current user profile fetch
 *
 * GET /api/users/me   → Preferred
 * POST /api/users/me  → Compatibility alias (some clients POST after flows)
 */

// ==========================================
// SPOTIFY INTEGRATION
// ==========================================

export interface SpotifyStatus {
    connected: boolean;
    connectedBy?: string;
    connectedAt?: number;
    scopes?: string[];
}

export interface ExchangeSpotifyCodeRequest {
    code: string;
    redirectUri: string;
}

export interface ExchangeSpotifyCodeResponse {
    success: boolean;
    spotifyConnected: boolean;
}

// ==========================================
// PLAYLISTS
// ==========================================

export interface SpotifyPlaylistData {
    playlistId: string;
    name: string;
    description: string;
    href: string;
    playlistUrl: string;
    tracksUrl: string;
}

export interface Playlist {
    _id: string;
    orgId: string;
    authorId: string;
    name: string;
    description?: string;
    songIds: string[];
    spotifyPlaylist?: SpotifyPlaylistData;
    isPublished: boolean;
    publishedAt?: string;
    publishedBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePlaylistRequest {
    name: string;
    description?: string;
    songIds?: string[];
}

export interface UpdatePlaylistRequest {
    name?: string;
    description?: string;
    songIds?: string[];
}

export interface PlaylistResponse {
    playlist: Playlist;
}

export interface PlaylistsResponse {
    playlists: Playlist[];
}

export interface PublishPlaylistResponse {
    success: boolean;
    playlist: Playlist;
}

// ==========================================
// CATALOG SYSTEM
// ==========================================

export interface Artist {
    _id: string;
    name: string;
    name_norm: string;
    source?: 'spotify' | 'csv' | 'manual';
    sourceId?: string;
    imageUrl?: string;
    genres?: string[];
    popularity?: number;
    createdAt: string;
    updatedAt: string;
}

export interface Album {
    _id: string;
    title: string;
    title_norm: string;
    artistId: string;
    releaseYear?: number;
    source?: 'spotify' | 'csv' | 'manual';
    sourceId?: string;
    imageUrl?: string;
    genres?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface SongSource {
    source: 'spotify' | 'csv' | 'youtube' | 'manual';
    sourceId: string;
}

export interface CatalogSong {
    _id: string;
    title: string;
    title_norm: string;
    artistId: string;
    artistName: string; // Denormalized for search
    albumId?: string;
    albumTitle?: string; // Denormalized for search
    durationSec?: number;
    genres?: string[];
    popularity?: number;
    albumArt?: string;
    videoUrl?: string;
    sources: SongSource[];
    signature: string;
    createdAt: string;
    updatedAt: string;
}

export interface SpotifySearchResult {
    sourceId: string; // Spotify track ID
    title: string;
    artist: string;
    albumName: string;
    duration: number;
    albumArt?: string;
    spotifyUrl?: string;
    popularity?: number;
}

export interface SpotifySearchRequest {
    q: string;
    limit?: number;
}

export interface SpotifySearchResponse {
    tracks: SpotifySearchResult[];
}

export interface SaveFromSpotifyRequest {
    trackId: string;
}

export interface SaveFromSpotifyResponse {
    inserted: boolean;
    song?: CatalogSong;
    existingId?: string;
    message?: string;
}

export interface CatalogSearchRequest {
    q: string;
    artistId?: string;
    albumId?: string;
    genre?: string;
}

export interface CatalogSearchResponse {
    songs: Array<{
        _id: string;
        title: string;
        artistName: string;
        albumTitle?: string;
        durationSec?: number;
        genres?: string[];
        albumArt?: string;
        popularity?: number;
        score?: number;
    }>;
    cached: boolean;
}

// ==========================================
// IMPORT SYSTEM
// ==========================================

export interface AddToPlaylistRequest {
    songId: string;
}

export interface AddToPlaylistResponse {
    added: boolean;
    total: number;
    songId: string;
}

export interface GetPlaylistResponse {
    songs: Array<{
        _id: string;
        title: string;
        artistName: string;
        albumTitle?: string;
        durationSec?: number;
        albumArt?: string;
        genres?: string[];
    }>;
    total: number;
}

export interface CSVPreviewRequest {
    csvData: string;
}

export interface CSVPreviewResponse {
    draftId: string;
    preview: Array<{
        title: string;
        artist: string;
        album?: string;
        duration?: number;
        genre?: string;
        rowNumber: number;
        errors?: string[];
    }>;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    errors: Array<{ row: number; message: string }>;
}

export interface CSVCommitRequest {
    draftId: string;
    playlistName?: string;
}

export interface CSVCommitResponse {
    success: boolean;
    inserted: number;
    updated: number;
    errors: Array<{ row: number; message: string }>;
    totalSaved: number;
    invalidSongs: number;
}

// ==========================================
// ROLE MANAGEMENT (v4.0.0: Updated for Singer/Host architecture)
// ==========================================

// Check role status (v4.0.0: new endpoint)
export interface CheckRoleResponse {
    isSinger: boolean;
    isHost: boolean;
    currentView: 'host' | 'guest';
    effectiveRole: 'admin' | 'singer';
    clerkOrganizations: Array<{
        id: string;
        name: string;
        role: string;
    }>;
}

// Switch view (v4.0.0: renamed from switch-role, uses Host.currentView)
export interface SwitchViewRequest {
    view: 'host' | 'guest';
}

export interface SwitchViewResponse {
    success: boolean;
    message: string;
    currentView: string;
    effectiveRole: string;
    viewMode: string;
}

// Force promote to Host (v4.0.0: creates Host record)
export interface ForcePromoteResponse {
    success: boolean;
    message: string;
    isHost: boolean;
    currentView: string;
    hasOrganizations: boolean;
}
