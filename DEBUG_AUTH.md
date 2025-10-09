# Authentication Debugging Guide

## 🔍 Debugging 401 Errors

If the frontend is getting 401 errors, use these steps to diagnose the issue.

---

## 🧪 Debug Endpoints (Development Only)

### GET /api/debug/auth

**Purpose:** Test authentication with the current request
**Usage:** Call from frontend with your JWT token

```bash
# From frontend, make a request with your token:
fetch('http://localhost:3000/api/debug/auth', {
  headers: {
    'Authorization': `Bearer ${yourClerkToken}`
  }
})
```

**Returns:**

```json
{
	"hasAuthHeader": true,
	"authHeaderPreview": "Bearer eyJhbGciOiJSUzI1NiIs...",
	"startsWithBearer": true,
	"clerkSecretKeyConfigured": true,
	"tokenLength": 450,
	"success": true,
	"decoded": {
		"sub": "user_123abc",
		"iat": 1704711600,
		"exp": 1704715200
	},
	"message": "✅ Token is valid!"
}
```

### POST /api/debug/verify-token

**Purpose:** Verify a specific token directly

```bash
curl -X POST http://localhost:3000/api/debug/verify-token \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_CLERK_JWT_HERE"}'
```

**Returns:**

```json
{
	"success": true,
	"valid": true,
	"decoded": {
		"sub": "user_123abc",
		"iat": 1704711600,
		"exp": 1704715200
	},
	"expiresAt": "2024-01-08T13:00:00.000Z",
	"isExpired": false
}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Missing authorization header"

**Symptom:**

```json
{
	"error": "Missing authorization header",
	"code": "MISSING_AUTH_HEADER"
}
```

**Cause:** Frontend not sending the Authorization header

**Solution (Frontend):**

```typescript
// Make sure you're including the header:
const token = await getToken();
const response = await fetch(url, {
	headers: {
		Authorization: `Bearer ${token}`, // ← Must include this!
		"Content-Type": "application/json",
	},
});
```

### Issue 2: "Invalid authorization header format"

**Symptom:**

```json
{
	"error": "Invalid authorization header format",
	"code": "INVALID_AUTH_HEADER"
}
```

**Cause:** Header doesn't start with "Bearer "

**Solution:** Check the header format:

```typescript
// ✅ CORRECT
Authorization: Bearer eyJhbGc...

// ❌ WRONG
Authorization: eyJhbGc...
```

### Issue 3: "Token verification failed"

**Symptom:**

```json
{
	"error": "Token verification failed",
	"code": "TOKEN_VERIFICATION_FAILED",
	"details": "..."
}
```

**Possible Causes:**

1. **Token expired**

   - Check token expiration: Use `/api/debug/verify-token`
   - Solution: Refresh token in frontend

2. **Wrong Clerk application**

   - Token generated for different Clerk app
   - Solution: Verify `CLERK_SECRET_KEY` matches frontend's Clerk app

3. **Invalid token format**
   - Token corrupted or malformed
   - Solution: Get fresh token from Clerk

**Debug Steps:**

```typescript
// Frontend: Check token details
const { getToken } = useAuth();
const token = await getToken();
console.log("Token:", token.substring(0, 50) + "...");
console.log("Token length:", token.length);

// Test with debug endpoint
const response = await fetch("http://localhost:3000/api/debug/verify-token", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ token }),
});
const result = await response.json();
console.log("Verification:", result);
```

### Issue 4: "Failed to fetch user data"

**Symptom:**

```json
{
	"error": "Failed to fetch user data",
	"code": "USER_FETCH_FAILED"
}
```

**Cause:** Token valid but can't fetch user from Clerk API

**Possible Issues:**

- Clerk API rate limit exceeded
- Network connectivity issue
- Invalid Clerk secret key

**Check backend logs** for detailed error message.

---

## 🔍 Step-by-Step Debugging

### Step 1: Verify Server is Running

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok",...}`

### Step 2: Test Without Auth (Dev Endpoint)

```bash
curl http://localhost:3000/api/dev/docs
```

