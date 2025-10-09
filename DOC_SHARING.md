# Documentation Sharing System

## 🔄 Bidirectional Doc Sync Between Frontend & Backend

Since frontend and backend are in separate directories, we've implemented HTTP endpoints for automatic documentation sharing.

**Both agents can:**

- ✅ List available documentation
- ✅ Fetch docs from each other
- ✅ Upload/share their own docs
- ✅ Delete outdated shared docs

---

## 📡 Documentation Endpoints

### GET /api/dev/docs

**Purpose:** List all available documentation
**Environment:** Development only

**Response:**

```json
{
	"docs": [
		{
			"filename": "README.md",
			"source": "backend",
			"size": 15234,
			"lastModified": "2024-01-08T12:00:00.000Z",
			"path": "/api/dev/docs/README.md"
		},
		{
			"filename": "FRONTEND_GUIDE.md",
			"source": "frontend",
			"size": 8901,
			"lastModified": "2024-01-08T13:00:00.000Z",
			"path": "/api/dev/docs/FRONTEND_GUIDE.md"
		}
	],
	"count": 2,
	"instructions": {
		"getDoc": "GET /api/dev/docs/:filename to retrieve a document",
		"uploadDoc": "POST /api/dev/docs/:filename to upload/update a document",
		"deleteDoc": "DELETE /api/dev/docs/:filename to remove a shared document"
	}
}
```

### GET /api/dev/docs/:filename

**Purpose:** Fetch a specific document
**Environment:** Development only

**Example:** `GET /api/dev/docs/API_CONTRACTS.md`

**Response:**

```json
{
	"filename": "API_CONTRACTS.md",
	"source": "backend",
	"content": "# API Contracts...",
	"contentBase64": "IyBBUEkgQ29udHJhY3RzLi4u",
	"size": 45678,
	"lastModified": "2024-01-08T12:00:00.000Z",
	"encoding": "utf-8",
	"instructions": {
		"decodeBase64": "Buffer.from(contentBase64, 'base64').toString('utf-8')",
		"usage": "Save to your docs folder for reference"
	}
}
```

### POST /api/dev/docs/:filename

**Purpose:** Upload/update documentation (frontend → backend)
**Environment:** Development only

**Example:** `POST /api/dev/docs/FRONTEND_GUIDE.md`

**Body:**

```json
{
	"content": "# Frontend Guide\n\nThis is how we...",
	"contentBase64": "...",
	"metadata": {
		"description": "Frontend implementation guide",
		"agent": "frontend",
		"version": "1.0.0"
	}
}
```

**Response:**

```json
{
	"success": true,
	"filename": "FRONTEND_GUIDE.md",
	"size": 2345,
	"message": "Document FRONTEND_GUIDE.md uploaded successfully",
	"retrieveUrl": "/api/dev/docs/FRONTEND_GUIDE.md"
}
```

### DELETE /api/dev/docs/:filename

**Purpose:** Remove outdated shared documentation
**Environment:** Development only

**Example:** `DELETE /api/dev/docs/OLD_GUIDE.md`

**Response:**

```json
{
	"success": true,
	"message": "Document OLD_GUIDE.md deleted successfully"
}
```

---

## 🎯 Frontend Implementation

### 1. Create Doc Sync Script

**File:** `scripts/sync-docs.js`

```javascript
#!/usr/bin/env node

import fs from "fs";
import path from "path";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const DOCS_DIR = path.join(process.cwd(), "docs/backend");

async function syncDocs() {
	console.log("📚 Syncing documentation from backend...\n");

	try {
		// 1. List available docs
		const listResponse = await fetch(`${API_URL}/api/dev/docs`);
		const { docs } = await listResponse.json();

		console.log(`Found ${docs.length} documents:\n`);

		// 2. Create docs directory
		fs.mkdirSync(DOCS_DIR, { recursive: true });

		// 3. Download each doc
		for (const doc of docs) {
			if (doc.source === "backend") {
				console.log(`  📥 Downloading ${doc.filename}...`);

				const docResponse = await fetch(`${API_URL}${doc.path}`);
				const docData = await docResponse.json();

				// Save to local docs folder
				const localPath = path.join(DOCS_DIR, doc.filename);
				fs.writeFileSync(localPath, docData.content, "utf-8");

				console.log(`     ✅ Saved to ${localPath}`);
			}
		}

		console.log("\n✅ Documentation sync complete!\n");
	} catch (error) {
		console.error("❌ Failed to sync docs:", error.message);
		console.error("\n💡 Make sure backend is running: npm run dev\n");
		process.exit(1);
	}
}

syncDocs();
```

