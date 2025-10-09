# 🔐 Auth Flow Changes - CRITICAL UPDATE

## 🚨 Important: Authentication System Redesigned

The Clerk authentication configuration has been updated. All auth flows now use:

- **Google OAuth** (One Tap)
- **Phone with SMS verification**
- **Email with code verification**
- **NO MORE PASSWORDS** ❌

---

## ✅ What Changed

### Old Flow (Deprecated)

```
Sign Up: Email + Password
Sign In: Email + Password
```

### New Flow (Current)

```
Sign Up Step 1: Google OAuth OR Phone Number (REQUIRED)
Sign Up Step 2: SMS verification (if phone)
Sign Up Step 3: Username* + First Name* + Last Name* + Email + Photo

Sign In: Google OR Phone OR Email (all with codes, no passwords)
```

---

## 📋 New Clerk Configuration

### Sign Up Requirements

**REQUIRED:**

- Username (new requirement!)
- First Name
- Last Name
- Phone Number OR Google OAuth

**OPTIONAL:**

- Email (if not from Google)
- Profile photo

### Sign In Options

1. **Google One Tap** - Preferred method
2. **Phone** - SMS code verification
3. **Email** - Email code verification
4. **Passkey** - Enabled (future)

### Important Fields

**Username:**

- Now REQUIRED for all users
- Must be unique
- Collected in profile completion step
- Backend must store in User model

**Phone Number:**

- REQUIRED if not using Google OAuth
- Used for verification
- Stored in Clerk and User model

---

## 🎯 Implementation Details

### Singer Sign Up (personal-auth/sign-up.tsx)

**Step 1: Method Selection**

```typescript
- Google OAuth button
- Phone number button
```

**Step 2: Verification (if phone)**

```typescript
- Enter phone number
- Receive SMS code
- Verify code
```

**Step 3: Profile Completion**

```typescript
- Photo upload (optional)
- Username* (REQUIRED - NEW!)
- First Name*
- Last Name*
- Email (if not from OAuth)
```

### Singer Sign In (personal-auth/sign-in.tsx)

**Method Selection:**

```typescript
- Google One Tap
- Phone (SMS code)
- Email (email code)
```

**Verification Flow:**

```typescript
1. User selects method
2. Enters identifier (email or phone)
3. Receives code
4. Verifies code
5. Signed in ✅
```

### Admin Flows (org-auth/\*)

**Same as singer flows PLUS:**

**Step 4: Organization Creation**

```typescript
- Organization name input
- Calls: POST /api/orgs
- Backend creates Clerk org
- Backend sets user role = 'admin'
```

---

## 🔧 Backend Changes Required

### 1. User Model Updates

**Add username field:**

```typescript
{
  _id: ObjectId,
  clerkId: string,
  username: string,  // ← NEW REQUIRED FIELD
  email?: string,    // ← Now optional
  phoneNumber?: string,  // ← May be present
  firstName: string,
  lastName: string,
  // ... rest
}
```

### 2. Validation Updates

**On POST /api/users/me (bootstrap):**

```javascript
// Username is now required
if (!user.username) {
	return res.status(400).json({
		error: "Username is required",
		code: "MISSING_USERNAME",
	});
}

// Email is now optional
// Phone may or may not be present
```

### 3. Clerk JWT Changes

**JWT token now includes:**

```json
{
	"sub": "user_123",
	"username": "johndoe", // ← NEW
	"phone_number": "+15551234567", // ← May be present
	"email": "user@example.com" // ← May be missing
	// ...
}
```

### 4. OAuth Users

**Users who sign up with Google:**

- Have email from Google
- DON'T have phone (unless added later)
- MUST provide username during signup
- May have photo from Google

**Backend must handle:**

```javascript
// User from Google OAuth
{
  clerkId: "user_google123",
  username: "johndoe",  // User provided
  email: "john@gmail.com",  // From Google
  phoneNumber: null,  // Not from OAuth
  firstName: "John",  // From Google or user
  lastName: "Doe",  // From Google or user
  avatar: "https://lh3.googleusercontent.com/...",  // From Google
  role: "singer"
}
```

---

## 📱 Frontend Changes Made

### New Dependencies

```json
"expo-auth-session": "~7.0.8",  // For OAuth
"expo-crypto": "~15.0.1",        // For OAuth
"expo-web-browser": "~15.0.8"    // Already had it
```

### Updated Screens

**personal-auth/sign-in.tsx:**

- ✅ Google One Tap button
- ✅ Phone/Email method selection
- ✅ Code verification (no password)
- ✅ Multi-step UI

**personal-auth/sign-up.tsx:**

- ✅ Google OAuth OR Phone
- ✅ SMS verification
- ✅ Profile completion (username required!)
- ✅ Photo upload
- ✅ Multi-step flow

**org-auth/sign-in.tsx:**

- ✅ Same as personal-auth
- ✅ Lime theme for admin

**org-auth/sign-up.tsx:**

- ✅ Same as personal-auth
- ✅ PLUS organization creation step
- ✅ Calls POST /api/orgs after profile

### New Features

- Google One Tap integration
- Phone SMS verification
- Username collection (required)
- Profile photo upload
- Multi-step sign-up flow
- No more passwords!

---

## 🧪 Testing Checklist

### Singer Sign Up

- [ ] Google OAuth works
- [ ] Phone SMS verification works
- [ ] Username field is required
- [ ] Profile completion succeeds
- [ ] User created in backend with username

### Singer Sign In

- [ ] Google sign in works
- [ ] Phone code sign in works
- [ ] Email code sign in works
- [ ] No password option present

### Admin Sign Up

- [ ] Google OAuth works
- [ ] Phone verification works
- [ ] Profile completion works
- [ ] Organization creation succeeds
- [ ] User role set to 'admin'
- [ ] Username stored in backend

