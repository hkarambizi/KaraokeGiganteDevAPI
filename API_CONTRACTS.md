# API Contracts & Type Definitions

**⚠️ CRITICAL: These types MUST stay in sync between frontend and backend**

Version: 1.0.0
Last Updated: 2024-01-08
Status: ✅ Locked for v1.0

---

## 📦 Shared TypeScript Types

The file `src/types/api-contracts.ts` contains all shared TypeScript interfaces.

**Frontend Integration:**
Copy this file to your frontend project at: `src/types/api-contracts.ts`

```typescript
// Frontend usage:
import type { User, Song, Request, Event } from "@/types/api-contracts";
```

---

## 🔒 Type Safety Contract

### Rules:

1. **Never change these types without coordination** between frontend and backend teams
2. **Version changes** require updating both repos simultaneously
3. **Breaking changes** require a migration plan
4. **New optional fields** are safe to add
5. **Removing fields** or changing types is BREAKING

### Change Request Process:

1. Propose change in `logs/cursor.log`
2. Get approval from both teams
3. Update version number
4. Deploy backend first
5. Update frontend second

---

## 📋 Complete Type Definitions

### User Types

```typescript
export interface User {
	_id: string;
	clerkId: string;
	email: string;
	phoneNumber?: string;
	firstName?: string;
	lastName?: string;
	displayName?: string;
	avatar?: string;
	role?: "singer" | "admin";
	orgId?: string;
	createdAt: string; // ISO 8601
	updatedAt: string; // ISO 8601
}

export interface UserSearchResult {
	_id: string;
	clerkId: string;
	displayName: string;
	email: string;
	avatar?: string;
}

export interface UpdateUserRequest {
	firstName?: string;
	lastName?: string;
	displayName?: string;
	avatar?: string;
	phoneNumber?: string;
}
```

### Song Types

```typescript
export interface Song {
	_id: string;
	spotifyId?: string;
	source: "spotify" | "csv" | "manual";
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
```

### Event Types

```typescript
export interface Event {
	_id: string;
	orgId: string;
	name: string;
	date: string; // ISO 8601
	venue?: string;
	status: "draft" | "active" | "closed";
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateEventRequest {
	name: string;
	date: string; // ISO 8601
	venue?: string;
}
```

### Request Types

```typescript
export interface Request {
	_id: string;
	eventId: string;
	songId: string;
	userId: string;
	coSingers: string[];
	status: "pending_admin" | "approved" | "rejected" | "queued" | "performed";
	videoUrl?: string;
	inCrate: boolean;
	rejectionReason?: string;
	queuePosition?: number; // ⚠️ CRITICAL: 1-based index
	fastPass?: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface RequestWithPopulated {
	// ... same as Request but with populated fields:
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
```

### Crate Types

```typescript
export interface Crate {
	_id: string;
	eventId: string;
	songIds: string[];
	songs: Song[]; // Populated
	createdAt: string;
	updatedAt: string;
}

export interface MergeCratesResponse {
	added: number;
	skipped: number;
	duplicates: string[];
}
```

### Error Types

```typescript
export interface ApiError {
	error: string;
	code: string;
	details?: any;
}
```

---

## 🎯 Critical Fields

### Queue Position

**Field:** `queuePosition`
**Type:** `number`
**Range:** 1-based index (1, 2, 3, ...)
**Usage:** Display "You're #3 in line"
**Endpoint:** `GET /api/events/:id/queue`

### Status Enums

**Request Status:**

- `pending_admin` - Waiting for admin approval
- `approved` - Approved, added to queue
- `rejected` - Rejected with reason
- `queued` - In queue
- `performed` - Already performed

**Event Status:**

- `draft` - Not started yet
- `active` - Currently happening
- `closed` - Finished

### Role Values

- `singer` - Personal account (default)
- `admin` - Organization member

---

## 🔄 Population Rules

### Always Populated Fields:

**GET /api/events/:id/requests:**

```typescript
{
  song: Song,           // Full song object
  user: User,           // Full user object
  coSingersData: User[] // Array of full user objects
}
```

**GET /api/events/:id/queue:**

```typescript
{
  queuePosition: number, // ⚠️ MUST be present
  song: Song,
  user: User,
  coSingersData: User[]
}
```