### 2. Create Doc Upload Script

**File:** `scripts/upload-docs.js`

```javascript
#!/usr/bin/env node

import fs from "fs";
import path from "path";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const DOCS_TO_SHARE = [
	"FRONTEND_GUIDE.md",
	"COMPONENT_LIBRARY.md",
	"TESTING_GUIDE.md",
];

async function uploadDocs() {
	console.log("📤 Uploading frontend documentation to backend...\n");

	try {
		for (const filename of DOCS_TO_SHARE) {
			const filePath = path.join(process.cwd(), "docs", filename);

			if (!fs.existsSync(filePath)) {
				console.log(`  ⚠️  Skipping ${filename} (not found)`);
				continue;
			}

			console.log(`  📤 Uploading ${filename}...`);

			const content = fs.readFileSync(filePath, "utf-8");

			const response = await fetch(`${API_URL}/api/dev/docs/${filename}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content,
					metadata: {
						description: `Frontend documentation: ${filename}`,
						agent: "frontend",
						version: "1.0.0",
					},
				}),
			});

			const result = await response.json();

			if (result.success) {
				console.log(`     ✅ Uploaded successfully`);
			} else {
				console.log(`     ❌ Failed: ${result.error}`);
			}
		}

		console.log("\n✅ Documentation upload complete!\n");
	} catch (error) {
		console.error("❌ Failed to upload docs:", error.message);
		process.exit(1);
	}
}

uploadDocs();
```

### 3. Add to package.json

```json
{
	"scripts": {
		"sync-docs": "node scripts/sync-docs.js",
		"upload-docs": "node scripts/upload-docs.js",
		"docs": "npm run sync-docs && npm run upload-docs",
		"dev": "npm run docs && expo start"
	}
}
```

---

## 🔄 Workflow

### Backend Shares Documentation

Backend automatically serves these docs:

- `README.md`
- `QUICKSTART.md`
- `API_CONTRACTS.md`
- `TESTING.md`
- `CONTRACTS_SYNC.md`
- `ENV_TEMPLATE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `FINAL_SUMMARY.md`

**Frontend can fetch anytime:**

```bash
npm run sync-docs
```

### Frontend Shares Documentation

Frontend uploads its docs:

- `FRONTEND_GUIDE.md`
- `COMPONENT_LIBRARY.md`
- `TESTING_GUIDE.md`
- `SCREEN_FLOWS.md`

**Backend can read via:**

```bash
curl http://localhost:3000/api/dev/docs/FRONTEND_GUIDE.md
```

### Automatic Sync

Both agents sync on startup:

**Frontend:**

```json
{
	"dev": "npm run docs && expo start"
}
```

**Backend:**
Could add a startup script to fetch frontend docs if needed.

---

## 📋 Documentation Categories

### Backend Docs (Served by Backend)

1. **API_CONTRACTS.md** - Type definitions and API contracts
2. **TESTING.md** - Testing requirements for frontend
3. **CONTRACTS_SYNC.md** - Contract synchronization guide
4. **README.md** - Complete backend documentation
5. **QUICKSTART.md** - 5-minute setup guide
6. **ENV_TEMPLATE.md** - Environment configuration
7. **IMPLEMENTATION_SUMMARY.md** - Technical details
8. **FINAL_SUMMARY.md** - Overall status

### Frontend Docs (Uploaded to Backend)

1. **FRONTEND_GUIDE.md** - Frontend architecture
2. **COMPONENT_LIBRARY.md** - Reusable components
3. **TESTING_GUIDE.md** - Frontend testing approach
4. **SCREEN_FLOWS.md** - User flow documentation
5. **STATE_MANAGEMENT.md** - Redux/state patterns
6. **NAVIGATION.md** - Expo Router setup

