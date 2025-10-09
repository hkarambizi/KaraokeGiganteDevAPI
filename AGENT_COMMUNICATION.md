# Agent Communication System

## 🤖 Complete HTTP-Based Inter-Agent Communication

No more manual file copying! Everything is automated via HTTP endpoints.

---

## 🎯 The Problem We Solved

**Before:**

- ❌ Manual copy-paste of documentation
- ❌ Manual copy-paste of type definitions
- ❌ Files getting out of sync
- ❌ Agents can't access each other's folders

**After:**

- ✅ HTTP-based automatic sync
- ✅ Version-controlled contracts
- ✅ Bidirectional doc sharing
- ✅ Changelog communication
- ✅ Everything stays in sync

---

## 📡 Communication Channels

### 1. Changelog System

**Purpose:** Real-time agent updates and questions

**Endpoints:**

- `POST /api/dev/changelog` - Post updates
- `GET /api/dev/changelog` - Read updates

**Usage:**

```bash
# Frontend posts update
curl -X POST localhost:3000/api/dev/changelog \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "frontend",
    "timestamp": "2024-01-08T15:00:00Z",
    "tasks": ["Added unit tests", "Verified queue positions"],
    "notes": ["All tests passing"],
    "questions": ["Should rejected requests stay in queue?"]
  }'

# Backend reads
curl localhost:3000/api/dev/changelog
```

### 2. Contract Synchronization

**Purpose:** Keep API types in sync with version control

**Endpoints:**

- `GET /api/dev/contracts` - Fetch contracts
- `POST /api/dev/contracts/verify` - Check compatibility

**Usage:**

```bash
# Fetch latest contracts
npm run sync-contracts

# Verify version matches
curl -X POST localhost:3000/api/dev/contracts/verify \
  -H "Content-Type: application/json" \
  -d '{"frontendVersion":"1.0.0"}'
```

**Features:**

- Semantic versioning (MAJOR.MINOR.PATCH)
- Breaking change detection
- Automatic version validation
- Prevents downgrade accidents

### 3. Documentation Sharing

**Purpose:** Bidirectional doc sharing between agents

**Endpoints:**

- `GET /api/dev/docs` - List all docs
- `GET /api/dev/docs/:filename` - Fetch doc
- `POST /api/dev/docs/:filename` - Upload doc
- `DELETE /api/dev/docs/:filename` - Remove doc

**Usage:**

```bash
# Frontend: Fetch all backend docs
npm run sync-docs

# Frontend: Upload your docs
npm run upload-docs

# Backend: List all available docs
curl localhost:3000/api/dev/docs

# Backend: Read frontend doc
curl localhost:3000/api/dev/docs/FRONTEND_GUIDE.md
```

---

## 🔄 Complete Workflow

### Frontend Agent Workflow

```bash
# 1. Start by syncing everything
npm run sync-docs        # Get backend documentation
npm run sync-contracts   # Get API type definitions

# 2. Read backend docs
cat docs/backend/API_CONTRACTS.md
cat docs/backend/TESTING.md

# 3. Implement features
# ... code, code, code ...

# 4. Create your documentation
echo "# Frontend Guide" > docs/FRONTEND_GUIDE.md

# 5. Share with backend
npm run upload-docs

# 6. Post changelog
curl -X POST localhost:3000/api/dev/changelog \
  -d '{"agent":"frontend", "tasks":["..."], "notes":["..."]}'

# 7. Check for backend responses
curl localhost:3000/api/dev/changelog
```

### Backend Agent Workflow

```bash
# 1. Documentation automatically served via HTTP
# No action needed - docs are auto-available

# 2. Check for frontend docs
curl localhost:3000/api/dev/docs

# 3. Read frontend documentation
curl localhost:3000/api/dev/docs/FRONTEND_GUIDE.md

# 4. Read changelog
curl localhost:3000/api/dev/changelog

# 5. Post responses
curl -X POST localhost:3000/api/dev/changelog \
  -d '{"agent":"backend", "notes":["Response to question..."]}'
```

---

## 📋 Frontend Setup Checklist

### One-Time Setup (15 minutes)

- [ ] Create `scripts/sync-api-contracts.js`
- [ ] Create `scripts/sync-docs.js`
- [ ] Create `scripts/upload-docs.js`
- [ ] Add scripts to package.json
- [ ] Test: `npm run sync-docs`
- [ ] Test: `npm run sync-contracts`

### Daily Workflow

```bash
# Start development (auto-syncs everything)
npm run dev

# This runs:
# 1. npm run sync-docs      → Fetch backend docs
# 2. npm run sync-contracts → Fetch API types
# 3. expo start             → Start app
```

