# 📚 Documentation Structure

**Last Updated:** 2024-11-03

---

## 📁 Directory Structure

```
docs/
├── CHANGELOG.md          # Central changelog with frontend/backend updates
└── shared/              # Shared documentation (synced between agents)
    ├── Backend docs...
    └── Frontend docs...
```

---

## 📋 Central Changelog

**Location:** `docs/CHANGELOG.md`

**Purpose:** Single source of truth for all frontend and backend updates

**Format:**
- Sorted by date/time (newest first)
- Clear titles and descriptions
- Marked with emojis for quick identification
- Includes both frontend and backend updates

**Access:**
- Read: `GET /api/dev/changelog?format=central`
- Write: `POST /api/dev/changelog` (automatically updates)

---

## 📦 Shared Documentation

**Location:** `docs/shared/`

**Purpose:** Documentation shared between frontend and backend agents

**Types:**
- Backend docs: Implementation guides, API specs, architecture docs
- Frontend docs: Integration guides, feature specs, changelog updates

**Access:**
- List: `GET /api/dev/docs`
- Get: `GET /api/dev/docs/:filename`
- Upload: `POST /api/dev/docs/:filename`
- Delete: `DELETE /api/dev/docs/:filename`

---

## 🔒 Git Ignore

**`.gitignore` includes:**
```gitignore
# Documentation (sync from frontend/backend)
docs/shared/*
```

**Why?**
- Shared docs are synced automatically via API
- Prevents conflicts between frontend/backend versions
- CHANGELOG.md is tracked (source of truth)

---

## 📝 Adding Documentation

### Backend Agent

1. **Create doc in `docs/shared/`:**
   ```bash
   # File will be auto-ignored by git
   echo "# My Doc" > docs/shared/MY_DOC.md
   ```

2. **Or upload via API:**
   ```bash
   curl -X POST http://localhost:3000/api/dev/docs/MY_DOC.md \
     -H "Content-Type: application/json" \
     -d '{"content": "# My Doc", "encoding": "utf-8"}'
   ```

### Frontend Agent

1. **Upload via API:**
   ```bash
   curl -X POST http://localhost:3000/api/dev/docs/FRONTEND_FEATURE.md \
     -H "Content-Type: application/json" \
     -d '{"content": "# Feature", "encoding": "utf-8"}'
   ```

2. **Backend can read:**
   ```bash
   curl http://localhost:3000/api/dev/docs/FRONTEND_FEATURE.md
   ```

---

## 🔗 API Contracts Sync

**Location:** `src/types/api-contracts.ts` (source file, not in docs/shared)

**Purpose:** Keep TypeScript types in sync between frontend and backend

**Access:**
- Read: `GET /api/dev/contracts` - Get contracts with version
- Verify: `POST /api/dev/contracts/verify` - Verify frontend version matches

**Format:**
```json
{
  "version": "4.0.0",
  "lastUpdated": "2024-10-09",
  "content": "...",  // Full TypeScript file content
  "fileModified": "2025-11-03T02:15:38.260Z",
  "instructions": {
    "usage": "Save this content to your frontend: src/types/api-contracts.ts",
    "checkVersion": "Compare version before updating to prevent downgrade",
    "breaking": "Major version changes (e.g., 1.x.x -> 2.x.x) may have breaking changes"
  }
}
```

**Verify Version:**
```json
POST /api/dev/contracts/verify
{
  "frontendVersion": "4.0.0"
}
```

**Response:**
```json
{
  "matches": true,
  "compatible": true,
  "backendVersion": "4.0.0",
  "frontendVersion": "4.0.0",
  "message": "✅ Frontend and backend API contracts are in sync",
  "severity": "ok",
  "shouldUpdate": false
}
```

**Why not in docs/shared?**
- API contracts are TypeScript source files, not documentation
- They're part of the codebase, not shared docs
- Endpoint serves them for sync purposes only

---

## 🔄 Changelog Updates

### Backend Agent

**POST to changelog:**
```bash
curl -X POST http://localhost:3000/api/dev/changelog \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "backend",
    "timestamp": "2024-11-03T04:30:00.000Z",
    "title": "Fixed Organization Sync",
    "description": "Fixed createdBy validation error",
    "type": "fix",
    "tasks": ["Updated sync function", "Added validation"],
    "notes": ["Issue resolved"]
  }'
```

**What happens:**
1. Entry added to `logs/cursor.log` (legacy format)
2. Entry added to `docs/CHANGELOG.md` (formatted)

### Frontend Agent

Same format, set `agent: "frontend"`

---

## 📊 Changelog Format

**Example Entry:**
```markdown
### 🔧 Fixed: Organization Sync (Backend)

**Time:** 04:30:00 UTC
**Description:** Fixed createdBy validation error in organization sync

**Changes:**
- Updated sync function to use MongoDB user._id
- Added fallback strategy for createdBy

**Result:** ✅ Completed

---
```

---

## 🎯 Best Practices

1. **Keep changelog entries clear and concise**
2. **Use appropriate emojis** (🐛 bug, 🔧 fix, 📦 feature, etc.)
3. **Include both frontend and backend updates**
4. **Sort by date/time (newest first)**
5. **Mark status clearly** (✅ Completed, 🔄 In Progress, ⚠️ Issue)

---

**Status:** ✅ **ORGANIZED**
**Structure:** ✅ **SET UP**
**Sync:** ✅ **ACTIVE**

