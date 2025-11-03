# 📋 Changelog - Karaoke Gigante API

**Last Updated:** 2025-11-03  
**Format:** Date/Time sorted entries with clear titles and descriptions

---

## 2025-11-03
### 📝 Org Creation Contract & Clerk Requirements (Backend)

**Time:** 07:15:00 UTC  
**Description:** Aligned API contracts and clarified Clerk requirements for organization creation. Added detailed error mapping/logging.

**Changes:**
- Updated CreateOrganizationRequest to include slug and optional logoUrl
- Updated CreateOrganizationResponse to include clerkOrgId, slug, logoUrl, createdAt/updatedAt
- Mapped Clerk slug conflicts to 409 (SLUG_EXISTS_CLERK)
- Added 502 on Clerk failures with dev details
- Improved logs to include Clerk status/message

**Notes:**
- Slug must be lowercase, hyphenated, unique in Clerk and MongoDB
- Frontend should call POST /api/orgs with { name, slug, logoUrl? }
- If 409 SLUG_EXISTS or SLUG_EXISTS_CLERK is returned, prompt user to choose a different slug

**Pending:**
- [ ] Frontend update its api-contracts to match v4.0.1 for org creation

**Result:** ✅ Completed

---
### 📝 API Contracts v4.0.1 + Explicit users/me methods (Backend)

**Time:** 07:46:00 UTC  
**Description:** Contracts bumped to v4.0.1. Explicit support for GET and POST /api/users/me. Frontend should sync contracts and prefer GET for profile fetch.

**Changes:**
- Bumped contracts version to 4.0.1
- Org create request now { name, slug, logoUrl? }
- Org create response now includes clerkOrgId, slug, logoUrl, createdAt/updatedAt
- Documented GET (preferred) and POST (compat alias) for /api/users/me

**Notes:**
- Use GET /api/users/me going forward; POST exists for compatibility
- Fetch contracts via GET /api/dev/contracts and verify via POST /api/dev/contracts/verify

**Pending:**
- [ ] Frontend: sync to v4.0.1 contracts
- [ ] Frontend: update org create form to send slug (lowercase, hyphenated)

**Result:** ✅ Completed

---

## 2024-11-03

### 🐛 Fixed: Organization `createdBy` Validation Error (Backend)

**Time:** 04:30 UTC
**Issue:** Organization sync from Clerk was failing validation
**Error:** `createdBy: Path 'createdBy' is required`
**Root Cause:** `createdBy` was being set to empty string when syncing from Clerk

**Fix:**
- Enhanced `syncOrganizationsFromClerk()` to accept `clerkId` parameter
- Look up MongoDB user by `clerkId` to get MongoDB `_id`
- Use MongoDB `_id` for `createdBy` (not Clerk ID)
- Added multi-level fallback strategy for `createdBy`

**Result:** ✅ Organizations now sync successfully from Clerk to MongoDB

---

### 🐛 Fixed: Organization Lookup Returning Empty Arrays (Backend)

**Time:** 04:20 UTC
**Issue:** `GET /api/orgs/my` returning empty arrays even when users have Clerk organizations
**Root Cause:** Organizations exist in Clerk but not in MongoDB, no auto-sync

**Fix:**
- Added auto-sync on user bootstrap (auth middleware)
- Added auto-sync on `GET /api/orgs/my` endpoint
- Enhanced organization sync service with better error handling
- Added detailed DEBUG logging for troubleshooting

**Result:** ✅ Organizations automatically synced from Clerk to MongoDB

---

### 🔍 Enhanced DEBUG Logging (Backend)

**Time:** 03:47 UTC
**Feature:** Better debugging data in DEBUG mode

**Changes:**
- Added request body logging in DEBUG mode
- Added response body logging in DEBUG mode
- Enhanced error logging with full stack traces
- Added validation error details in responses (dev mode only)

**Result:** ✅ Full visibility into request/response/error flow in DEBUG mode

---

### 🔧 Fixed: MongoDB Query Logging (Backend)

**Time:** 03:40 UTC
**Issue:** No MongoDB interactions visible in logs

**Fix:**
- Enabled `mongoose.set('debug', ...)` in development mode
- Logs all MongoDB queries with collection, method, query, and doc preview

**Result:** ✅ All MongoDB interactions now logged in development

---

### 📊 Fixed: Duplicate Key Error on Old Index (Backend)

**Time:** 03:32 UTC
**Issue:** `E11000 duplicate key error collection: karaoke-gigante.users index: clerkUserId_1`

**Fix:**
- Ran migration script to drop old `clerkUserId_1` index
- Verified correct indexes: `clerkId_1`, `username_1`

