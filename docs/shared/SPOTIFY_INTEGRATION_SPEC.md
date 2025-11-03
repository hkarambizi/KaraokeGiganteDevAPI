# Spotify Integration Specification

**Date:** 2025-10-08
**Author:** Frontend Team
**Version:** 1.0.0

## Overview

This document specifies the Spotify integration for the Karaoke Gigante platform, enabling organization admins to publish playlists from the app to Spotify.

---

## Architecture

### Frontend Flow

1. **Admin navigates to Settings** (only accessible to users with `role: 'admin'`)
2. **Clicks "Connect to Spotify"**
3. **Opens Spotify OAuth authorization** using Authorization Code Flow with PKCE
4. **Receives authorization code** and sends to backend
5. **Backend exchanges code for tokens** and stores in Clerk metadata
6. **Admin can now publish playlists** from the Music Library

### Backend Responsibilities

1. **Exchange authorization code for access_token and refresh_token**
2. **Store tokens securely in Clerk user private metadata**
3. **Store organization-level Spotify connection metadata**
4. **Handle token refresh** when access_token expires
5. **Publish playlists to Spotify** on behalf of the user

---

## Data Models

### New Collection: `playlists`

```typescript
interface Playlist {
	_id: string;
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
```

### Updated: User Private Metadata (Clerk)

```typescript
interface UserPrivateMetadata {
	// ... existing fields ...

	// Spotify OAuth tokens
	spotifyToken?: string; // Access token
	spotifyRefreshToken?: string; // Refresh token
	spotifyTokenExpiresAt?: number; // Unix timestamp
	spotifyTokenScope?: string; // Granted scopes
}
```

### Updated: Organization Private Metadata (Clerk)

```typescript
interface OrganizationPrivateMetadata {
	// ... existing fields ...

	// Spotify integration
	playlistUser?: string; // Clerk user ID who connected Spotify
	spotifyConnectedAt?: number; // Unix timestamp
}
```

---

## API Endpoints

### 1. Exchange Spotify Authorization Code

**POST** `/api/spotify/exchange-code`

Exchange the Spotify authorization code for access and refresh tokens.

**Request:**

```typescript
{
	code: string; // Authorization code from Spotify
	redirectUri: string; // Must match the one used in auth request
}
```

**Process:**

1. Extract `code` and `redirectUri` from request
2. Call Spotify `/api/token` endpoint with:
   - `grant_type: 'authorization_code'`
   - `code: <authorization_code>`
   - `redirect_uri: <redirect_uri>`
   - `Authorization: Basic <base64(client_id:client_secret)>`
3. Receive `access_token`, `refresh_token`, `expires_in`, `scope`
4. Store in user's private metadata via Clerk:
   ```typescript
   await clerkClient.users.updateUserMetadata(userId, {
   	privateMetadata: {
   		spotifyToken: access_token,
   		spotifyRefreshToken: refresh_token,
   		spotifyTokenExpiresAt: Date.now() + expires_in * 1000,
   		spotifyTokenScope: scope,
   	},
   });
   ```
5. Update organization metadata:
   ```typescript
   await clerkClient.organizations.updateOrganizationMetadata(orgId, {
   	privateMetadata: {
   		playlistUser: userId,
   		spotifyConnectedAt: Date.now(),
   	},
   });
   ```

**Response:**

```typescript
{
	success: boolean;
	spotifyConnected: boolean;
}
```

**Error Handling:**

- 400: Invalid code or redirect URI
- 401: Spotify authentication failed
- 500: Server error

---

### 2. Check Spotify Connection Status

**GET** `/api/spotify/status`

Check if the organization has an active Spotify connection.

**Response:**

```typescript
{
  connected: boolean;
  connectedBy?: string; // User ID who connected
  connectedAt?: number; // Unix timestamp
  scopes?: string[]; // Granted scopes
}
```

---

### 3. Refresh Spotify Token

**POST** `/api/spotify/refresh-token`

Refresh the Spotify access token using the refresh token.

**Process:**

1. Get user's `spotifyRefreshToken` from Clerk metadata
2. Call Spotify `/api/token` endpoint with:
   - `grant_type: 'refresh_token'`
   - `refresh_token: <refresh_token>`
   - `Authorization: Basic <base64(client_id:client_secret)>`
3. Receive new `access_token` and `expires_in`
4. Update user's metadata with new token

**Response:**

```typescript
{
	success: boolean;
}
```

---

### 4. Disconnect Spotify

**DELETE** `/api/spotify/disconnect`

Remove Spotify integration for the organization.

