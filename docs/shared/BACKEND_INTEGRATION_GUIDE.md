# Backend Integration Guide - Karaoke Gigante Frontend

> **For Backend Cursor Agent**: This document contains all frontend requirements, API contracts, and expected behaviors.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [API Endpoints Required](#api-endpoints-required)
4. [Data Models](#data-models)
5. [Push Notifications](#push-notifications)
6. [Error Handling](#error-handling)
7. [Development Tools](#development-tools)
8. [Agent Communication System](#agent-communication-system)

---

## Overview

**Frontend Stack:**

- React Native (Expo SDK 54)
- TypeScript
- Clerk Authentication
- Redux Toolkit for state
- expo-router for navigation

**Base URL Configuration:**

- Development: `http://localhost:3000`
- Set via: `EXPO_PUBLIC_API_URL` environment variable

**Authentication:**

- All API requests include: `Authorization: Bearer <clerk-jwt-token>`
- JWT is obtained from Clerk session

---

## Authentication Flow

### Singer (Personal Account)

1. User signs up via Clerk with email/password
2. Frontend calls: `POST /api/users/me` (bootstrap user in MongoDB)
3. Expected response: User object with `role: undefined` or `role: 'singer'`

### Admin (Organization Member)

1. User signs up via Clerk
2. Frontend calls: `POST /api/orgs` with `{ name: "Org Name" }`
3. Backend creates Clerk organization and sets user role to `'admin'`
4. Backend mirrors user in MongoDB with `role: 'admin'`

### Invitation Acceptance

1. User clicks invitation link with `__clerk_ticket` param
2. Clerk handles authentication
3. Backend must recognize user as org member and set role accordingly

### Important: Clerk Integration

- Backend must validate Clerk JWT tokens
- Use Clerk's backend SDK to verify tokens
- Store `clerkId` in MongoDB User model
- Keep role in sync between Clerk metadata and MongoDB

---

## API Endpoints Required

### 🔐 User & Auth

#### `GET /api/users/me`

**Purpose:** Get current user profile with role information

**Request:**

```http
GET /api/users/me
Authorization: Bearer <clerk-jwt>
```

**Response:**

```json
{
  "_id": "mongodb-id",
  "clerkId": "user_clerk123",
  "email": "user@example.com",
  "phoneNumber": "+1234567890",
  "firstName": "John",
  "lastName": "Doe",
  "displayName": "John Doe",
  "avatar": "base64-or-url",
  "role": "singer" | "admin",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Notes:**

- Bootstrap user on first call if doesn't exist
- Extract user info from Clerk JWT
- Default role to `'singer'` if not set

#### `PUT /api/users/me`

**Purpose:** Update current user profile

**Request:**

```json
{
	"firstName": "John",
	"lastName": "Doe",
	"displayName": "Johnny",
	"avatar": "base64-string-or-url",
	"phoneNumber": "+1234567890"
}
```

**Response:** Updated User object (same as GET)

#### `GET /api/users/search?q={query}`

**Purpose:** Search users by name or email (for co-singer selection)

**Query Params:**

- `q` (required): Search query string

**Response:**

```json
[
	{
		"_id": "user-id",
		"clerkId": "user_123",
		"displayName": "Jane Doe",
		"email": "jane@example.com",
		"avatar": "url"
	}
]
```

**Notes:**

- Search by displayName, firstName, lastName, or email
- Return max 20 results
- Don't return sensitive data (phone numbers, full profiles)

---

### 🏢 Organizations

#### `POST /api/orgs`

**Purpose:** Create organization and set user as admin

**Request:**

```json
{
	"name": "My Karaoke Venue"
}
```

**Response:**

```json
{
	"orgId": "org_clerk123",
	"name": "My Karaoke Venue",
	"ownerId": "user_clerk123"
}
```

**Backend Must:**

1. Create Clerk organization via Clerk API
2. Add current user as organization member with role `admin`
3. Update user's MongoDB record with `role: 'admin'`
4. Store organization mapping in MongoDB

---

### 🎵 Songs & Search

#### `GET /api/songs/search?q={query}&page={page}&limit={limit}`

**Purpose:** Search song catalog

**Query Params:**

- `q` (required): Search query
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20, max: 50): Results per page

**Response:**

```json
{
	"page": 1,
	"limit": 20,
	"total": 150,
	"nextPage": 2,
	"songs": [
		{
			"_id": "song-id",
			"spotifyId": "spotify:track:123",
			"title": "Bohemian Rhapsody",
			"artists": ["Queen"],
			"album": "A Night at the Opera",
			"coverArt": "https://i.scdn.co/image/...",
			"durationMs": 354000,
			"videoUrl": "https://youtube.com/watch?v=..."
		}
	]
}
```

**Notes:**

- Search by title, artist, or album
- Songs should be in MongoDB (pre-populated or from Spotify API)
- Support pagination
- Cache search results server-side (5 min)

---

### 🎭 Events

#### `GET /api/events`

**Purpose:** List all events (admin only)

**Response:**

```json
[
  {
    "_id": "event-id",
    "orgId": "org_123",
    "name": "Friday Night Karaoke",
    "date": "2024-12-20T20:00:00.000Z",
    "venue": "The Grand Stage",
    "status": "draft" | "active" | "closed",
    "createdBy": "user_clerk123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Authorization:** Requires `role: 'admin'`

#### `POST /api/events`

**Purpose:** Create new event (admin only)

**Request:**

```json
{
	"name": "Friday Night Karaoke",
	"date": "2024-12-20T20:00:00.000Z",
	"venue": "The Grand Stage"
}
```

**Response:** Event object (same as GET)

**Authorization:** Requires `role: 'admin'`

**Backend Must:**

- Set `status: 'draft'` by default
- Associate with user's organization
- Set `createdBy` to current user's clerkId

#### `GET /api/events/:id`

**Purpose:** Get specific event details

**Response:** Single Event object

#### `GET /api/events/active`

**Purpose:** Get currently active event (for singers)

**Response:** Event object or `null`

**Notes:**

- Returns event with `status: 'active'`
- If multiple active events, return the closest by date
- Used by singers to know which event to request songs for

---

### 🎤 Requests (Song Requests)

#### `POST /api/events/:eventId/requests`

**Purpose:** Create song request (singer)

**Request:**

```json
{
	"songId": "song-mongo-id",
	"coSingers": ["user-id-1", "user-id-2"]
}
```

**Response:**

```json
{
	"_id": "request-id",
	"eventId": "event-id",
	"songId": "song-id",
	"userId": "user-clerk-id",
	"coSingers": ["user-id-1", "user-id-2"],
	"status": "pending_admin",
	"videoUrl": null,
	"inCrate": false,
	"createdAt": "2024-01-01T00:00:00.000Z",
	"updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Backend Must:**

- Default `status` to `'pending_admin'`
- Default `inCrate` to `false`
- Validate songId exists
- Validate coSingers are valid user IDs
- Store userId from JWT token

#### `GET /api/events/:eventId/requests?status={status}&inCrate={bool}`

**Purpose:** List requests for an event

**Query Params:**

- `status` (optional): Filter by status
- `inCrate` (optional): Filter by inCrate boolean

**Response:**

```json
[
	{
		"_id": "request-id",
		"eventId": "event-id",
		"songId": "song-id",
		"userId": "user-id",
		"coSingers": ["user-id-1"],
		"status": "pending_admin",
		"videoUrl": null,
		"inCrate": false,
		"rejectionReason": null,
		"song": {
			/* populated Song object */
		},
		"user": {
			/* populated User object */
		},
		"coSingersData": [
			/* populated User objects */
		],
		"createdAt": "2024-01-01T00:00:00.000Z"
	}
]
```

**Notes:**

- Populate `song`, `user`, and `coSingersData` fields
- Sort by `createdAt` descending

#### `GET /api/events/:eventId/queue`

**Purpose:** Get queue (approved requests in order) for singers

**Response:**

```json
[
  {
    "_id": "request-id",
    "eventId": "event-id",
    "songId": "song-id",
    "userId": "user-id",
    "coSingers": [],
    "status": "approved" | "queued",
    "videoUrl": "https://youtube.com/...",
    "queuePosition": 1,
    "song": { /* populated */ },
    "user": { /* populated */ },
    "coSingersData": [ /* populated */ ]
  }
]
```

**Notes:**

- Only return requests with `status: 'approved'` or `status: 'queued'`
- Include `queuePosition` field (1-based index)
- Sort by queue position or creation time

#### `POST /api/events/:eventId/requests/:requestId/approve`

**Purpose:** Approve request (admin only)

**Request:**

```json
{
	"addToCrate": true
}
```

**Response:** Updated Request object with `status: 'approved'`

**Backend Must:**

- Set `status` to `'approved'`
- If `addToCrate: true`, also add songId to event's crate
- Send push notification to requesting user

**Authorization:** Requires `role: 'admin'`

#### `POST /api/events/:eventId/requests/:requestId/reject`

**Purpose:** Reject request (admin only)

**Request:**

```json
{
	"reason": "Song not available in our catalog"
}
```

**Response:** Updated Request object with `status: 'rejected'`

**Backend Must:**

- Set `status` to `'rejected'`
- Store `rejectionReason`
- Send push notification to requesting user with reason

**Authorization:** Requires `role: 'admin'`

#### `PUT /api/events/:eventId/requests/:requestId/video`

**Purpose:** Set video URL for request (admin only)

**Request:**

```json
{
	"videoUrl": "https://youtube.com/watch?v=..."
}
```

**Response:** Updated Request object

**Authorization:** Requires `role: 'admin'`

---

### 📚 Crates (Song Collections per Event)

#### `GET /api/events/:eventId/crate`

**Purpose:** Get event's crate

**Response:**

```json
{
	"_id": "crate-id",
	"eventId": "event-id",
	"songIds": ["song-id-1", "song-id-2"],
	"songs": [
		/* populated Song objects */
	]
}
```

**Notes:**

- Auto-create crate if doesn't exist for event
- Populate `songs` array with full Song objects

#### `POST /api/events/:eventId/crate/songs`

**Purpose:** Add song to crate (admin only)

**Request:**

```json
{
	"songId": "song-mongo-id"
}
```

**Response:** Updated Crate object

**Backend Must:**

- Check for duplicates (don't add if already in crate)
- Update crate's `songIds` array

**Authorization:** Requires `role: 'admin'`

#### `DELETE /api/events/:eventId/crate/songs/:songId`

**Purpose:** Remove song from crate (admin only)

**Response:** Updated Crate object

**Authorization:** Requires `role: 'admin'`

#### `POST /api/events/:eventId/crate/merge`

**Purpose:** Merge/copy songs from other event crates (admin only)

**Request:**

```json
{
	"crateIds": ["crate-id-1", "crate-id-2"]
}
```

**Response:**

```json
{
	"added": 15,
	"skipped": 3,
	"duplicates": ["song-id-1", "song-id-2"]
}
```

**Backend Must:**

- Fetch all songs from specified crates
- Add to target event's crate
- Skip duplicates
- Return count of added/skipped

**Authorization:** Requires `role: 'admin'`

---

### 📢 Broadcast (Push Notifications)

#### `POST /api/broadcast`

**Purpose:** Send push notification to all users (admin only)

**Request:**

```json
{
	"eventId": "event-id",
	"message": "Taking a short break. Be back in 10 minutes!"
}
```

**Response:**

```json
{
	"sent": 42
}
```

**Backend Must:**

- Find all users with registered push tokens
- Send notification using `expo-server-sdk`
- Return count of successfully sent notifications

**Authorization:** Requires `role: 'admin'`

---

### 📱 Device Registration

#### `POST /api/devices/register`

**Purpose:** Register device for push notifications

**Request:**

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios" | "android" | "web"
}
```

**Response:**

```json
{
	"success": true
}
```

**Backend Must:**

- Validate token format with `Expo.isExpoPushToken()`
- Store in User model: `pushToken` field
- Update existing token if user already has one
- Store platform for analytics (optional)

**Notes:**

- One token per user (replace old token)
- Token expires/changes when user reinstalls app

---

## Data Models

### MongoDB Collections Expected

#### Users

```typescript
{
  _id: ObjectId,
  clerkId: string, // Clerk user ID (unique index)
  email: string,
  phoneNumber?: string,
  firstName?: string,
  lastName?: string,
  displayName?: string,
  avatar?: string, // base64 or URL
  role?: 'singer' | 'admin',
  pushToken?: string, // Expo push token
  createdAt: Date,
  updatedAt: Date
}
```

#### Organizations

```typescript
{
  _id: ObjectId,
  clerkOrgId: string, // Clerk org ID (unique index)
  name: string,
  ownerId: string, // clerkId
  createdAt: Date,
  updatedAt: Date
}
```

#### Songs

```typescript
{
  _id: ObjectId,
  spotifyId?: string,
  title: string,
  artists: string[],
  album?: string,
  coverArt?: string, // URL
  durationMs?: number,
  videoUrl?: string, // YouTube or other
  createdAt: Date,
  updatedAt: Date
}
```

#### Events

```typescript
{
  _id: ObjectId,
  orgId: string, // Clerk org ID
  name: string,
  date: Date,
  venue?: string,
  status: 'draft' | 'active' | 'closed',
  createdBy: string, // clerkId
  createdAt: Date,
  updatedAt: Date
}
```

#### Requests

```typescript
{
  _id: ObjectId,
  eventId: ObjectId,
  songId: ObjectId,
  userId: string, // clerkId
  coSingers: ObjectId[], // User _ids
  status: 'pending_admin' | 'approved' | 'rejected' | 'queued' | 'performed',
  videoUrl?: string,
  inCrate: boolean,
  rejectionReason?: string,
  queuePosition?: number,
  createdAt: Date,
  updatedAt: Date
}
```

#### Crates

```typescript
{
  _id: ObjectId,
  eventId: ObjectId,
  songIds: ObjectId[],
  createdAt: Date,
  updatedAt: Date
}
```

---

## Push Notifications

### Server-Side Setup

**Required Package:**

```bash
npm install expo-server-sdk
```

**Implementation:**

```javascript
import { Expo } from "expo-server-sdk";

const expo = new Expo({
	accessToken: process.env.EXPO_ACCESS_TOKEN, // Optional
});

// Send notification
const messages = [
	{
		to: user.pushToken,
		sound: "default",
		title: "Song Approved!",
		body: 'Your request for "Bohemian Rhapsody" has been approved',
		data: { requestId: "req-123", type: "approval" },
	},
];

const chunks = expo.chunkPushNotifications(messages);
for (const chunk of chunks) {
	const receipts = await expo.sendPushNotificationsAsync(chunk);
}
```

### When to Send Notifications

1. **Request Approved:** Notify requester
2. **Request Rejected:** Notify requester with reason
3. **Queue Position:** Notify when user is next (optional)
4. **Broadcast:** Admin sends custom message to all

---

## Error Handling

### HTTP Status Codes

| Code | Meaning      | When to Use                              |
| ---- | ------------ | ---------------------------------------- |
| 200  | OK           | Successful GET/PUT                       |
| 201  | Created      | Successful POST                          |
| 400  | Bad Request  | Invalid input data                       |
| 401  | Unauthorized | Missing/invalid JWT token                |
| 403  | Forbidden    | Valid token but insufficient permissions |
| 404  | Not Found    | Resource doesn't exist                   |
| 409  | Conflict     | Duplicate entry (e.g., already in crate) |
| 500  | Server Error | Unexpected server error                  |

### Error Response Format

```json
{
	"error": "Human-readable error message",
	"code": "ERROR_CODE_CONSTANT",
	"details": {
		/* optional additional info */
	}
}
```

### Examples

**401 Unauthorized:**

```json
{
	"error": "Invalid or expired token",
	"code": "INVALID_TOKEN"
}
```

**403 Forbidden:**

```json
{
	"error": "Admin access required",
	"code": "INSUFFICIENT_PERMISSIONS"
}
```

**404 Not Found:**

```json
{
	"error": "Event not found",
	"code": "EVENT_NOT_FOUND"
}
```

---

## Development Tools

### CORS Configuration

**Required for local development:**

```javascript
app.use(
	cors({
		origin: ["http://localhost:8081", "http://localhost:19006"], // Expo ports
		credentials: true,
	})
);
```

### Environment Variables

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/karaoke-gigante
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_ACCESS_TOKEN=... # Optional, for push notifications
```

### Logging

**Please log:**

- All API requests (method, path, user)
- Authorization failures
- Push notification sends/failures
- Database operations (for debugging)

**Example:**

```javascript
console.log(
	`[${new Date().toISOString()}] ${req.method} ${req.path} - User: ${userId}`
);
```

---

## Agent Communication System

### 🤖 Cursor Agent Changelog Protocol

To enable seamless collaboration between frontend and backend Cursor agents, implement these **development-only** endpoints:

#### `POST /api/dev/changelog`

**Purpose:** Frontend agent posts its changelog after completing tasks

**Environment:** `NODE_ENV=development` ONLY

**Request:**

```json
{
	"agent": "frontend",
	"timestamp": "2024-01-01T00:00:00.000Z",
	"tasks": [
		"Implemented Singer Home screen with song search",
		"Added co-singer selection modal",
		"Fixed TypeScript configuration for ES2020"
	],
	"notes": [
		"Using kg.searchSongs() SDK method - expects pagination support",
		"Co-singer search expects GET /api/users/search endpoint",
		"Push token registration calls POST /api/devices/register"
	],
	"pendingRequirements": [
		"Need /api/songs/search endpoint with pagination",
		"Need /api/users/search for co-singer lookup",
		"Need queue position field in queue responses"
	]
}
```

**Backend Implementation:**

```javascript
// Only available in development
if (process.env.NODE_ENV === "development") {
	app.post("/api/dev/changelog", async (req, res) => {
		const { agent, timestamp, tasks, notes, pendingRequirements } = req.body;

		const logEntry = `
${"=".repeat(80)}
AGENT: ${agent}
TIMESTAMP: ${timestamp}
TASKS COMPLETED:
${tasks.map((t, i) => `  ${i + 1}. ${t}`).join("\n")}

NOTES FOR OTHER AGENT:
${notes.map((n, i) => `  - ${n}`).join("\n")}

PENDING REQUIREMENTS:
${pendingRequirements.map((r, i) => `  [ ] ${r}`).join("\n")}
${"=".repeat(80)}
`;

		// Append to logs/cursor.log
		const fs = require("fs").promises;
		const path = require("path");
		const logPath = path.join(__dirname, "../logs/cursor.log");

		// Ensure logs directory exists
		await fs.mkdir(path.dirname(logPath), { recursive: true });

		// Append changelog
		await fs.appendFile(logPath, logEntry + "\n");

		res.json({ success: true, message: "Changelog recorded" });
	});
}
```

#### `GET /api/dev/changelog`

**Purpose:** Frontend agent fetches backend agent's changelog

**Environment:** `NODE_ENV=development` ONLY

**Response:**

```json
{
	"exists": true,
	"content": "... full changelog contents ...",
	"lastModified": "2024-01-01T00:00:00.000Z"
}
```

**Backend Implementation:**

```javascript
if (process.env.NODE_ENV === "development") {
	app.get("/api/dev/changelog", async (req, res) => {
		const fs = require("fs").promises;
		const path = require("path");
		const logPath = path.join(__dirname, "../logs/cursor.log");

		try {
			const content = await fs.readFile(logPath, "utf-8");
			const stats = await fs.stat(logPath);

			res.json({
				exists: true,
				content,
				lastModified: stats.mtime.toISOString(),
			});
		} catch (error) {
			if (error.code === "ENOENT") {
				res.json({ exists: false, content: null });
			} else {
				throw error;
			}
		}
	});
}
```

### .gitignore Entry

**Must add to backend .gitignore:**

```gitignore
# Cursor agent communication logs (not tracked)
logs/cursor.log
```

### Frontend Usage

Frontend will check for changelog before starting work:

```typescript
// Frontend helper (development only)
const fetchBackendChangelog = async () => {
	if (process.env.NODE_ENV !== "development") return null;

	const response = await fetch(`${API_URL}/api/dev/changelog`);
	const data = await response.json();

	if (data.exists) {
		console.log("📋 Backend Changelog:\n", data.content);
		return data.content;
	}
	return null;
};
```

### Workflow

1. **Frontend Agent** completes task → Posts changelog via `POST /api/dev/changelog`
2. **Backend Agent** starts work → Reads `logs/cursor.log` for context
3. **Backend Agent** completes task → Appends to `logs/cursor.log`
4. **Frontend Agent** resumes → Fetches changelog via `GET /api/dev/changelog`

This creates a **persistent context bridge** between agents! 🔗

---

## Testing Checklist

Before deployment, backend should verify:

- [ ] All endpoints return correct status codes
- [ ] JWT validation works for all protected routes
- [ ] Role-based access control (admin-only endpoints)
- [ ] Push notifications send successfully
- [ ] Pagination works for search/list endpoints
- [ ] Population of nested documents (song, user in requests)
- [ ] CORS allows Expo development servers
- [ ] Error responses follow consistent format
- [ ] Changelog endpoints only work in development
- [ ] Database indexes on clerkId, eventId, etc.

---

## Questions for Backend Agent?

If anything is unclear:

1. Check `logs/cursor.log` for frontend agent notes
2. Review `/app` and `/src/services/kgSDK.ts` for implementation details
3. Post questions to `logs/cursor.log` for frontend agent to clarify

---

**Document Version:** 1.0
**Last Updated:** 2024-01-08
**Frontend Agent:** Claude (Cursor)
**Next Agent:** Backend Implementation Agent

---

## Quick Reference: API Summary

```
Auth & Users:
  GET    /api/users/me
  PUT    /api/users/me
  GET    /api/users/search?q=

Organizations:
  POST   /api/orgs

Songs:
  GET    /api/songs/search?q=&page=&limit=

Events:
  GET    /api/events
  POST   /api/events
  GET    /api/events/:id
  GET    /api/events/active

Requests:
  POST   /api/events/:eventId/requests
  GET    /api/events/:eventId/requests?status=&inCrate=
  GET    /api/events/:eventId/queue
  POST   /api/events/:eventId/requests/:requestId/approve
  POST   /api/events/:eventId/requests/:requestId/reject
  PUT    /api/events/:eventId/requests/:requestId/video

Crates:
  GET    /api/events/:eventId/crate
  POST   /api/events/:eventId/crate/songs
  DELETE /api/events/:eventId/crate/songs/:songId
  POST   /api/events/:eventId/crate/merge

Broadcast:
  POST   /api/broadcast

Devices:
  POST   /api/devices/register

Dev Only (NODE_ENV=development):
  POST   /api/dev/changelog
  GET    /api/dev/changelog
```