**GET /api/events/:id/crate:**

```typescript
{
  songs: Song[]  // Array of full song objects
}
```

---

## 📝 Field Formats

### Dates

**Format:** ISO 8601 string
**Example:** `"2024-01-08T12:00:00.000Z"`
**Parse:** `new Date(dateString)`

### MongoDB ObjectIds

**Format:** 24-character hex string
**Example:** `"507f1f77bcf86cd799439011"`
**Usage:** Use as string, backend handles conversion

### Expo Push Tokens

**Format:** `ExponentPushToken[...]`
**Example:** `"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"`
**Validation:** Backend validates format

---

## 🧪 Testing Requirements

### Backend Tests ✅

- [x] Input validation (Zod schemas)
- [x] Queue position calculation
- [x] Song deduplication logic
- [x] Environment validation
- [x] Data model schemas

### Frontend Tests Required 📋

**Unit Tests:**

- [ ] API client methods (kgSDK.ts)
- [ ] Request/response type validation
- [ ] Error handling
- [ ] Queue position display logic
- [ ] Status badge rendering

**Integration Tests:**

- [ ] Authentication flow (Clerk JWT → /api/users/me)
- [ ] Organization creation (POST /api/orgs)
- [ ] Song search pagination
- [ ] Request lifecycle (create → approve → queue)
- [ ] Push notification receipt
- [ ] Crate management (add/remove/merge)

**E2E Tests:**

- [ ] Singer: Sign up → Search song → Request → See queue position
- [ ] Admin: Create org → Create event → Approve request → Broadcast
- [ ] Co-singing: Add co-singer → Verify both receive notifications

---

## 🚨 Breaking Changes

### If you need to make a breaking change:

1. **Document the change:**

   ```typescript
   // OLD (v1.0.0)
   interface User {
   	displayName: string;
   }

   // NEW (v2.0.0)
   interface User {
   	displayName?: string; // Now optional
   	username: string; // New required field
   }
   ```

2. **Create migration plan:**

   - Backend: Add new field with default
   - Backend: Deploy with both fields
   - Frontend: Update to use new field
   - Backend: Remove old field (next version)

3. **Version bump:**
   - Update `API_CONTRACTS.md` version
   - Update `src/types/api-contracts.ts` version comment
   - Document in changelog

---

## 📞 Communication

### For Questions:

1. Post to `logs/cursor.log` with:

   ```
   AGENT: frontend
   QUESTION: Is queuePosition 0-based or 1-based?
   ```

2. Backend responds in same file:
   ```
   AGENT: backend
   ANSWER: 1-based. First in queue = position 1
   ```

### For Change Requests:

1. Propose in `logs/cursor.log`
2. Wait for approval
3. Coordinate deployment
4. Update documentation

---

## ✅ Checklist for Frontend

- [ ] Copy `src/types/api-contracts.ts` to frontend project
- [ ] Import types in API client
- [ ] Validate responses match types
- [ ] Add unit tests for type handling
- [ ] Add integration tests for API calls
- [ ] Test error handling
- [ ] Test queue position display
- [ ] Test populated fields (song, user, coSingersData)

---

## 🎯 Examples

### Request with Population (Frontend receives):

```json
{
	"_id": "req123",
	"eventId": "evt123",
	"songId": "song123",
	"userId": "user123",
	"coSingers": ["user456"],
	"status": "approved",
	"queuePosition": 3,
	"inCrate": true,
	"song": {
		"_id": "song123",
		"title": "Bohemian Rhapsody",
		"artists": ["Queen"],
		"coverArt": "https://...",
		"durationMs": 354000
	},
	"user": {
		"_id": "user123",
		"displayName": "John Doe",
		"email": "john@example.com",
		"avatar": "https://..."
	},
	"coSingersData": [
		{
			"_id": "user456",
			"displayName": "Jane Smith",
			"email": "jane@example.com"
		}
	],
	"createdAt": "2024-01-08T12:00:00.000Z",
	"updatedAt": "2024-01-08T12:05:00.000Z"
}
```

---

**Version:** 1.0.0
**Status:** ✅ Locked
**Next Review:** When breaking changes needed

**Contact:** Update `logs/cursor.log` for any questions or change requests