**Process:**

1. Clear Spotify tokens from user's private metadata
2. Clear `playlistUser` from organization's private metadata

**Response:**

```typescript
{
	success: boolean;
}
```

---

### 5. Create Playlist

**POST** `/api/playlists`

Create a new playlist in MongoDB.

**Request:**

```typescript
{
  name: string;
  description?: string;
  songIds: string[]; // Array of Song._id
}
```

**Process:**

1. Verify user is admin
2. Get user's organization
3. Create playlist document in MongoDB

**Response:**

```typescript
{
	playlist: Playlist;
}
```

---

### 6. List Playlists

**GET** `/api/playlists?orgId=<orgId>`

Get all playlists for an organization.

**Response:**

```typescript
{
  playlists: Playlist[];
}
```

---

### 7. Publish Playlist to Spotify

**POST** `/api/playlists/:playlistId/publish`

Publish a playlist to Spotify.

**Process:**

1. Verify user is admin
2. Get playlist from MongoDB
3. Get user's Spotify token from Clerk metadata
4. Check if token is expired, refresh if needed
5. Get Spotify user ID:
   ```
   GET https://api.spotify.com/v1/me
   Authorization: Bearer <access_token>
   ```
6. Create Spotify playlist:
   ```
   POST https://api.spotify.com/v1/users/{user_id}/playlists
   Authorization: Bearer <access_token>
   {
     "name": playlist.name,
     "description": playlist.description,
     "public": false
   }
   ```
7. Get song details from MongoDB and find Spotify URIs
8. Add tracks to Spotify playlist:
   ```
   POST https://api.spotify.com/v1/playlists/{playlist_id}/tracks
   Authorization: Bearer <access_token>
   {
     "uris": ["spotify:track:...", ...]
   }
   ```
9. Update playlist document in MongoDB with Spotify data

**Response:**

```typescript
{
	success: boolean;
	playlist: Playlist; // Updated with Spotify data
}
```

**Error Handling:**

- 401: Spotify not connected or token expired
- 403: User not authorized
- 404: Playlist not found
- 500: Spotify API error

---

### 8. Unpublish Playlist from Spotify

**DELETE** `/api/playlists/:playlistId/unpublish`

Remove Spotify association from a playlist (does not delete from Spotify).

**Process:**

1. Update playlist document, set `spotifyPlaylist: null`, `isPublished: false`

**Response:**

```typescript
{
	success: boolean;
}
```

---

## Spotify OAuth Configuration

### Required Environment Variables

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=exp://your-app/--/spotify-callback
```

### Required Scopes

- `playlist-modify-public` - Create and modify public playlists
- `playlist-modify-private` - Create and modify private playlists
- `playlist-read-private` - Read private playlists
- `playlist-read-collaborative` - Read collaborative playlists

### Authorization Flow (PKCE for Mobile)

1. **Frontend initiates auth:**

   ```
   GET https://accounts.spotify.com/authorize
   ?client_id=<client_id>
   &response_type=code
   &redirect_uri=<redirect_uri>
   &scope=<scopes>
   &state=<random_state>
   &show_dialog=true
   ```

2. **User authorizes, Spotify redirects:**

   ```
   <redirect_uri>?code=<authorization_code>&state=<state>
   ```

3. **Frontend sends code to backend**

4. **Backend exchanges code:**

   ```
   POST https://accounts.spotify.com/api/token
   Content-Type: application/x-www-form-urlencoded
   Authorization: Basic <base64(client_id:client_secret)>

   grant_type=authorization_code
   &code=<authorization_code>
   &redirect_uri=<redirect_uri>
   ```

5. **Spotify returns tokens:**
   ```json
   {
   	"access_token": "NgCXRK...MzYjw",
   	"token_type": "Bearer",
   	"scope": "playlist-modify-public playlist-modify-private...",
   	"expires_in": 3600,
   	"refresh_token": "NgAagA...Um_SHo"
   }
   ```

---

## Security Considerations

### Token Storage

✅ **DO:**

- Store tokens in Clerk **private metadata** (not public metadata)
- Store refresh tokens securely
- Set expiration timestamps
- Use HTTPS for all requests

❌ **DON'T:**

- Store tokens in client-side storage
- Expose tokens in logs or error messages
- Store tokens in public metadata
- Share tokens between users

### Token Refresh

- Check expiration before each API call
- Automatically refresh if expired
- Handle refresh failures gracefully
- Implement retry logic with exponential backoff

### Access Control

- ✅ Only admins can connect/disconnect Spotify
- ✅ Only admins can publish playlists
- ✅ Verify organization membership before any Spotify operation
- ✅ Validate all Spotify API responses

---

## Frontend Integration

### Environment Variable

Add to `.env`:

```env
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id_here
```

### Deep Linking Setup

Update `app.config.js`:

```javascript
{
  scheme: 'karaokegiganteapp',
  // ... other config
}
```

### Spotify Callback Handler

The frontend already handles the OAuth callback in the Settings screen. When the user authorizes, the app receives the code and needs to send it to the backend.

**Add this SDK method:**

```typescript
// In src/services/kgSDK.ts