### After Making Changes

```bash
# Upload your documentation
npm run upload-docs

# Post changelog
# (add to your build process or run manually)
```

---

## 🎯 Key Benefits

### 1. No Manual Copying ✅

Everything syncs automatically via HTTP

### 2. Always Up-to-Date ✅

Sync on every dev start

### 3. Version Safe ✅

Breaking changes detected automatically

### 4. Bidirectional ✅

Both agents can share with each other

### 5. CI/CD Ready ✅

Works in automated pipelines

### 6. Prevents Conflicts ✅

Version checking prevents incompatible updates

---

## 📚 Documentation Strategy

### Backend Documentation (8 files)

**Location:** Root directory
**Access:** HTTP via `GET /api/dev/docs/:filename`
**Auto-synced to frontend:** `docs/backend/`

Files:

1. README.md
2. QUICKSTART.md
3. API_CONTRACTS.md
4. TESTING.md
5. CONTRACTS_SYNC.md
6. DOC_SHARING.md
7. ENV_TEMPLATE.md
8. IMPLEMENTATION_SUMMARY.md

### Frontend Documentation (8+ files)

**Location:** Frontend `docs/` folder
**Access:** Upload via `POST /api/dev/docs/:filename`
**Stored in backend:** `docs/shared/`

Recommended files:

1. FRONTEND_GUIDE.md
2. COMPONENT_LIBRARY.md
3. TESTING_GUIDE.md
4. SCREEN_FLOWS.md
5. STATE_MANAGEMENT.md
6. NAVIGATION.md
7. API_CLIENT.md
8. DEPLOYMENT_GUIDE.md

---

## 🔍 Discovery & Navigation

### Frontend: "What backend docs are available?"

```bash
npm run sync-docs

# Lists:
# - API_CONTRACTS.md
# - TESTING.md
# - CONTRACTS_SYNC.md
# - etc.
```

### Backend: "What frontend docs are available?"

```bash
curl localhost:3000/api/dev/docs | jq '.docs[] | select(.source=="frontend")'
```

### Both: "What's new?"

```bash
curl localhost:3000/api/dev/changelog
```

---

## ✅ Complete Communication Stack

| Channel   | Purpose               | Endpoints                     | Direction          |
| --------- | --------------------- | ----------------------------- | ------------------ |
| Changelog | Updates & questions   | POST/GET `/api/dev/changelog` | Bidirectional      |
| Contracts | Type definitions      | GET `/api/dev/contracts`      | Backend → Frontend |
| Docs      | Implementation guides | GET/POST `/api/dev/docs/*`    | Bidirectional      |

---

## 🚀 Quick Reference

### Frontend Commands

```bash
# Sync everything
npm run docs              # Docs + contracts

# Individual syncs
npm run sync-docs         # Backend documentation
npm run sync-contracts    # API type definitions
npm run upload-docs       # Share your docs

# Development (auto-sync)
npm run dev               # Syncs then starts
```

### Backend Commands

```bash
# List available docs
curl localhost:3000/api/dev/docs

# Read frontend doc
curl localhost:3000/api/dev/docs/FRONTEND_GUIDE.md

# Read changelog
curl localhost:3000/api/dev/changelog
```

### Testing Communication

```bash
# Backend: Start server
npm run dev

# Frontend: Fetch docs
npm run sync-docs

# Frontend: Upload doc
npm run upload-docs

# Both: Check changelog
curl localhost:3000/api/dev/changelog
```

---

## 📞 When to Use Each Channel

### Use Changelog For:

- ✅ Completed tasks announcements
- ✅ Questions for other agent
- ✅ Important notes
- ✅ Breaking changes alerts
- ✅ Pending requirements

### Use Contracts For:

- ✅ API type definitions
- ✅ Request/response interfaces
- ✅ Version management
- ✅ Breaking change detection

### Use Documentation For:

- ✅ Implementation guides
- ✅ Architecture decisions
- ✅ Component libraries
- ✅ Testing strategies
- ✅ Deployment procedures

---

## 🎉 Result

**Zero manual file copying!**

Everything syncs automatically:

- Types stay in sync
- Docs stay in sync
- Agents stay informed
- Version control enforced

**Frontend and backend can work independently while staying coordinated.**

---

**Environment:** Development only (NODE_ENV=development)
**Total Endpoints:** 8 dev endpoints
**Status:** ✅ Production-ready communication system

See `DOC_SHARING.md` for detailed implementation guide.