Expected: `{"docs":[...],"count":...}`

### Step 3: Get Token from Frontend

```typescript
// In your frontend app
import { useAuth } from "@clerk/clerk-expo";

const { getToken, isSignedIn } = useAuth();

console.log("Is signed in:", isSignedIn);

const token = await getToken();
console.log("Token:", token ? "Got token ✅" : "No token ❌");
console.log("Token preview:", token?.substring(0, 50));
```

### Step 4: Test Token with Debug Endpoint

```typescript
// Frontend
const response = await fetch("http://localhost:3000/api/debug/auth", {
	headers: {
		Authorization: `Bearer ${token}`,
	},
});
const debug = await response.json();
console.log("Debug result:", debug);
```

### Step 5: Check Backend Logs

Watch the terminal where `npm run dev` is running. You'll see detailed logs:

```
[10:49:34] WARN: No authorization header provided
[10:49:34] ERROR: Clerk token verification failed: {
  error: "Invalid signature",
  tokenPreview: "eyJhbGciOiJSUzI1..."
}
```

### Step 6: Verify Clerk Configuration

**Frontend `.env`:**

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...  # Must match backend app
```

**Backend `.env`:**

```bash
CLERK_SECRET_KEY=sk_test_...                  # Must match frontend app
CLERK_PUBLISHABLE_KEY=pk_test_...             # Must match frontend app
```

⚠️ **Both must be from the SAME Clerk application!**

---

## 🎯 Quick Diagnostic Checklist

Run through this checklist:

- [ ] Backend server is running: `curl localhost:3000/health`
- [ ] Frontend is signed in: Check `isSignedIn === true`
- [ ] Frontend can get token: `const token = await getToken()`
- [ ] Token is not null/undefined
- [ ] Token is being sent in header: Check network tab
- [ ] Header format is correct: `Authorization: Bearer ...`
- [ ] Clerk keys match same application
- [ ] CLERK_SECRET_KEY is correct in backend `.env`

---

## 🔬 Advanced Debugging

### Check Token Claims

```typescript
// Decode JWT to see claims (without verifying)
function decodeJWT(token: string) {
	const parts = token.split(".");
	if (parts.length !== 3) return null;

	const payload = JSON.parse(atob(parts[1]));
	return payload;
}

const claims = decodeJWT(token);
console.log("Token claims:", {
	sub: claims.sub,
	exp: claims.exp,
	iss: claims.iss,
	expiresAt: new Date(claims.exp * 1000),
	isExpired: Date.now() > claims.exp * 1000,
});
```

### Test with curl

```bash
# Get token from frontend console, then:
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:3000/api/debug/auth
```

### Enable Verbose Logging

Backend already has detailed logging. Check the terminal for:

- Token preview
- Verification errors
- User bootstrap status

---

## ✅ Expected Flow

**Working authentication should show:**

```
[INFO] incoming request
  method: "GET"
  url: "/api/songs/search?q=Drake"

[DEBUG] Authentication successful
  clerkId: "user_123abc"
  userId: "65a1b2c3d4e5f6789"
  role: "singer"

[INFO] request completed
  statusCode: 200
  responseTime: 45ms
```

**Failed authentication shows:**

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
  responseTime: 30ms
```

---

## 🚀 Quick Fix Commands

```bash
# Kill old server and restart
lsof -ti:3000 | xargs kill -9
npm run dev

# Test health
curl localhost:3000/health

# Test debug endpoint (from frontend with token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  localhost:3000/api/debug/auth
```

---

## 📞 Still Having Issues?

1. **Check backend logs** - Look for detailed error messages
2. **Use debug endpoints** - `/api/debug/auth` shows exactly what's wrong
3. **Verify Clerk keys** - Must be from same application
4. **Test token validity** - POST to `/api/debug/verify-token`
5. **Check network** - Use browser DevTools network tab

**Post to logs/cursor.log** with:

- Error message
- Token preview (first 20 chars)
- Backend log output
- Frontend code snippet

Backend will help resolve! 🚀
