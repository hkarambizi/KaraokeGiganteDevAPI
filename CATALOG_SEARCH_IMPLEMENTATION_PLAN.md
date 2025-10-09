# Catalog & Search System - Implementation Plan

**Date:** 2024-10-08
**Status:** 🚧 IN PROGRESS

---

## ✅ Completed So Far

### 1. Data Models Created

**Artist Model (`src/models/Artist.ts`):**

- ✅ Unique `name_norm` index for deduplication
- ✅ Source tracking (spotify/csv/manual)
- ✅ Helper function `findOrCreateArtist()`
- ✅ Auto-normalization on save

**Album Model (`src/models/Album.ts`):**

- ✅ Compound unique index: `(artistId, title_norm, releaseYear)`
- ✅ Artist reference with proper indexing
- ✅ Helper function `findOrCreateAlbum()`
- ✅ Auto-normalization on save

**Enhanced Song Model (`src/models/Song.ts`):**

- ✅ Multi-source support with `sources[]` array
- ✅ Signature-based deduplication (SHA1 hash)
- ✅ Denormalized `artistName` and `albumTitle` for fast search
- ✅ Multiple indexes for performance
- ✅ Helper functions: `generateSongSignature()`, `hasSource()`, `addSourceToSong()`

---

## 🚧 Remaining Implementation

### 2. Environment & Infrastructure

**Update `.env`:**

