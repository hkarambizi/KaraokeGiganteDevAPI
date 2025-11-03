# Agent Communication System - Usage Examples

## Overview

This system enables frontend and backend Cursor agents to communicate asynchronously via changelog files and API endpoints.

## Architecture

```
Frontend Agent                     Backend Agent
     |                                  |
     | 1. Complete tasks                |
     | 2. POST /api/dev/changelog       |
     |--------------------------------->|
     |                                  | 3. Read logs/cursor.log
     |                                  | 4. Implement features
     |                                  | 5. Append to logs/cursor.log
     | 6. GET /api/dev/changelog        |
     |<---------------------------------|
     | 7. Read backend notes            |
     | 8. Continue development          |
```

## Frontend Agent Usage

### Before Starting Work

```typescript
import { fetchBackendChangelog } from "./src/services/devCursorAgent";

// Check what backend agent did
const backendNotes = await fetchBackendChangelog();

if (backendNotes) {
	console.log("Backend has made changes! Review before proceeding.");
	// Parse notes for any breaking changes or new features
}
```

### After Completing Tasks

```typescript
import {
	postFrontendChangelog,
	createChangelogEntry,
} from "./src/services/devCursorAgent";

// Create changelog
const changelog = createChangelogEntry(
	// Tasks completed
	[
		"Implemented Singer Home screen with song search",
		"Added co-singer selection modal",
		"Created request submission flow",
		"Fixed TypeScript configuration",
	],

	// Notes for backend agent
	[
		"Song search expects pagination: { page, limit, total, songs[] }",
		"Co-singer search needs GET /api/users/search?q={query}",
		"Request creation calls POST /api/events/:id/requests",
		"Queue screen expects queuePosition field in responses",
	],

	// Pending requirements
	[
		"Need /api/songs/search endpoint with pagination support",
		"Need /api/users/search for co-singer lookup",
		"Need queue position calculation in queue endpoint",
		"Need push notification on request approval/rejection",
	]
);

// Post to backend
await postFrontendChangelog(changelog);

console.log("✅ Changelog sent to backend agent");
```

## Backend Agent Usage

### Backend Implementation (Node.js/Express)

```javascript
// server.js or routes/dev.js

const fs = require("fs").promises;
const path = require("path");

// Only in development
if (process.env.NODE_ENV === "development") {
	// POST /api/dev/changelog - Receive changelog from frontend
	app.post("/api/dev/changelog", async (req, res) => {
		try {
			const { agent, timestamp, tasks, notes, pendingRequirements } = req.body;

			// Format changelog entry
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

			// Ensure logs directory exists
			const logPath = path.join(__dirname, "../logs/cursor.log");
			await fs.mkdir(path.dirname(logPath), { recursive: true });

			// Append changelog
			await fs.appendFile(logPath, logEntry + "\n");

			console.log(`[DevAgent] Received changelog from ${agent}`);
			res.json({ success: true, message: "Changelog recorded" });
		} catch (error) {
			console.error("[DevAgent] Error recording changelog:", error);
			res.status(500).json({ error: "Failed to record changelog" });
		}
	});

	// GET /api/dev/changelog - Send changelog to frontend
	app.get("/api/dev/changelog", async (req, res) => {
		try {
			const logPath = path.join(__dirname, "../logs/cursor.log");

			// Check if file exists
			const content = await fs.readFile(logPath, "utf-8").catch(() => null);

			if (content) {
				const stats = await fs.stat(logPath);
				res.json({
					exists: true,
					content,
					lastModified: stats.mtime.toISOString(),
				});
			} else {
				res.json({ exists: false, content: null });
			}
		} catch (error) {
			console.error("[DevAgent] Error fetching changelog:", error);
			res.status(500).json({ error: "Failed to fetch changelog" });
		}
	});
}
```

### Backend Agent Workflow

**1. Before starting work:**

```javascript
// Read existing changelog
const fs = require("fs");
const logPath = "./logs/cursor.log";

if (fs.existsSync(logPath)) {
	const changelog = fs.readFileSync(logPath, "utf-8");
	console.log("📋 Frontend Agent Notes:");
	console.log(changelog);

	// Parse pending requirements
	const requirements = changelog
		.split("\n")
		.filter(line => line.includes("[ ]"))
		.map(line => line.trim());

	console.log("\n✅ Implementing:", requirements);
}
```

