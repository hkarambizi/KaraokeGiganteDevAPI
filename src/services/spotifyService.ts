import axios from 'axios';
import { env } from '../config/env.js';
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

const SPOTIFY_ACCOUNTS_API = 'https://accounts.spotify.com';
const SPOTIFY_API = 'https://api.spotify.com/v1';

export interface SpotifyTokenResponse {
    access_token: string;
    token_type: string;
    scope: string;
    expires_in: number;
    refresh_token?: string;
}

export interface SpotifyUserProfile {
    id: string;
    display_name: string;
    email: string;
    href: string;
}

export interface SpotifyPlaylistResponse {
    id: string;
    name: string;
    description: string;
    href: string;
    external_urls: {
        spotify: string;
    };
    tracks: {
        href: string;
    };
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(
    code: string,
    redirectUri: string
): Promise<SpotifyTokenResponse> {
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
        throw new Error('Spotify credentials not configured');
    }

    const basicAuth = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const response = await axios.post<SpotifyTokenResponse>(
        `${SPOTIFY_ACCOUNTS_API}/api/token`,
        new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }).toString(),
        {
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }
    );

    return response.data;
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
        throw new Error('Spotify credentials not configured');
    }

    const basicAuth = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const response = await axios.post<SpotifyTokenResponse>(
        `${SPOTIFY_ACCOUNTS_API}/api/token`,
        new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }).toString(),
        {
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }
    );

    return response.data;
}

/**
 * Get Spotify user profile
 */
export async function getSpotifyUserProfile(accessToken: string): Promise<SpotifyUserProfile> {
    const response = await axios.get<SpotifyUserProfile>(`${SPOTIFY_API}/me`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    return response.data;
}

/**
 * Create a Spotify playlist
 */
export async function createSpotifyPlaylist(
    accessToken: string,
    userId: string,
    name: string,
    description: string = '',
    isPublic: boolean = false
): Promise<SpotifyPlaylistResponse> {
    const response = await axios.post<SpotifyPlaylistResponse>(
        `${SPOTIFY_API}/users/${userId}/playlists`,
        {
            name,
            description,
            public: isPublic,
        },
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );

    return response.data;
}

/**
 * Add tracks to a Spotify playlist
 */
export async function addTracksToSpotifyPlaylist(
    accessToken: string,
    playlistId: string,
    spotifyUris: string[]
): Promise<void> {
    // Spotify API allows max 100 tracks per request
    const chunkSize = 100;

    for (let i = 0; i < spotifyUris.length; i += chunkSize) {
        const chunk = spotifyUris.slice(i, i + chunkSize);

        await axios.post(
            `${SPOTIFY_API}/playlists/${playlistId}/tracks`,
            {
                uris: chunk,
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    }
}

/**
 * Get or refresh access token from Clerk metadata
 * Automatically refreshes if expired
 */
export async function getValidAccessToken(clerkUserId: string): Promise<string> {
    const user = await clerk.users.getUser(clerkUserId);
    const privateMetadata = user.privateMetadata as any;

    if (!privateMetadata.spotifyRefreshToken) {
        throw new Error('Spotify not connected. Please connect Spotify first.');
    }

    // Check if access token exists and is not expired
    const now = Date.now();
    const expiresAt = privateMetadata.spotifyTokenExpiresAt || 0;

    if (privateMetadata.spotifyToken && expiresAt > now) {
        // Token is still valid
        return privateMetadata.spotifyToken;
    }

    // Token expired or doesn't exist, refresh it
    console.log('🔄 Refreshing Spotify access token for user:', clerkUserId);

    const tokenResponse = await refreshAccessToken(privateMetadata.spotifyRefreshToken);

    // Update user metadata with new token
    await clerk.users.updateUserMetadata(clerkUserId, {
        privateMetadata: {
            spotifyToken: tokenResponse.access_token,
            spotifyTokenExpiresAt: Date.now() + tokenResponse.expires_in * 1000,
            spotifyTokenScope: tokenResponse.scope,
            // Keep the refresh token (it doesn't change unless a new one is provided)
            spotifyRefreshToken: tokenResponse.refresh_token || privateMetadata.spotifyRefreshToken,
        },
    });

    return tokenResponse.access_token;
}

/**
 * Store Spotify tokens in Clerk user metadata
 */
export async function storeSpotifyTokens(
    clerkUserId: string,
    orgId: string,
    tokenResponse: SpotifyTokenResponse
): Promise<void> {
    // Store tokens in user's private metadata
    await clerk.users.updateUserMetadata(clerkUserId, {
        privateMetadata: {
            spotifyToken: tokenResponse.access_token,
            spotifyRefreshToken: tokenResponse.refresh_token,
            spotifyTokenExpiresAt: Date.now() + tokenResponse.expires_in * 1000,
            spotifyTokenScope: tokenResponse.scope,
        },
    });

    // Store connection info in organization metadata
    await clerk.organizations.updateOrganizationMetadata(orgId, {
        privateMetadata: {
            playlistUser: clerkUserId,
            spotifyConnectedAt: Date.now(),
        },
    });
}

/**
 * Clear Spotify tokens from Clerk metadata
 */
export async function clearSpotifyTokens(clerkUserId: string, orgId: string): Promise<void> {
    // Clear user metadata
    await clerk.users.updateUserMetadata(clerkUserId, {
        privateMetadata: {
            spotifyToken: null,
            spotifyRefreshToken: null,
            spotifyTokenExpiresAt: null,
            spotifyTokenScope: null,
        },
    });

    // Clear organization metadata
    await clerk.organizations.updateOrganizationMetadata(orgId, {
        privateMetadata: {
            playlistUser: null,
            spotifyConnectedAt: null,
        },
    });
}