### Admin Sign In

- [ ] All methods work
- [ ] Redirects to admin portal
- [ ] Role verified

---

## ⚠️ Breaking Changes for Backend

### 1. Username Now Required

**Before:**

```javascript
// Username was optional
const user = { firstName, lastName, email };
```

**After:**

```javascript
// Username is REQUIRED
const user = { username, firstName, lastName };
// Email is optional
// Phone may or may not be present
```

### 2. Email May Be Missing

Users who sign up with phone-only won't have email initially.

**Backend must handle:**

```javascript
// Valid user without email
{
  username: "johndoe",
  phoneNumber: "+15551234567",
  email: null  // ← This is OK now!
}
```

### 3. Sign In Methods Changed

**Before:**

- Email + Password

**After:**

- Google OAuth (no backend verification needed - Clerk handles it)
- Phone + SMS Code
- Email + Email Code

**Backend auth middleware:**

- Still validates Clerk JWT tokens
- No changes needed to JWT validation
- Clerk handles all verification

---

## 📊 User Data Flow

### Google OAuth Sign Up

```
1. User clicks "Continue with Google"
2. Google authentication (handled by Clerk)
3. Clerk creates user with email, name, photo
4. Frontend: Profile completion screen
   - Username* (user enters)
   - First/Last name (pre-filled from Google)
   - Email (pre-filled from Google)
   - Photo (optional, can use Google's)
5. Frontend updates Clerk user
6. Frontend calls POST /api/users/me (bootstrap)
7. Backend creates MongoDB user with username
```

### Phone Sign Up

```
1. User enters phone number
2. SMS code sent
3. User verifies code
4. Frontend: Profile completion screen
   - Username* (user enters)
   - First Name* (user enters)
   - Last Name* (user enters)
   - Email (optional)
   - Photo (optional)
5. Frontend updates Clerk user
6. Frontend calls POST /api/users/me (bootstrap)
7. Backend creates MongoDB user with username + phone
```

---

## 🔧 Backend API Updates Needed

### GET /api/users/me

**Update response to include username:**

```json
{
  "_id": "user-id",
  "clerkId": "user_123",
  "username": "johndoe",  // ← NOW REQUIRED
  "email": "user@example.com",  // ← May be null
  "phoneNumber": "+15551234567",  // ← May be null
  "firstName": "John",
  "lastName": "Doe",
  "displayName": "John Doe",
  "avatar": "url",
  "role": "singer" | "admin"
}
```

### POST /api/users/me (Bootstrap)

**Update to handle username:**

```javascript
// Extract from Clerk JWT
const {
	sub: clerkId,
	username, // ← NEW
	email,
	phone_number: phoneNumber,
	first_name: firstName,
	last_name: lastName,
	image_url: avatar,
} = decodedToken;

// Validate username exists
if (!username) {
	return res.status(400).json({
		error: "Username is required",
		code: "MISSING_USERNAME",
	});
}

// Create or update user
const user = await User.findOneAndUpdate(
	{ clerkId },
	{
		username, // ← Store username
		email: email || null,
		phoneNumber: phoneNumber || null,
		firstName,
		lastName,
		displayName: `${firstName} ${lastName}`,
		avatar,
		role: role || "singer",
	},
	{ upsert: true, new: true }
);
```

### GET /api/users/search

**Update to search by username too:**

```javascript
// Search by username, displayName, firstName, lastName, or email
User.find({
	$or: [
		{ username: new RegExp(query, "i") }, // ← NEW
		{ displayName: new RegExp(query, "i") },
		{ firstName: new RegExp(query, "i") },
		{ lastName: new RegExp(query, "i") },
		{ email: new RegExp(query, "i") },
	],
}).limit(20);
```

---

## 📝 Migration Notes

### Existing Users

**Users created before this change:**

- Have email + password
- DON'T have username ❌

**Migration needed:**

```javascript
// One-time migration script
User.updateMany(
	{ username: { $exists: false } },
	{ $set: { username: generateUsernameFromEmail() } }
);
```

**Or prompt users:**

```javascript
// On first login after update
if (!user.username) {
	// Show modal: "Please set a username"
	// User enters username
	// Update Clerk + MongoDB
}
```

---

## 🎯 Frontend Files Updated

1. ✅ `app/personal-auth/sign-in.tsx` - Google/Phone/Email sign in
2. ✅ `app/personal-auth/sign-up.tsx` - Multi-step signup with username
3. ✅ `app/org-auth/sign-in.tsx` - Admin sign in with OAuth
4. ✅ `app/org-auth/sign-up.tsx` - Admin signup + org creation
5. ✅ `package.json` - Added expo-crypto dependency

---

## 🚀 Ready to Test

**Start Expo:**

```bash
npx expo start -c
```

**Test Flows:**

1. Singer Sign Up with Google
2. Singer Sign Up with Phone
3. Singer Sign In with each method
4. Admin Sign Up with Google + Org creation
5. Admin Sign Up with Phone + Org creation
6. Admin Sign In

**Expected Results:**

- ✅ Google OAuth opens browser
- ✅ Phone receives SMS code
- ✅ Username is required
- ✅ Profile completion works
- ✅ Organization creation succeeds

---

## 📞 Backend Action Required

1. **Update User model** - Add username field (required)
2. **Update bootstrap endpoint** - Handle username from JWT
3. **Update search** - Include username in search
4. **Migration** - Handle existing users without username
5. **Test OAuth flow** - Verify Google users work
6. **Test phone flow** - Verify SMS users work

---

**Last Updated:** Just now
**Frontend Agent:** Claude (Cursor)
**Status:** ✅ Auth flows updated and ready to test
**Next:** Backend must update User model and endpoints
