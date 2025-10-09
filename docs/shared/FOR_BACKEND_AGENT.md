# 👋 Hello Backend Cursor Agent!

Welcome to the Karaoke Gigante backend integration task. The frontend is fully implemented and waiting for your API endpoints.

## 📚 Read These Documents IN ORDER

### 1. Start Here: BACKEND_INTEGRATION_GUIDE.md

**Complete API specification with:**

- All required endpoints (methods, paths, request/response formats)
- Data models for MongoDB
- Authentication flow details
- Push notification setup
- Error handling standards
- **Agent communication system** (see bottom of doc)

### 2. Then Read: FRONTEND_CHANGELOG.md

**What the frontend agent already built:**

- Implementation summary
- Key files to reference
- Specific notes about API expectations
- Pending requirements checklist
- Technical decisions made

### 3. Check: logs/cursor.log (if it exists)

**Inter-agent communication:**

- Previous backend agent notes (if any)
- Questions from frontend agent
- Important clarifications

## 🚀 Quick Start

### Your Mission

Implement the backend API to support the Karaoke Gigante React Native app:

- **Singers** can search songs, submit requests, view queue
- **Admins** can manage events, approve requests, build crates, broadcast notifications

### Critical Requirements

1. **Clerk Authentication**

   - Validate JWT tokens from frontend
   - Store `clerkId` in User model
   - Support organization-based admin roles

2. **Push Notifications**

   - Use `expo-server-sdk`
   - Store push tokens per user
   - Send on approval/rejection/broadcast

3. **Role-Based Access**

   - `role: 'singer'` - Personal accounts (default)
   - `role: 'admin'` - Organization members
   - Enforce permissions on admin-only endpoints

4. **Development Endpoints**
   - `POST /api/dev/changelog` - Receive frontend updates
   - `GET /api/dev/changelog` - Send backend updates
   - Only active when `NODE_ENV=development`

## 🎯 Implementation Checklist

### Phase 1: Foundation (Start Here)

- [ ] Set up Express server with MongoDB
- [ ] Configure Clerk SDK for JWT validation
- [ ] Implement User model with `clerkId` and `role`
- [ ] Create `POST /api/dev/changelog` endpoint
- [ ] Create `GET /api/dev/changelog` endpoint
- [ ] Test: Frontend can POST/GET changelogs

### Phase 2: Core Authentication

- [ ] `GET /api/users/me` - Bootstrap user from JWT
- [ ] `PUT /api/users/me` - Update profile
- [ ] `GET /api/users/search?q=` - Co-singer search
- [ ] `POST /api/orgs` - Create organization + set admin role
- [ ] Test: Sign up flows (singer + admin)

### Phase 3: Songs & Events

- [ ] Seed Song collection (or Spotify integration)
- [ ] `GET /api/songs/search?q=&page=&limit=` - With pagination
- [ ] `GET /api/events` - List events (admin)
- [ ] `POST /api/events` - Create event (admin)
- [ ] `GET /api/events/active` - Active event (singers)
- [ ] Test: Search songs, create event

### Phase 4: Requests & Queue

- [ ] `POST /api/events/:id/requests` - Submit request
- [ ] `GET /api/events/:id/requests` - List requests
- [ ] `GET /api/events/:id/queue` - **Include queuePosition!**
- [ ] `POST /api/events/:id/requests/:rid/approve` - Approve
- [ ] `POST /api/events/:id/requests/:rid/reject` - Reject
- [ ] `PUT /api/events/:id/requests/:rid/video` - Set video URL
- [ ] Test: Full request lifecycle

### Phase 5: Crates

- [ ] `GET /api/events/:id/crate` - Get crate
- [ ] `POST /api/events/:id/crate/songs` - Add song
- [ ] `DELETE /api/events/:id/crate/songs/:sid` - Remove song
- [ ] `POST /api/events/:id/crate/merge` - Merge crates
- [ ] Test: Crate management

### Phase 6: Notifications

- [ ] Install `expo-server-sdk`
- [ ] `POST /api/devices/register` - Store push token
- [ ] `POST /api/broadcast` - Send to all users
- [ ] Add push sends to approve/reject handlers
- [ ] Test: Receive notification on phone

## 📝 Agent Communication Protocol

**When you start:**

```javascript
// Read the existing changelog
const frontendNotes = fs.readFileSync("logs/cursor.log", "utf-8");
console.log("Frontend agent notes:", frontendNotes);
```

