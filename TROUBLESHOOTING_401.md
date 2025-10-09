# 🚨 401 Authentication Error - Troubleshooting

**For Frontend Agent:** This document helps diagnose and fix 401 authentication errors.

**Status:** Backend ready with improved error logging and debug endpoints
**Updated:** 2024-01-08

---

## ⚠️ Issue Detected

Backend received a request from frontend:

```
GET /api/songs/search?q=Drake&page=1&limit=20
Result: 401 Unauthorized
```

The request was rejected due to authentication failure.

---

## 🔍 Debug Endpoints Now Available

Backend has added **2 new debug endpoints** to help you troubleshoot:

### 1. GET /api/debug/auth

Test your authentication with the token you're currently using:

```typescript
// Frontend code:
const { getToken } = useAuth();
const token = await getToken();

const response = await fetch("http://localhost:3000/api/debug/auth", {
	headers: {
		Authorization: `Bearer ${token}`,
	},
});

const debug = await response.json();
console.log("Auth debug:", debug);
```

**This will tell you exactly what's wrong:**

- Missing header?
- Wrong format?
- Token invalid?
- Token expired?
- Clerk keys mismatch?

### 2. POST /api/debug/verify-token

Verify a specific token:

```typescript
const response = await fetch("http://localhost:3000/api/debug/verify-token", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ token: yourToken }),
});

const result = await response.json();
console.log("Token verification:", result);
```

---

## 🎯 Most Likely Causes

### Cause 1: Clerk Keys Mismatch (80% of cases)

**Problem:** Frontend and backend using keys from different Clerk applications

**Check:**

1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to API Keys
4. Verify:
   - Frontend `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` = Publishable key
   - Backend `CLERK_SECRET_KEY` = Secret key
   - **Both from the SAME application**

**Frontend .env:**

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

**Backend .env:**

```bash
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
```

⚠️ The `pk_test_` parts should match!

### Cause 2: Token Not Being Sent

**Problem:** Authorization header missing or malformed

**Check Frontend Code:**

```typescript
// ✅ CORRECT
const token = await getToken();
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,  // ← Must be exactly this format
  }
});

// ❌ WRONG - Missing Authorization header
const response = await fetch(url);

// ❌ WRONG - Missing "Bearer " prefix
headers: { 'Authorization': token }

// ❌ WRONG - Token is null/undefined
const token = await getToken();  // Returns null if not signed in
```

**Verify:**

```typescript
const token = await getToken();
console.log("Token exists:", !!token);
console.log("Token preview:", token?.substring(0, 30));

if (!token) {
	console.error("❌ No token - user not signed in or session expired");
}
```

### Cause 3: Token Expired

**Problem:** JWT token has expired

**Check:**

```typescript
const response = await fetch("http://localhost:3000/api/debug/verify-token", {
	method: "POST",
	body: JSON.stringify({ token: await getToken() }),
});

const result = await response.json();
console.log("Is expired:", result.isExpired);
console.log("Expires at:", result.expiresAt);
```

**Solution:** Clerk tokens auto-refresh. Make sure you're calling `getToken()` fresh each time:

```typescript
// ✅ CORRECT - Fresh token each request
const makeRequest = async () => {
	const token = await getToken(); // Get fresh token
	await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
};

// ❌ WRONG - Reusing old token
const token = await getToken();
// ... later ...
await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); // May be expired!
```

---

## 🛠️ How to Debug

### Step 1: Check Backend Logs

Backend now has **detailed error logging**. When you make a request, check the terminal for:

```
[WARN] No authorization header provided
  → You're not sending the header

[ERROR] Clerk token verification failed:
  error: "Invalid signature"
  tokenPreview: "eyJhbGc..."
  → Clerk keys don't match

[WARN] Token is empty or too short
  → Token is null or corrupted
```

### Step 2: Use Debug Endpoint

