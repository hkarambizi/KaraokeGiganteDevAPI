# Karaoke Gigante API v2.0

> TypeScript + Fastify + MongoDB + Clerk Organizations

Complete backend implementation for the Karaoke Gigante mobile app with organization-based admin roles and personal singer accounts.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Clerk account with organization support
- Expo account (for push notifications)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your .env file with:
# - CLERK_SECRET_KEY
# - CLERK_PUBLISHABLE_KEY
# - MONGO_URI
# - (Optional) UPSTASH_REDIS_REST_URL, EXPO_ACCESS_TOKEN, etc.

# Run in development
npm run dev

# Build for production
npm run build

# Start production server
NODE_ENV=production npm start
```

## 📋 Environment Variables

Required:

- `NODE_ENV` - development | production | test
- `PORT` - Server port (default: 3000)
- `MONGO_URI` - MongoDB connection string
- `CLERK_SECRET_KEY` - Clerk secret key
- `CLERK_PUBLISHABLE_KEY` - Clerk publishable key

Optional:

- `UPSTASH_REDIS_REST_URL` - Redis cache URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis auth token
- `QSTASH_TOKEN` - QStash for background jobs
- `SPOTIFY_CLIENT_ID` - Spotify API integration
- `SPOTIFY_CLIENT_SECRET` - Spotify API secret
- `EXPO_ACCESS_TOKEN` - Expo push notifications
- `CORS_ORIGINS` - Allowed CORS origins (comma-separated)

## 🏗️ Architecture

### Tech Stack

- **Fastify** - Fast web framework
- **TypeScript** - Type-safe development
- **MongoDB + Mongoose** - Document database
- **Clerk** - Authentication + Organizations
- **Expo Server SDK** - Push notifications
- **Zod** - Input validation
- **Pino** - High-performance logging

### Data Models

- **User** - Personal accounts (singers) or org members (admins)
- **Organization** - Clerk organizations mapped to MongoDB
- **Song** - Song catalog with deduplication
- **Event** - Karaoke events (org-scoped)
- **Request** - Song requests with queue positions
- **Crate** - Song collections per event
- **Performance** - Historical performance records

### Authentication Flow

**Singer (Personal Account):**

1. Sign up via Clerk
2. Auto-bootstrap in MongoDB as `role: 'singer'`
3. Access personal endpoints

**Admin (Organization Member):**

1. Sign up via Clerk
2. Call `POST /api/orgs` to create organization
3. Backend creates Clerk org and sets user as admin
4. Access admin-only endpoints

## 📡 API Endpoints

### Development (NODE_ENV=development only)

```
Changelog:
  POST   /api/dev/changelog              # Record agent updates
  GET    /api/dev/changelog              # Read agent communication

Contracts:
  GET    /api/dev/contracts              # Fetch API contracts
  POST   /api/dev/contracts/verify       # Verify version compatibility

Documentation:
  GET    /api/dev/docs                   # List all documentation
  GET    /api/dev/docs/:filename         # Fetch specific document
  POST   /api/dev/docs/:filename         # Upload documentation
  DELETE /api/dev/docs/:filename         # Delete shared document
```

### Authentication & Users

```
GET    /api/users/me               # Get current user
PUT    /api/users/me               # Update profile
GET    /api/users/search?q=        # Search users (co-singers)
```

### Organizations

```
POST   /api/orgs                   # Create organization (becomes admin)
```

### Songs

```
GET    /api/songs/search?q=&page=&limit=  # Search catalog
POST   /api/songs/saveFromSpotify         # Add song to catalog
```

### Events

```
GET    /api/events                 # List events (admin)
POST   /api/events                 # Create event (admin)
GET    /api/events/:id             # Get event details
GET    /api/events/active          # Active event (singers)
PATCH  /api/events/:id             # Update event (admin)
```

### Requests (Song Requests)

```
POST   /api/events/:id/requests              # Create request (singer)
GET    /api/events/:id/requests              # List requests (filters: status, inCrate)
GET    /api/events/:id/queue                 # Get queue with positions
POST   /api/events/:id/requests/:rid/approve # Approve (admin)
POST   /api/events/:id/requests/:rid/reject  # Reject (admin)
PUT    /api/events/:id/requests/:rid/video   # Update video URL (admin)
```

### Crates (Song Collections)

```
GET    /api/events/:id/crate              # Get crate
POST   /api/events/:id/crate/songs        # Add song (admin)
DELETE /api/events/:id/crate/songs/:sid   # Remove song (admin)
POST   /api/events/:id/crate/merge        # Merge crates (admin)
```

### Devices & Notifications

```
POST   /api/devices/register     # Register push token
POST   /api/broadcast            # Send broadcast (admin)
```

### Health Check

```
GET    /health                   # Server health status
```

## 🔒 Security

- **JWT Validation**: All endpoints verify Clerk JWT tokens
- **Role-Based Access**: Admin-only endpoints check `role: 'admin'`
- **Organization Scoping**: Admins can only access their org's data
- **Input Validation**: Zod schemas validate all inputs
- **CORS Protection**: Configurable allowed origins

## 🧪 Testing

### Backend Unit Tests ✅

**All tests passing:** 51/51

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Open visual test UI
npm run test:ui
```

