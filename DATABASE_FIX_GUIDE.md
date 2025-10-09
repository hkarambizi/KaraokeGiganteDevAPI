# Database Connection Issue - Fix Guide

## 🔍 Problem Analysis

### What's Happening

Your server logs show this error:

```
ERROR: Failed to fetch user from Clerk
error: "E11000 duplicate key error collection: karaoke-gigante.users index: clerkUserId_1 dup key: { clerkUserId: null }"
```

The error references database: **`karaoke-gigante`**
But your MONGO_URI points to: **`karaoke-gigante-dev`**

### Root Cause

There are TWO separate databases on your MongoDB Atlas cluster:

1. **`karaoke-gigante-dev`** ← Your .env MONGO_URI (✅ clean, no old indexes)
2. **`karaoke-gigante`** ← Production database (❌ has old `clerkUserId_1` index)

The server is somehow connecting to the **production** database instead of **dev**.

---

## ✅ Solution

### Step 1: Verify Your .env File

Check your `.env` file and make sure the MONGO_URI is correct:

```bash
cat .env | grep MONGO_URI
```

**Expected:**

```
MONGO_URI=mongodb+srv://...@ci-karaokegigante-clust.8gw4qkr.mongodb.net/karaoke-gigante-dev?...
```

**Make sure it says `karaoke-gigante-dev`, NOT `karaoke-gigante`**

### Step 2: Restart the Server

After verifying the .env file:

```bash
# Kill any running server
lsof -ti:3000 | xargs kill -9

# Wait a moment
sleep 2

# Start fresh
npm run dev
```

### Step 3: Test with the Frontend

Try the request again from your frontend. The error should be gone!

---

## 🔧 If You Need to Use the Production Database

If you want to use the `karaoke-gigante` database (production) instead of dev, you'll need to:

### Option A: Fix the Production Database Indexes

1. **Update MONGO_URI in .env** to point to `karaoke-gigante`:

   ```
   MONGO_URI=mongodb+srv://...@...mongodb.net/karaoke-gigante?...
   ```

2. **Run the fix script** (it will drop the old index):

   ```bash
   npm run fix-indexes
   ```

3. **Restart the server**:
   ```bash
   npm run dev
   ```

### Option B: Clean Start with Dev Database (Recommended)

Keep using `karaoke-gigante-dev` (current .env setting):

- ✅ Clean database
- ✅ Correct indexes
- ✅ No migration needed
- ✅ Ready to use!

---

## 📊 What We Fixed

### Code Changes

1. **database.ts** - Removed localhost conditional

   - Before: Used localhost in development
   - After: Always uses MONGO_URI from .env

2. **Migration Script** - Created `scripts/fix-user-indexes.ts`

   - Checks for old `clerkUserId_1` index
   - Drops it if found
   - Creates correct `clerkId_1` and `username_1` indexes

3. **User Model** - Already correct!
   - ✅ `clerkId` field (unique, indexed)
   - ✅ `username` field (unique, indexed)
   - ✅ `email` field (optional, sparse index)

### Database State

**karaoke-gigante-dev** (your current .env):

```
✅ Clean, empty database
✅ No collections yet
✅ Will auto-create with correct indexes
✅ Ready for first user sign-in
```

**karaoke-gigante** (production):

```
❌ Has old clerkUserId_1 index
❌ Needs migration if you want to use it
⚠️ Not recommended for development
```

---

## 🧪 Testing

### Test 1: Check Database Connection

```bash
# See what database the server connects to
npm run dev

# Look for this line in output:
# ✅ MongoDB connected successfully
```

### Test 2: Sign In from Frontend

1. Start your frontend app
2. Sign in with your Clerk account
3. Make a request to `/api/events/active`

**Expected:** Success! User bootstrapped, no errors

**If you still see the error:**

- Check .env file has correct MONGO_URI
- Make sure database name ends with `-dev`
- Restart the server completely

### Test 3: Verify Token

Use the debug endpoint:

```bash
curl -X POST http://localhost:3000/api/debug/verify-token \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_JWT_TOKEN_HERE"}'
```

Should return:

```json
{
	"valid": true,
	"userId": "user_...",
	"message": "Token is valid"
}
```

---

## 🐛 Still Having Issues?

### Check These:

1. **Environment Variables**

   ```bash
   npm run dev 2>&1 | grep MONGO_URI
   ```

   Should show `karaoke-gigante-dev` in the connection string

2. **Mongoose Connection**
   Add this to `src/config/database.ts` after line 8:

   ```typescript
   console.log("📊 Connected to database:", mongoose.connection.name);
   ```

3. **Clear All Data** (nuclear option)
   ```bash
   # Delete all users from dev database
   # (Be careful - this deletes data!)
   ```

---

## ✅ Success Criteria

You'll know everything is working when:

1. ✅ Server starts without errors
2. ✅ First user sign-in succeeds
3. ✅ User is bootstrapped in MongoDB
4. ✅ No duplicate key errors
5. ✅ `/api/events/active` returns 200 or empty array
6. ✅ `/api/users/me` returns user data

---

## 📞 Quick Commands

```bash
# Check .env database name
cat .env | grep MONGO_URI

# Fix production database indexes (if needed)
npm run fix-indexes

# Restart server cleanly
lsof -ti:3000 | xargs kill -9 && sleep 2 && npm run dev

# Test authentication
curl -X GET http://localhost:3000/api/debug/auth \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**Status:** ✅ Dev database is clean and ready!
**Action:** Verify .env points to `karaoke-gigante-dev` and restart server
**Next:** Test sign-in from frontend