```typescript
// Add this to your frontend temporarily:
const debugAuth = async () => {
	try {
		const { getToken, isSignedIn } = useAuth();

		console.log("=== AUTH DEBUG ===");
		console.log("Signed in:", isSignedIn);

		const token = await getToken();
		console.log("Token exists:", !!token);

		if (!token) {
			console.error("❌ No token available");
			return;
		}

		const response = await fetch("http://localhost:3000/api/debug/auth", {
			headers: { Authorization: `Bearer ${token}` },
		});

		const debug = await response.json();
		console.log("Debug result:", debug);

		if (debug.success) {
			console.log("✅ Authentication working!");
		} else {
			console.error("❌ Authentication failed:", debug.error);
			console.error("Solution:", debug.solution);
		}
	} catch (error) {
		console.error("Debug failed:", error);
	}
};

// Call it when you encounter 401
debugAuth();
```

### Step 3: Verify in API Client

Check your `kgSDK.ts` implementation:

```typescript
class KaraokeGiganteSDK {
	async makeRequest(endpoint: string, options: RequestInit = {}) {
		const token = await this.getToken(); // ← Make sure this works

		if (!token) {
			throw new Error("No authentication token available");
		}

		const response = await fetch(`${this.baseUrl}${endpoint}`, {
			...options,
			headers: {
				Authorization: `Bearer ${token}`, // ← Must be included
				"Content-Type": "application/json",
				...options.headers,
			},
		});

		if (response.status === 401) {
			// Log detailed error for debugging
			const error = await response.json();
			console.error("401 Error:", error);
			throw new Error(`Authentication failed: ${error.code}`);
		}

		return response;
	}
}
```

---

## ✅ Verification Checklist

Run through this:

- [ ] Backend is running on port 3000
- [ ] User is signed in (`isSignedIn === true`)
- [ ] `getToken()` returns a non-null token
- [ ] Token is being sent in Authorization header
- [ ] Header format is: `Authorization: Bearer <token>`
- [ ] Clerk keys are from the same application
- [ ] `CLERK_SECRET_KEY` matches your Clerk dashboard
- [ ] `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` matches your Clerk dashboard

---

## 🚀 Quick Fix Commands

### Test Backend is Running

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok",...}
```

### Test Debug Endpoint (from frontend console)

```javascript
// Get your token
const token = await getToken();

// Test it
fetch("http://localhost:3000/api/debug/auth", {
	headers: { Authorization: `Bearer ${token}` },
})
	.then(r => r.json())
	.then(console.log);
```

### Check Clerk Dashboard

1. Visit https://dashboard.clerk.com
2. Select your application
3. Go to **API Keys**
4. Copy the **Secret key** for backend
5. Copy the **Publishable key** for frontend
6. Make sure they're from the **same application**

---

## 📊 What Backend Sees

When your request comes in, backend logs:

```
[INFO] incoming request
  method: "GET"
  url: "/api/songs/search?q=Drake"

[WARN] No authorization header provided
  // OR
[ERROR] Clerk token verification failed:
  error: "Invalid signature"
  tokenPreview: "eyJhbGc..."

[INFO] request completed
  statusCode: 401
```

This tells you exactly what went wrong!

---

## 💡 Solutions

### If Missing Header

```typescript
// Check your API client always adds the header:
const makeAuthenticatedRequest = async (url, options = {}) => {
	const token = await getToken();
	return fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			...options.headers,
		},
	});
};
```

### If Token Verification Fails

1. Verify Clerk keys match (same application)
2. Check token is not expired
3. Test with `/api/debug/verify-token`
4. If still failing, regenerate Clerk keys

### If User Not Found

- Backend will auto-bootstrap users from Clerk
- If failing, check Clerk API connectivity
- Verify `CLERK_SECRET_KEY` is correct

---

## 📞 Report Issue

If still having problems, post to changelog:

```bash
POST /api/dev/changelog
{
  "agent": "frontend",
  "timestamp": "2024-01-08T...",
  "tasks": [],
  "notes": [],
  "questions": [
    "Getting 401 on /api/songs/search",
    "Tried debug endpoint - shows: [paste result]",
    "Clerk keys verified from same application",
    "Token preview: eyJhbGc... (first 20 chars)",
    "What else should I check?"
  ]
}
```

Backend will investigate and respond with specific guidance!

---

**Updated:** 2024-01-08
**Backend:** Enhanced error logging active ✅
**Debug Endpoints:** Available in development ✅
**Next Step:** Use `/api/debug/auth` from frontend to diagnose issue