### Shared Docs (Both Can Update)

1. **INTEGRATION_NOTES.md** - Integration issues/solutions
2. **CHANGELOG_SYNC.md** - Coordination notes
3. **DEPLOYMENT.md** - Deployment procedures

---

## 🧪 Testing Doc Sync

### List All Docs

```bash
curl http://localhost:3000/api/dev/docs | jq '.docs[] | {filename, source}'
```

### Fetch Specific Doc

```bash
curl http://localhost:3000/api/dev/docs/API_CONTRACTS.md | jq '.content' -r
```

### Upload Doc

```bash
curl -X POST http://localhost:3000/api/dev/docs/TEST.md \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Test Document\n\nThis is a test.",
    "metadata": {
      "agent": "frontend",
      "description": "Test upload"
    }
  }'
```

### Delete Doc

```bash
curl -X DELETE http://localhost:3000/api/dev/docs/TEST.md
```

---

## 🔒 Security

### Allowed File Types

- `.md` - Markdown files
- `.txt` - Text files

### Forbidden

- `.js`, `.ts` - Code files
- `.json` - Configuration files
- Binary files

### Path Validation

- No `..` (directory traversal)
- No `/` or `\` (path separators)
- Filename only, no paths

---

## 📊 CI/CD Integration

### GitHub Actions Example

```yaml
name: Frontend Docs Sync

on: [push]

jobs:
  sync-docs:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm install

      - name: Start backend (for sync)
        run: docker-compose up -d backend

      - name: Wait for backend
        run: npx wait-on http://localhost:3000/health

      - name: Sync documentation
        run: npm run sync-docs

      - name: Upload frontend docs
        run: npm run upload-docs

      - name: Commit updated docs
        run: |
          git add docs/backend/
          git commit -m "chore: sync backend docs" || true
          git push || true
```

---

## ✅ Best Practices

### 1. Sync Before Development

```bash
# Frontend
npm run docs      # Sync + upload

# Backend
curl localhost:3000/api/dev/docs | jq
```

### 2. Keep Docs Updated

When you update documentation:

**Backend:** Docs automatically available via GET endpoints

**Frontend:** Run `npm run upload-docs` after changes

### 3. Version Your Docs

Add version info to each doc:

```markdown
# Frontend Guide

**Version:** 1.0.0
**Last Updated:** 2024-01-08
**Agent:** Frontend

...
```

### 4. Use Meaningful Filenames

- ✅ `AUTHENTICATION_FLOW.md`
- ✅ `PUSH_NOTIFICATIONS_SETUP.md`
- ❌ `doc1.md`
- ❌ `temp.md`

### 5. Clean Up Old Docs

```bash
# Delete outdated doc
curl -X DELETE http://localhost:3000/api/dev/docs/OLD_GUIDE.md
```

---

## 📞 Troubleshooting

### "Document not found"

```bash
# List all available docs first
curl http://localhost:3000/api/dev/docs
```

### "Invalid filename"

- Remove paths: `../file.md` → `file.md`
- Use only filenames, no directories

### "Upload failed"

- Check file type (only .md, .txt allowed)
- Ensure backend is running
- Check file size (keep under 1MB)

---

## 🎯 Quick Reference

```bash
# List all documentation
curl localhost:3000/api/dev/docs

# Get specific doc
curl localhost:3000/api/dev/docs/README.md

# Upload doc (frontend)
npm run upload-docs

# Sync backend docs (frontend)
npm run sync-docs

# Full sync (frontend)
npm run docs
```

---

## 🚀 Benefits

1. **No Manual Copying** - Automatic sync via HTTP
2. **Always Up-to-Date** - Sync on every dev start
3. **Bidirectional** - Both agents can share
4. **Version Safe** - Metadata tracks versions
5. **CI/CD Ready** - Integrates with pipelines

---

**Environment:** Development only (NODE_ENV=development)
**Backend Endpoints:** `/api/dev/docs/*`
**Frontend Scripts:** `npm run sync-docs`, `npm run upload-docs`
**Storage:** `docs/shared/` (backend), `docs/backend/` (frontend)