```env
# Upstash Redis (for caching and imports)
UPSTASH_REDIS_REST_URL=your_url_here
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Already configured:
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

**Create Upstash Redis Client (`src/services/upstashClient.ts`):**

- REST-based Redis client
- Cache helpers (get, set, del)
- Import draft management
- Playlist SET operations

### 3. Catalog Service

**File: `src/services/catalogService.ts`**

Functions needed:

- `saveFromSpotifyTrack(trackData)` - Upsert artist/album, insert song with dedup
- `addSourceToExistingSong(songId, source, sourceId)` - Add new source to song
- `searchCatalog(query, filters)` - Atlas Search with Redis cache
- `getDuplicateSongs()` - Find songs with same signature
- `mergeD uplicates(targetId, sourceIds)` - Merge sources into one song

### 4. Spotify Search Proxy

**Endpoint: `POST /import/spotify/search`**

- Server-side Spotify API search
- Return trimmed fields: `{title, artist, duration, albumArt, sourceId, albumName}`
- No authentication required (uses backend secret)
- Rate limiting via Redis

### 5. Save from Spotify

**Endpoint: `POST /songs/saveFromSpotify`**

Process:

1. Extract artist/album from Spotify data
2. Upsert artist using `findOrCreateArtist()`
3. Upsert album using `findOrCreateAlbum()`
4. Generate song signature
5. Check if song exists by signature
6. If exists: Add source if not present, return `{inserted: false, existingId}`
7. If new: Create song, return `{inserted: true, song}`

### 6. Atlas Search Integration

**Endpoint: `GET /catalog/search?q=&artistId=&albumId=&genre=`**

Implementation:

```typescript
const pipeline = [
	{
		$search: {
			index: "songs_search",
			compound: {
				should: [
					{ autocomplete: { query: q, path: "title", fuzzy: { maxEdits: 1 } } },
					{
						autocomplete: {
							query: q,
							path: "artistName",
							fuzzy: { maxEdits: 1 },
						},
					},
					{
						autocomplete: {
							query: q,
							path: "albumTitle",
							fuzzy: { maxEdits: 1 },
						},
					},
				],
				filter: [
					// Optional filters for artistId, albumId, genre
				],
			},
		},
	},
	{ $limit: 20 },
	{
		$project: {
			title: 1,
			artistName: 1,
			albumTitle: 1,
			durationSec: 1,
			genres: 1,
			albumArt: 1,
			score: { $meta: "searchScore" },
		},
	},
];
```

**Redis Cache:**

- Key: `search:q:${q.toLowerCase()}`
- TTL: 60 seconds
- Store JSON results

### 7. Import System (Upstash Redis)

**Add to Playlist:**
`POST /admin/imports/playlist/add`

- Body: `{songId: string}`
- Store: `SADD imports:playlist:{userId} <songId>`
- Returns: `{added: boolean, total: number}`

**CSV Preview:**
`POST /admin/imports/csv/preview`

- Body: `{csvData: string}` or file upload
- Parse CSV, normalize fields
- Generate draft ID
- Store: `SET imports:draft:{userId}:{draftId} <JSON>` (TTL 24h)
- Return: `{draftId, preview: [...]}`

**CSV Commit:**
`POST /admin/imports/csv/commit`

- Body: `{draftId: string, playlistName?: string}`
- Load draft from Redis
- Validate all songs
- Upsert to database
- Add IDs to `imports:playlist:{userId}`
- Delete draft
- Return: `{inserted: number, updated: number, errors: []}`

### 8. CSV Format Support

**Expected CSV Format:**

```csv
title,artist,album,duration,genre
"Bohemian Rhapsody","Queen","A Night at the Opera",354,"Rock"
"Billie Jean","Michael Jackson","Thriller",294,"Pop"
```

**Normalization:**

- Title: trim, normalize spaces
- Artist: trim, normalize spaces
- Duration: parse to seconds (handle MM:SS or seconds)
- Genre: split by comma if multiple

### 9. Admin Without Org Routes

**Allowed Routes (no org required):**

```
POST   /import/spotify/search
POST   /songs/saveFromSpotify
POST   /admin/imports/playlist/add
POST   /admin/imports/csv/preview
POST   /admin/imports/csv/commit
GET    /admin/imports/playlist
DELETE /admin/imports/playlist/:songId
GET    /catalog/search
```

**Blocked Routes (org required):**

```
All /api/events/* endpoints
All /api/crates/* endpoints
All /api/requests/* endpoints
POST /api/broadcast
```

### 10. Atlas Search Index Setup

**MongoDB Atlas Configuration:**

1. Navigate to Atlas → Search → Create Index
2. Select `songs` collection
3. Use JSON configuration:

```json
{
	"mappings": {
		"dynamic": false,
		"fields": {
			"title": [
				{
					"type": "string"
				},
				{
					"type": "autocomplete",
					"tokenization": "edgeGram",
					"minGrams": 2,
					"maxGrams": 15,
					"foldDiacritics": true
				}
			],
			"artistName": [
				{
					"type": "string"
				},
				{
					"type": "autocomplete",
					"tokenization": "edgeGram",
					"minGrams": 2,
					"maxGrams": 15,
					"foldDiacritics": true
				}
			],
			"albumTitle": [
				{
					"type": "string"
				},
				{
					"type": "autocomplete",
					"tokenization": "edgeGram",
					"minGrams": 2,
					"maxGrams": 15,
					"foldDiacritics": true
				}
			],
			"genres": {
				"type": "string"
			},
			"artistId": {
				"type": "objectId"
			},
			"albumId": {
				"type": "objectId"
			}
		}
	}
}
```

---

## 📊 Implementation Progress

| Task                 | Status      |
| -------------------- | ----------- |
| Artist Model         | ✅ Complete |
| Album Model          | ✅ Complete |
| Song Model           | ✅ Complete |
| Upstash Redis Client | ⏳ Next     |
| Catalog Service      | ⏳ Next     |
| Spotify Search Proxy | ⏳ Next     |
| Save from Spotify    | ⏳ Next     |
| Atlas Search         | ⏳ Next     |
| Import to Playlist   | ⏳ Next     |
| CSV Preview          | ⏳ Next     |
| CSV Commit           | ⏳ Next     |
| Route Guards         | ⏳ Next     |
| Tests                | ⏳ Next     |

---

## 🔐 Security & Access Control

### Admin Without Org

- Can search catalog
- Can save songs to personal imports
- Can preview/commit CSV
- **Cannot** create events/crates
- **Cannot** moderate requests

### Admin With Org

- All admin-without-org features
- Can create/manage events
- Can moderate requests
- Can manage crates
- Can broadcast notifications

---

## 🧪 Testing Plan

### Unit Tests

**Catalog Deduplication:**

- ✅ Same signature prevents duplicates
- ✅ Different sources on same song
- ✅ Artist/album normalization

**Import System:**

- ✅ CSV parsing with various formats
- ✅ Draft save/load/expire
- ✅ Commit with validation

**Search:**

- ✅ Autocomplete fuzzy matching
- ✅ Filter by artist/album
- ✅ Redis cache hit/miss

### Integration Tests

- Spotify search → save → verify in DB
- CSV upload → preview → commit → verify in DB
- Search catalog → find saved song
- Add to imports playlist → retrieve list

---

## 📚 Files to Create

```
src/models/
  ✅ Artist.ts
  ✅ Album.ts
  ✅ Song.ts (updated)

src/services/
  ⏳ upstashClient.ts
  ⏳ catalogService.ts
  ⏳ csvParser.ts

src/routes/
  ⏳ catalog.ts
  ⏳ imports.ts

src/__tests__/
  ⏳ catalog.test.ts
  ⏳ imports.test.ts
```

---

## 🚀 Next Steps

1. **Update environment variables** (Upstash credentials)
2. **Create Upstash Redis client**
3. **Implement catalog service**
4. **Create Spotify search proxy endpoint**
5. **Implement saveFromSpotify**
6. **Create Atlas Search endpoint**
7. **Implement import system**
8. **Add route guards**
9. **Write tests**
10. **Set up Atlas Search index** (manual via Atlas UI)

---

**Status:** Models complete, services and routes in progress
**ETA:** 2-3 hours for complete implementation
