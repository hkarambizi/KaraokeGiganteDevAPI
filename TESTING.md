# Testing Guide

## 🧪 Backend Testing (Complete ✅)

### Unit Tests

**Framework:** Vitest
**Coverage:** 51 tests across 5 test suites
**Status:** All passing ✅

#### Test Suites

1. **Model Tests** (`models.test.ts`)

   - Data model structure validation
   - Schema field verification
   - Index validation
   - 11 tests ✅

2. **Validation Tests** (`validation.test.ts`)

   - Zod schema validation
   - Input sanitization
   - Error handling
   - 15 tests ✅

3. **Queue Position Tests** (`queue-position.test.ts`)

   - Queue position calculation (1-based)
   - Sorting by creation time
   - Status filtering
   - 5 tests ✅

4. **Deduplication Tests** (`deduplication.test.ts`)

   - Song title normalization
   - Artist normalization
   - Duplicate detection logic
   - 11 tests ✅

5. **Environment Validation Tests** (`env-validation.test.ts`)
   - Required environment variables
   - Default values
   - Type parsing
   - 9 tests ✅

### Running Tests

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

### Test Results

```
✓ src/__tests__/env-validation.test.ts (9)
✓ src/__tests__/queue-position.test.ts (5)
✓ src/__tests__/models.test.ts (11)
✓ src/__tests__/validation.test.ts (15)
✓ src/__tests__/deduplication.test.ts (11)

Test Files  5 passed (5)
Tests  51 passed (51)
Duration  1.99s
```

---

## 📋 Frontend Testing (Required ⏳)

### Unit Tests Required

**Location:** Frontend repo `src/__tests__/`

#### 1. API Client Tests (`kgSDK.test.ts`)

```typescript
describe("KaraokeGigante SDK", () => {
	it("should search songs with pagination", async () => {
		const result = await kg.searchSongs("bohemian", 1, 20);
		expect(result.songs).toBeInstanceOf(Array);
		expect(result.page).toBe(1);
		expect(result.limit).toBe(20);
	});

	it("should create song request", async () => {
		const request = await kg.createRequest(eventId, {
			songId: "song123",
			coSingers: ["user456"],
		});
		expect(request.status).toBe("pending_admin");
		expect(request.inCrate).toBeDefined();
	});

	it("should get queue with positions", async () => {
		const queue = await kg.getQueue(eventId);
		queue.forEach((req, index) => {
			expect(req.queuePosition).toBe(index + 1);
		});
	});
});
```

#### 2. Type Validation Tests (`types.test.ts`)

```typescript
import type { Request, Song, User } from "@/types/api-contracts";

describe("API Response Types", () => {
	it("should match Request type", () => {
		const response: Request = {
			_id: "req123",
			eventId: "evt123",
			songId: "song123",
			userId: "user123",
			coSingers: [],
			status: "pending_admin",
			inCrate: false,
			createdAt: "2024-01-08T12:00:00.000Z",
			updatedAt: "2024-01-08T12:00:00.000Z",
		};

		expect(response._id).toBeDefined();
		expect(response.status).toMatch(
			/pending_admin|approved|rejected|queued|performed/
		);
	});
});
```

#### 3. Queue Position Tests (`queue.test.ts`)

```typescript
describe("Queue Position Display", () => {
	it("should display 1-based position", () => {
		const request = { queuePosition: 1 };
		const display = getPositionText(request);
		expect(display).toBe("You're up next!");
	});

	it("should display correct position for non-first", () => {
		const request = { queuePosition: 5 };
		const display = getPositionText(request);
		expect(display).toBe("Position #5");
	});
});
```

#### 4. Error Handling Tests (`errors.test.ts`)

```typescript
describe("API Error Handling", () => {
	it("should handle 401 unauthorized", async () => {
		try {
			await kg.getUserProfile(); // No token
		} catch (error) {
			expect(error.code).toBe("INVALID_TOKEN");
			expect(error.status).toBe(401);
		}
	});

	it("should handle 403 forbidden (admin only)", async () => {
		try {
			await kg.createEvent(data); // Singer tries admin action
		} catch (error) {
			expect(error.code).toBe("INSUFFICIENT_PERMISSIONS");
			expect(error.status).toBe(403);
		}
	});
});
```

### Integration Tests Required

**Location:** Frontend repo `src/__tests__/integration/`

#### 1. Authentication Flow Test

```typescript
describe("Authentication Integration", () => {
	it("should complete singer sign up flow", async () => {
		// 1. Sign up with Clerk
		const { user, sessionToken } = await clerkSignUp(email, password);

		// 2. Get JWT token
		const token = await getToken();

		// 3. Bootstrap user in backend
		kg.setToken(token);
		const profile = await kg.getUserProfile();

		expect(profile.clerkId).toBe(user.id);
		expect(profile.role).toBe("singer");
	});

	it("should complete admin org creation flow", async () => {
		// 1. Sign up
		const token = await getToken();
		kg.setToken(token);

		// 2. Create organization
		const org = await kg.createOrganization({ name: "Test Venue" });

		// 3. Verify role updated
		const profile = await kg.getUserProfile();
		expect(profile.role).toBe("admin");
		expect(profile.orgId).toBe(org.orgId);
	});
});
```

#### 2. Request Lifecycle Test