**Result:** ✅ User creation now works without duplicate key errors

---

## 2024-11-02

### 🏗️ New Architecture: Singer/Host Separation (Backend)

**Time:** 23:57 UTC
**Feature:** Complete role management refactor

**Changes:**
- `User` model now profile-only (removed `role` and `orgId`)
- New `Singer` collection for singer-specific data
- New `Host` collection for admin-specific data + view preference
- `Host` record presence determines admin access
- View switching via `Host.currentView` instead of Clerk metadata

**Result:** ✅ Clean separation of concerns, better scalability

---

### 🎭 Guest View Feature (Backend)

**Time:** 22:40 UTC
**Feature:** Allow admins to switch between admin and singer views

**Endpoint:** `POST /api/admin/switch-view`
**Purpose:** Toggle between Host View and Guest View

**Changes:**
- `Host.currentView` field: `'host'` or `'guest'`
- Effective role determined by view preference
- Routes admin to appropriate view based on preference

**Result:** ✅ Admins can experience singer view without logging out

---

### 📦 Organization Sync from Clerk (Backend)

**Time:** 21:15 UTC
**Feature:** Automatic sync of organizations from Clerk to MongoDB

**Purpose:** Handle organizations created outside our API

**Changes:**
- New `organizationSync` service
- Auto-sync on user bootstrap
- Auto-sync on organization list endpoint
- Graceful error handling (non-fatal)

**Result:** ✅ Organizations always in sync between Clerk and MongoDB

---

## 2024-10-09

### 🔄 Auth Flow Redesign (Backend)

**Time:** 18:00 UTC
**Feature:** Support for new frontend authentication system

**Changes:**
- `username` field now REQUIRED (was optional)
- `email` field now OPTIONAL (can be missing for phone-only users)
- Support for passwordless authentication (OAuth, SMS/Email codes)
- Updated User model and validation

**Result:** ✅ Backend supports new frontend auth flow

---

### 📚 Documentation Sharing System (Backend)

**Time:** 17:30 UTC
**Feature:** HTTP-based documentation sharing between agents

**Endpoints:**
- `GET /api/dev/docs` - List all documentation
- `GET /api/dev/docs/:filename` - Get specific document
- `POST /api/dev/docs/:filename` - Upload/update document
- `DELETE /api/dev/docs/:filename` - Delete shared document

**Result:** ✅ Agents can share documentation automatically

---

### 🔗 API Contract Synchronization (Backend)

**Time:** 17:00 UTC
**Feature:** HTTP-based API contract sharing between frontend/backend

**Endpoints:**
- `GET /api/dev/contracts` - Get API contracts
- `POST /api/dev/contracts/verify` - Verify contract versions

**Result:** ✅ API contracts automatically synchronized

---

## Frontend Updates

### 📱 Organization Management UI (Frontend)

**Time:** 04:17 UTC (2024-11-03)
**Feature:** Complete organization management interface

**Components:**
- Organizations list screen
- Organization details screen
- Member management
- Invitation system UI

**Result:** ✅ Full UI for organization management

---

### 🔐 Multi-Step Sign-Up Flow (Frontend)

**Time:** 03:50 UTC (2024-11-03)
**Feature:** Dynamic field collection based on auth method

**Flows:**
- Google OAuth → username + phone
- Phone → username + email
- Email → username + phone

**Result:** ✅ Seamless sign-up experience

---

### 📝 Username Validation (Frontend)

**Time:** 03:30 UTC (2024-11-03)
**Feature:** Real-time username availability checking

**Features:**
- Debounced API calls (500ms)
- Visual feedback (checking → available/taken)
- Green checkmark when available
- Red error when taken

**Result:** ✅ Better UX for username selection

---

## Notes

### Organization Lookup Issue (Frontend Report)

**Time:** 04:25 UTC (2024-11-03)
**Issue:** `GET /api/orgs/my` returning empty arrays
**Status:** ✅ Fixed (see fixes above)

### createdBy Validation Issue (Frontend Report)

**Time:** 04:25 UTC (2024-11-03)
**Issue:** Organization sync failing validation
**Status:** ✅ Fixed (see fixes above)

---

## Format

Each entry includes:
- **Date/Time:** When the change was made
- **Type:** 🐛 Bug, 🔧 Fix, 🏗️ Architecture, 📦 Feature, etc.
- **Title:** Clear, descriptive title
- **Description:** What changed and why
- **Result:** Impact/outcome

---

## Maintenance

- Keep entries sorted by date/time (newest first)
- Use clear, descriptive titles
- Include frontend and backend updates
- Mark status: ✅ Fixed, 🔄 In Progress, ⚠️ Issue, etc.

---