**2. After completing tasks:**

```javascript
// Append your changelog
const backendUpdate = `
${"=".repeat(80)}
AGENT: backend
TIMESTAMP: ${new Date().toISOString()}

TASKS COMPLETED:
  1. Implemented user authentication endpoints
  2. Added Clerk JWT validation middleware
  3. Created song search with pagination
  4. Implemented queue with position calculation

NOTES FOR FRONTEND AGENT:
  - /api/users/me returns null for role if not set (default to 'singer')
  - Search results limited to 20 per page for performance
  - Queue position calculated by request.createdAt (ASC)
  - Push tokens validated with Expo.isExpoPushToken()

IMPLEMENTATION DETAILS:
  - MongoDB indexes added: User.clerkId, Request.eventId
  - CORS configured for localhost:8081 and localhost:19006
  - Error responses follow { error, code } format
  - All timestamps in ISO 8601 format

QUESTIONS FOR FRONTEND:
  - Should rejected requests appear in queue or be filtered out?
  - Maximum co-singers per request? Currently unlimited.
  - Video URL validation needed?

BREAKING CHANGES:
  - None

NEXT STEPS:
  - Test push notifications with physical device
  - Add more song data to database
  - Implement crate merge endpoint
${"=".repeat(80)}
`;

fs.appendFileSync("./logs/cursor.log", backendUpdate + "\n");
console.log("✅ Changelog updated for frontend agent");
```

## Example Changelog File

After both agents work, `logs/cursor.log` might look like:

```
================================================================================
AGENT: frontend
TIMESTAMP: 2024-01-08T10:00:00.000Z

TASKS COMPLETED:
  1. Implemented Singer Home screen with song search
  2. Added co-singer selection modal
  3. Created request submission flow

NOTES FOR OTHER AGENT:
  - Song search expects pagination: { page, limit, total, songs[] }
  - Co-singer search needs GET /api/users/search?q={query}
  - Queue expects queuePosition field in responses

PENDING REQUIREMENTS:
  [ ] Need /api/songs/search endpoint with pagination
  [ ] Need /api/users/search for co-singers
  [ ] Need queue position calculation
================================================================================

================================================================================
AGENT: backend
TIMESTAMP: 2024-01-08T14:00:00.000Z

TASKS COMPLETED:
  1. Implemented song search with pagination ✓
  2. Added user search endpoint ✓
  3. Queue now includes queuePosition field ✓

NOTES FOR FRONTEND AGENT:
  - Queue position is 1-based (first request = position 1)
  - Search returns max 20 results per page
  - User search filters by displayName, firstName, lastName

QUESTIONS FOR FRONTEND:
  - Should rejected requests stay in queue?
================================================================================
```

## Environment Checks

**Frontend:**

```typescript
// Only works in development
if (__DEV__) {
	await postFrontendChangelog(changelog);
}
```

**Backend:**

```javascript
// Only register routes in development
if (process.env.NODE_ENV === 'development') {
  app.post('/api/dev/changelog', ...);
  app.get('/api/dev/changelog', ...);
}
```

## Git Ignore

**Both repos must have:**

```gitignore
# Cursor agent communication logs
logs/cursor.log
```

This ensures changelogs stay local and don't get committed!

## Benefits

1. **Context Persistence**: Next agent knows what previous agent did
2. **Async Communication**: Works across different coding sessions
3. **Requirements Tracking**: Pending items clearly documented
4. **Implementation Notes**: Share decisions and gotchas
5. **Question Channel**: Ask questions even when other agent offline

## Best Practices

### DO ✅

- Write clear, specific task descriptions
- Include technical details in notes
- List ALL pending requirements
- Ask questions when unclear
- Update after each major phase
- Read changelog before starting work

### DON'T ❌

- Store secrets or credentials
- Include production data
- Commit logs/cursor.log to git
- Use for anything except development
- Forget to append (don't overwrite!)
- Skip reading before starting

---

**This system makes agent-to-agent collaboration seamless!** 🤖🔗🤖