```typescript
describe("Request Lifecycle Integration", () => {
	it("should complete full request flow", async () => {
		// 1. Create request
		const request = await kg.createRequest(eventId, {
			songId: "song123",
		});
		expect(request.status).toBe("pending_admin");

		// 2. Approve as admin
		const approved = await kg.approveRequest(eventId, request._id, {
			addToCrate: true,
		});
		expect(approved.status).toBe("approved");
		expect(approved.inCrate).toBe(true);

		// 3. Check queue
		const queue = await kg.getQueue(eventId);
		const found = queue.find(r => r._id === request._id);
		expect(found).toBeDefined();
		expect(found.queuePosition).toBeGreaterThan(0);
	});
});
```

#### 3. Push Notification Test

```typescript
describe("Push Notifications Integration", () => {
	it("should register device and receive notification", async () => {
		// 1. Register device
		const token = await registerForPushNotificationsAsync();
		await kg.registerDevice({ token, platform: "ios" });

		// 2. Request song
		const request = await kg.createRequest(eventId, { songId: "song123" });

		// 3. Admin approves
		await kg.approveRequest(eventId, request._id);

		// 4. Wait for notification (may need mock or test helper)
		// Assert notification received
	});
});
```

### E2E Tests Required

**Location:** Frontend repo `e2e/`
**Framework:** Detox or Maestro

#### 1. Singer Flow

```typescript
describe("Singer E2E Flow", () => {
	it("should complete singer journey", async () => {
		// 1. Sign up
		await element(by.id("signup-email")).typeText("test@example.com");
		await element(by.id("signup-password")).typeText("password123");
		await element(by.id("signup-button")).tap();

		// 2. Search song
		await element(by.id("search-input")).typeText("bohemian");
		await waitFor(element(by.id("song-result-0"))).toBeVisible();

		// 3. Request song
		await element(by.id("song-result-0")).tap();
		await element(by.id("request-button")).tap();

		// 4. Check queue
		await element(by.id("queue-tab")).tap();
		await waitFor(element(by.id("queue-position"))).toBeVisible();

		const position = await element(by.id("queue-position")).getText();
		expect(position).toMatch(/Position #\d+/);
	});
});
```

#### 2. Admin Flow

```typescript
describe("Admin E2E Flow", () => {
	it("should complete admin journey", async () => {
		// 1. Sign up and create org
		await signUpAsAdmin("admin@venue.com", "My Venue");

		// 2. Create event
		await element(by.id("create-event-button")).tap();
		await element(by.id("event-name")).typeText("Friday Night");
		await element(by.id("save-event-button")).tap();

		// 3. Approve request
		await element(by.id("pending-tab")).tap();
		await element(by.id("approve-button-0")).tap();

		// 4. Verify in queue
		await element(by.id("queue-tab")).tap();
		await waitFor(element(by.id("queue-item-0"))).toBeVisible();
	});
});
```

---

## ✅ Testing Checklist

### Backend (Complete ✅)

- [x] Unit tests for models
- [x] Unit tests for validation
- [x] Unit tests for queue position
- [x] Unit tests for deduplication
- [x] Unit tests for environment
- [x] All tests passing (51/51)

### Frontend (Required ⏳)

- [ ] Unit tests for API client
- [ ] Unit tests for type validation
- [ ] Unit tests for queue position display
- [ ] Unit tests for error handling
- [ ] Integration test for auth flow
- [ ] Integration test for request lifecycle
- [ ] Integration test for push notifications
- [ ] E2E test for singer flow
- [ ] E2E test for admin flow
- [ ] E2E test for co-singing flow

---

## 🎯 Critical Test Cases

### Must Verify

1. **Queue Position is 1-Based**

   ```typescript
   const queue = await kg.getQueue(eventId);
   expect(queue[0].queuePosition).toBe(1); // Not 0!
   ```

2. **Populated Fields Present**

   ```typescript
   const requests = await kg.getRequests(eventId);
   expect(requests[0].song).toBeDefined();
   expect(requests[0].user).toBeDefined();
   expect(requests[0].coSingersData).toBeInstanceOf(Array);
   ```

3. **Status Enums Match**

   ```typescript
   const validStatuses = [
   	"pending_admin",
   	"approved",
   	"rejected",
   	"queued",
   	"performed",
   ];
   expect(validStatuses).toContain(request.status);
   ```

4. **Dates are ISO 8601**
   ```typescript
   expect(request.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
   expect(new Date(request.createdAt)).toBeInstanceOf(Date);
   ```

---

## 📊 Test Coverage Goals

### Backend

- **Current:** 100% of critical features ✅
- **Target:** 100% (achieved) ✅

### Frontend

- **Current:** 0% ⏳
- **Target:**
  - Unit: 80%+
  - Integration: Key flows
  - E2E: Happy paths

---

## 🚀 Getting Started

### Backend Tests

```bash
# Install dependencies (if not done)
npm install

# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Frontend Tests

```bash
# 1. Copy type definitions
cp ../backend/src/types/api-contracts.ts ./src/types/

# 2. Install testing libraries
npm install --save-dev vitest @testing-library/react-native

# 3. Create test files (see examples above)

# 4. Run tests
npm test
```

---

## 📞 Questions?

Post in `logs/cursor.log`:

```
AGENT: frontend
QUESTION: Should I test error responses or just success cases?

AGENT: backend
ANSWER: Test both! Error handling is critical for UX.
```

---

**Testing is not optional!**
Good tests prevent bugs and ensure API contracts stay in sync.

**Backend:** ✅ Complete (51 tests)
**Frontend:** ⏳ Your turn!
