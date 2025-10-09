/**
 * API Contracts & Types
 *
 * IMPORTANT: These types MUST stay in sync between frontend and backend.
 * Any changes here should be communicated to the frontend team immediately.
 *
 * Version: 2.0.0
 * Last Updated: 2024-10-08
 *
 * CHANGELOG:
 * - v2.0.0: Added Spotify integration and Playlist types
 * - v1.1.0: Added username field (REQUIRED), email now optional
 */

// ==========================================
// USER TYPES
// ==========================================

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
    role?: 'singer' | 'admin';
    orgId?: string;
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
    ownerId: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateOrganizationRequest {
    name: string;
}

export interface CreateOrganizationResponse {
    orgId: string;
    name: string;
    ownerId: string;
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