**When you finish a phase:**

```javascript
// Append your changelog
const backendUpdate = `
${"=".repeat(80)}
AGENT: backend
TIMESTAMP: ${new Date().toISOString()}
TASKS COMPLETED:
  1. Implemented user authentication endpoints
  2. Added Clerk JWT validation middleware
  3. Created organization creation flow

NOTES FOR FRONTEND AGENT:
  - /api/users/me returns null for role if not set (not 'singer')
  - Search endpoints limited to 20 results for performance
  - Queue position calculated by request creation time

QUESTIONS:
  - Should rejected requests stay in queue or be hidden?
  - Co-singer limit per request?
${"=".repeat(80)}
`;

fs.appendFileSync("logs/cursor.log", backendUpdate);
```

## 🔍 Key Reference Files

**API Signatures:**

- `BACKEND_INTEGRATION_GUIDE.md` - Complete spec

**Frontend Implementation:**

- `src/services/kgSDK.ts` - How frontend calls your API
- `app/(tabs)/home.tsx` - Song search + request flow
- `app/(tabs)/queue.tsx` - Queue display (needs queuePosition)
- `src/components/admin/PendingRequestsTab.tsx` - Admin approval
- `src/components/admin/CratesTab.tsx` - Crate management

## 🧪 Testing with Frontend

```bash
# Start your backend
npm run dev  # or yarn dev

# In another terminal, start frontend
cd /path/to/KaraokeGigante
npm run dev:local

# Frontend will connect to http://localhost:3000
```

## ⚠️ Important Details

### 1. Queue Position Field

**Critical:** The `GET /api/events/:id/queue` endpoint MUST include `queuePosition` field in each request object. Frontend displays this to users.

```javascript
// Each request in queue response:
{
  "_id": "req-123",
  "queuePosition": 3,  // ← Frontend needs this!
  "song": { ... },
  "user": { ... }
}
```

### 2. Population

**Always populate these:**

- Requests: `song`, `user`, `coSingersData`
- Crates: `songs` array
- Queue: Same as requests

### 3. Role Assignment

**On admin signup:**

1. Create user in MongoDB
2. Create Clerk organization via API
3. Add user to organization with `admin` role
4. Update user's MongoDB record: `role: 'admin'`
5. Sync role to Clerk public metadata

### 4. Error Format

```json
{
	"error": "Human-readable message",
	"code": "ERROR_CODE"
}
```

## 💡 Tips

1. **Start with changelog endpoints** - They're simple and enable communication
2. **Read BACKEND_INTEGRATION_GUIDE.md carefully** - Everything is documented
3. **Check frontend implementation** - See exactly how endpoints are called
4. **Test incrementally** - Frontend is ready, test each endpoint as you build
5. **Update cursor.log** - Keep frontend agent informed

## 🆘 Need Help?

1. Check `BACKEND_INTEGRATION_GUIDE.md` for detailed specs
2. Look at `src/services/kgSDK.ts` to see expected request/response formats
3. Post questions to `logs/cursor.log` for frontend agent
4. Review existing frontend screens to understand user flow

## ✅ Definition of Done

- [ ] All endpoints from checklist implemented
- [ ] Clerk authentication working
- [ ] Push notifications sending
- [ ] Role-based access control enforced
- [ ] Development changelog endpoints functional
- [ ] Tested with frontend running
- [ ] Updated `logs/cursor.log` with your changelog
- [ ] No sensitive data in responses (full user objects, etc.)
- [ ] CORS configured for Expo dev servers
- [ ] MongoDB indexes created

## 🎉 Ready to Start?

1. Read `BACKEND_INTEGRATION_GUIDE.md` (15 min)
2. Skim `FRONTEND_CHANGELOG.md` (5 min)
3. Check `logs/cursor.log` if exists (2 min)
4. Implement Phase 1 (changelog endpoints)
5. Test with frontend
6. Continue through phases
7. Update changelog when done

---

**Good luck, Backend Agent!** 🚀

The frontend is counting on you. Everything is documented, and the frontend is ready to integrate as soon as your endpoints are live.

**Questions?** Update `logs/cursor.log` and the frontend agent will clarify!

---

**Last Updated:** 2024-01-08
**Frontend Agent:** Claude (Cursor) ✅ Complete
**Backend Agent:** [Your turn!] ⏳ Pending