**Test Coverage:**

- Model validation (11 tests)
- Input validation (15 tests)
- Queue position calculation (5 tests)
- Song deduplication (11 tests)
- Environment validation (9 tests)

See `TESTING.md` for complete testing guide.

### Frontend Testing Required ⏳

**Frontend must implement:**

1. Unit tests for API client
2. Integration tests for auth flow
3. Integration tests for request lifecycle
4. E2E tests for user flows

See `TESTING.md` and `API_CONTRACTS.md` for requirements.

### Manual Testing

```bash
# Start development server
npm run dev

# Run tests
npm test

# Test authentication
curl -H "Authorization: Bearer <clerk-jwt>" \
  http://localhost:3000/api/users/me

# Test health check
curl http://localhost:3000/health
```

### Frontend Integration

Frontend is ready and waiting. Update frontend's `.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**Important:** Sync type definitions to frontend via HTTP:

```bash
# Frontend runs this:
npm run sync-contracts

# This fetches contracts from:
# GET http://localhost:3000/api/dev/contracts
```

See `CONTRACTS_SYNC.md` for setup instructions.

## 📝 Development Workflow

### Phase Checklist

- [x] **Phase 1**: Foundation (TypeScript, Fastify, MongoDB, Clerk)
- [x] **Phase 2**: Authentication (Users, Organizations)
- [x] **Phase 3**: Songs & Events
- [x] **Phase 4**: Requests & Queue
- [x] **Phase 5**: Crates
- [x] **Phase 6**: Notifications

### Agent Communication

This project supports inter-agent communication via `logs/cursor.log`:

- Frontend agent posts updates
- Backend agent reads context
- Enables seamless collaboration

## 🐛 Troubleshooting

**JWT Verification Fails**

- Check `CLERK_SECRET_KEY` matches your Clerk dashboard
- Ensure frontend is sending valid JWT tokens

**MongoDB Connection Error**

- Verify `MONGO_URI` is correct
- Check MongoDB is running (if local)

**Push Notifications Not Sending**

- Validate Expo push token format
- Check user has registered device
- Verify `EXPO_ACCESS_TOKEN` is set

**CORS Errors**

- Add frontend origin to `CORS_ORIGINS` in .env
- Format: `http://localhost:8081,http://localhost:19006`

## 📚 Additional Resources

- [Clerk Organizations Guide](https://clerk.com/docs/organizations/overview)
- [Fastify Documentation](https://fastify.dev)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Frontend Integration Guide](.cursor/BACKEND_INTEGRATION_GUIDE.md)

## 🔄 Migration from v1.0

The original Express implementation is preserved in `server.js`. The new TypeScript implementation is in `src/`.

Key differences:

- Express → Fastify
- JavaScript → TypeScript
- Phone auth → Clerk Organizations
- Manual auth → JWT validation with Clerk SDK
- Basic roles → Organization-based admin roles

## 📦 Project Structure

```
src/
├── config/
│   ├── env.ts              # Environment configuration
│   └── database.ts         # MongoDB connection
├── middleware/
│   └── auth.ts             # Clerk JWT verification
├── models/
│   ├── User.ts
│   ├── Organization.ts
│   ├── Song.ts
│   ├── Event.ts
│   ├── Request.ts
│   ├── Crate.ts
│   └── Performance.ts
├── routes/
│   ├── dev.ts              # Development endpoints
│   ├── users.ts
│   ├── organizations.ts
│   ├── songs.ts
│   ├── events.ts
│   ├── requests.ts
│   ├── crates.ts
│   ├── devices.ts
│   └── broadcast.ts
├── services/
│   └── notifications.ts    # Expo push notifications
└── index.ts                # Fastify server
```

## 🤝 Contributing

1. Create feature branch
2. Implement with TypeScript strict mode
3. Add Zod validation for inputs
4. Test with frontend integration
5. Update changelog in `logs/cursor.log`

## 📄 License

ISC

---

**Version**: 2.0.0
**Last Updated**: 2024-01-08
**Status**: ✅ Ready for production