async exchangeSpotifyCode(code: string, redirectUri: string): Promise<{ success: boolean }> {
  return this.request<{ success: boolean }>('/api/spotify/exchange-code', {
    method: 'POST',
    body: { code, redirectUri },
  });
}

async checkSpotifyStatus(): Promise<{
  connected: boolean;
  connectedBy?: string;
  connectedAt?: number;
}> {
  return this.request('/api/spotify/status');
}

async disconnectSpotify(): Promise<{ success: boolean }> {
  return this.request<{ success: boolean }>('/api/spotify/disconnect', {
    method: 'DELETE',
  });
}

async createPlaylist(data: {
  name: string;
  description?: string;
  songIds: string[];
}): Promise<{ playlist: any }> {
  return this.request('/api/playlists', {
    method: 'POST',
    body: data,
  });
}

async listPlaylists(orgId: string): Promise<{ playlists: any[] }> {
  return this.request(`/api/playlists?orgId=${orgId}`);
}

async publishPlaylist(playlistId: string): Promise<{ success: boolean; playlist: any }> {
  return this.request(`/api/playlists/${playlistId}/publish`, {
    method: 'POST',
  });
}

async unpublishPlaylist(playlistId: string): Promise<{ success: boolean }> {
  return this.request(`/api/playlists/${playlistId}/unpublish`, {
    method: 'DELETE',
  });
}
```

---

## Testing Checklist

### Spotify OAuth

- [ ] Connect Spotify with valid credentials
- [ ] Receive and store tokens correctly
- [ ] Handle authorization denial
- [ ] Handle state mismatch (CSRF protection)
- [ ] Handle expired authorization code

### Token Management

- [ ] Access token stored in private metadata
- [ ] Refresh token stored securely
- [ ] Token expiration calculated correctly
- [ ] Token refresh works automatically
- [ ] Token refresh handles failures

### Playlist Publishing

- [ ] Create playlist in MongoDB
- [ ] Publish playlist to Spotify
- [ ] Verify playlist created on Spotify
- [ ] Tracks added correctly
- [ ] Playlist metadata updated in MongoDB
- [ ] Handle missing Spotify URIs
- [ ] Handle Spotify API rate limits

### Access Control

- [ ] Only admins can connect Spotify
- [ ] Only admins can publish playlists
- [ ] Organization membership verified
- [ ] Singers cannot access admin routes
- [ ] Guest view toggle works for admins

---

## Migration Notes

### Existing Data

- No migration needed for existing collections
- New `playlists` collection will be created automatically
- Existing users/orgs will have empty Spotify metadata

### Rollback Plan

- If issues arise, simply remove Spotify metadata from Clerk
- Playlists collection can remain but `isPublished` will be false
- No data loss risk

---

## Future Enhancements

1. **Sync Playlists**: Keep MongoDB and Spotify playlists in sync
2. **Playlist Templates**: Pre-defined playlist structures
3. **Collaborative Playlists**: Allow multiple admins to edit
4. **Playlist Analytics**: Track plays and popularity
5. **Import from Spotify**: Import existing Spotify playlists
6. **Spotify Search**: Use Spotify search API for song discovery

---

## References

- [Spotify Authorization Code Flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow)
- [Spotify Web API Reference](https://developer.spotify.com/documentation/web-api/reference)
- [Clerk Metadata Documentation](https://clerk.com/docs/users/metadata)
- [Expo Linking Documentation](https://docs.expo.dev/guides/linking/)

---

## Questions for Backend Team

1. **Preferred approach for token refresh**: Automatic on every request vs. explicit refresh endpoint?
2. **Rate limiting**: Should we implement request queuing for Spotify API calls?
3. **Error handling**: How should we handle permanent Spotify API failures (e.g., user revokes access)?
4. **Monitoring**: Should we log all Spotify API calls for debugging?
5. **Song matching**: How should we handle songs without Spotify URIs?

---

**Status**: ✅ Specification Complete
**Next Steps**: Backend implementation
