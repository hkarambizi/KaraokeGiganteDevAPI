# Multi-Step Sign-Up Flow - Complete Implementation

## Overview

Comprehensive sign-up flow that handles **all required fields** (username, phone_number, email_address) regardless of which authentication method the user starts with.

## Required Fields

All users must have:

1. **Username** - Unique identifier
2. **Phone Number** - With SMS verification
3. **Email Address** - With email code verification (required for org invitations)

## Sign-Up Flows

### Flow 1: Google OAuth Sign-Up

```
User clicks "Continue with Google"
    ↓
Google OAuth completes
    ↓
Clerk returns: email verified, firstName, lastName
    ↓
Missing: username, phone_number
    ↓
Step 1: Collect username
    ↓
Step 2: Collect phone number
    ↓
Step 3: Verify phone (SMS code)
    ↓
Complete ✅
```

### Flow 2: Phone Number Sign-Up

```
User enters phone number
    ↓
Send SMS verification code
    ↓
User verifies phone
    ↓
Phone verified ✅
    ↓
Missing: username, email_address
    ↓
Step 1: Collect username
    ↓
Step 2: Collect email address
    ↓
Step 3: Verify email (email code)
    ↓
Complete ✅
```

### Flow 3: Email Sign-Up (if implemented)

```
User enters email address
    ↓
Send email verification code
    ↓
User verifies email
    ↓
Email verified ✅
    ↓
Missing: username, phone_number
    ↓
Step 1: Collect username
    ↓
Step 2: Collect phone number
    ↓
Step 3: Verify phone (SMS code)
    ↓
Complete ✅
```

## Implementation

### Core Components

#### 1. `RequiredFieldsFlow` Component

**Location:** `src/components/auth/RequiredFieldsFlow.tsx`

Intelligent multi-step form that:

- Detects missing and unverified fields from `SignUpResource`
- Dynamically renders appropriate input/verification steps
- Handles all Clerk API calls (update, prepare verification, attempt verification)
- Automatically progresses through steps
- Calls `onComplete()` when all fields are collected and verified

**Props:**

```typescript
{
  signUp: SignUpResource;        // Clerk sign-up object
  onComplete: () => void;         // Called when all fields complete
  onError?: (error: string) => void;  // Optional error handler
}
```

**Step Logic:**

1. Check `signUp.missingFields` and `signUp.unverifiedFields`
2. Determine current step based on what's missing
3. Render appropriate input or verification UI
4. On submit, call Clerk API and move to next step
5. Repeat until `missingFields` and `unverifiedFields` are empty

#### 2. `OAuthContext`

**Location:** `src/contexts/OAuthContext.tsx`

Persists the Clerk `SignUpResource` across screen navigation:

```typescript
{
  oauthSignUp: SignUpResource | null;
  setOAuthSignUp: (signUp: SignUpResource | null) => void;
  clearOAuthSignUp: () => void;
}
```

### Integration Points

#### Sign-In Screens

**Personal Auth** (`src/screens/auth/ClerkSignInScreen.tsx`):

- Uses `startSSOFlow({ strategy: 'oauth_google' })`
- If result has `signUp` with `missing_requirements`:
  - Stores in context AND local ref
  - Shows `RequiredFieldsFlow` inline
  - On complete, navigates to ProfileImage

**Org Auth** (`app/org-auth/sign-in.tsx`):

- Uses `startSSOFlow({ strategy: 'oauth_google' })`
- If result has `signUp` with `missing_requirements`:
  - Stores in context
  - Navigates to sign-up screen

#### Sign-Up Screens

**Org Auth** (`app/org-auth/sign-up.tsx`):

- On mount, checks for `contextOAuthSignUp`
- If found:
  - Pre-fills email, firstName, lastName
  - Renders `RequiredFieldsFlow` component
  - On complete, moves to organization creation step

## API Calls Sequence

### Example: Google OAuth → Missing username + phone

```typescript
// 1. OAuth completes
const result = await startSSOFlow({ strategy: "oauth_google" });
// result.signUp.status === 'missing_requirements'
// result.signUp.missingFields === ['username', 'phone_number']
// result.signUp.emailAddress === 'user@gmail.com' (verified)

// 2. Update username
await signUp.update({ username: "johndoe" });
// signUp.missingFields === ['phone_number']

// 3. Update phone and prepare verification
await signUp.update({ phoneNumber: "+15555551234" });
await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
// SMS sent

// 4. Verify phone
const result = await signUp.attemptPhoneNumberVerification({ code: "123456" });
// result.status === 'complete'
// result.createdSessionId === 'sess_abc123'

// 5. Activate session
await setActive({ session: result.createdSessionId });
// User is now signed in! ✅
```

## Error Handling

All steps include comprehensive error handling:

- Invalid username (already taken, invalid format)
- Invalid phone number (wrong format, already used)
- Invalid email (wrong format, already used)
- Verification code errors (expired, incorrect)
- Network errors

Errors are shown via `Alert.alert()` with user-friendly messages.

## Logging

Comprehensive logging with emoji indicators:

- 🔵 Blue: Info/progress
- 🟢 Green: Success/found
- 🟡 Yellow: Warnings/continuations
- ✅ Green check: Complete
- ❌ Red X: Errors

Example:

```
🔵 [RequiredFields] Determining step
🔵 [RequiredFields] Missing: ["username", "phone_number"]
🟢 [RequiredFields] Updating username: johndoe
🟢 [RequiredFields] Updating phone: +15555551234
✅ [RequiredFields] SMS sent
🟢 [RequiredFields] Verifying phone code
✅ [Admin Sign-Up] Required fields complete
```

## Benefits

1. **Flexible**: Works with any starting method (Google, phone, email)
2. **Complete**: Ensures all required fields are collected and verified
3. **User-Friendly**: Clear step-by-step progression
4. **Reusable**: `RequiredFieldsFlow` component works anywhere
5. **Type-Safe**: Full TypeScript support
6. **Debuggable**: Comprehensive logging at every step

## Testing Scenarios

### Scenario 1: Google OAuth (New User)

- [ ] Click "Continue with Google"
- [ ] Complete Google auth
- [ ] See username input
- [ ] Enter username, click Continue
- [ ] See phone number input
- [ ] Enter phone, click Send Code
- [ ] Receive SMS
- [ ] Enter code, click Verify
- [ ] Sign-up completes
- [ ] Navigate to next screen

### Scenario 2: Phone Number Sign-Up

- [ ] Enter phone number
- [ ] Receive SMS, verify
- [ ] See username input
- [ ] Enter username, click Continue
- [ ] See email input
- [ ] Enter email, click Send Code
- [ ] Receive email code
- [ ] Enter code, click Verify
- [ ] Sign-up completes

### Scenario 3: Google OAuth (Existing User)

- [ ] Click "Continue with Google"
- [ ] Complete Google auth
- [ ] Session created immediately
- [ ] Navigate to main app
- [ ] No additional steps needed

---

**Status:** ✅ Implemented
**Date:** 2025-10-08
**Migration:** useOAuth() → useSSO()
**Files:**

- `src/components/auth/RequiredFieldsFlow.tsx` (new)
- `src/hooks/useSignUpFlow.ts` (new)
- `src/contexts/OAuthContext.tsx` (new)
- `app/_layout.tsx` (updated)
- `src/screens/auth/ClerkSignInScreen.tsx` (updated)
- `app/org-auth/sign-in.tsx` (updated)
- `app/org-auth/sign-up.tsx` (updated)
