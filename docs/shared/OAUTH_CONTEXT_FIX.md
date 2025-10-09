# OAuth/SSO Context Fix - Persisting Sign-Up State

## Migration to useSSO()

**Important:** Migrated from deprecated `useOAuth()` to the newer `useSSO()` hook as recommended by Clerk.

### Changes:

- `useOAuth({ strategy: 'oauth_google' })` → `useSSO()`
- `startOAuthFlow()` → `startSSOFlow({ strategy: 'oauth_google' })`
- Same return type and behavior, but using the supported API

## Problem

When users signed in with Google SSO and their account didn't exist, Clerk returned a `signUp` object with `status: 'missing_requirements'` and `missingFields: ["phone_number", "username"]`.

The issue was that when we navigated from the sign-in screen to the sign-up screen, we lost the SSO `signUp` object, causing the sign-up flow to restart from scratch instead of continuing with the OAuth-authenticated user.

## Solution

Created a React Context to persist the OAuth `signUp` object across screen navigation.

### Implementation

#### 1. OAuthContext (`src/contexts/OAuthContext.tsx`)

```typescript
interface OAuthContextType {
	oauthSignUp: SignUpResource | null;
	setOAuthSignUp: (signUp: SignUpResource | null) => void;
	clearOAuthSignUp: () => void;
}
```

Provides:

- `oauthSignUp` - The Clerk SignUpResource from OAuth flow
- `setOAuthSignUp()` - Store the OAuth signUp object
- `clearOAuthSignUp()` - Clear after completion

#### 2. Root Layout (`app/_layout.tsx`)

Wrapped the app with `<OAuthProvider>` inside `ClerkProvider`:

```tsx
<ClerkProvider>
	<OAuthProvider>
		<Provider store={store}>{/* ... */}</Provider>
	</OAuthProvider>
</ClerkProvider>
```

#### 3. Sign-In Screens

**Personal Auth** (`src/screens/auth/ClerkSignInScreen.tsx`):

- Stores OAuth signUp in context when `missing_requirements` detected
- Shows inline form for username/phone collection
- Also stores in local ref for inline completion

**Org Auth** (`app/org-auth/sign-in.tsx`):

- Stores OAuth signUp in context when `missing_requirements` detected
- Navigates to sign-up screen
- Sign-up screen picks up the OAuth object from context

#### 4. Sign-Up Screens

**Org Auth** (`app/org-auth/sign-up.tsx`):

- Checks for `contextOAuthSignUp` on mount
- Pre-fills email, firstName, lastName from OAuth
- Uses the OAuth signUp object for `update()` and verification calls
- Skips method selection, goes straight to profile step
- Clears context after successful verification

### Flow Diagram

```
Sign-In Screen (Google SSO)
    ↓
Call startSSOFlow({ strategy: 'oauth_google' })
    ↓
SSO returns: signUp with missing_requirements
    ↓
Store signUp in OAuthContext
    ↓
Navigate to Sign-Up Screen
    ↓
Sign-Up Screen detects contextOAuthSignUp
    ↓
Pre-fill fields from SSO (email, firstName, lastName)
    ↓
Show username/phone input (profile step)
    ↓
User enters username + phone
    ↓
Call signUpToUse.update({ username, phoneNumber })
    ↓
Call signUpToUse.preparePhoneNumberVerification()
    ↓
User enters SMS code
    ↓
Call signUpToUse.attemptPhoneNumberVerification({ code })
    ↓
Activate session
    ↓
Clear OAuth context
    ↓
Navigate to organization creation
```

## Benefits

1. **No Data Loss**: OAuth authentication state persists across navigation
2. **Seamless UX**: User doesn't have to re-authenticate
3. **Pre-filled Data**: Email, first name, last name from Google are preserved
4. **Type Safety**: Uses Clerk's `SignUpResource` type
5. **Clean Architecture**: Separation of concerns with context

## Debugging

Added comprehensive logging with emoji indicators:

- 🔵 Blue: Info/progress
- 🟢 Green: Success/found
- 🟡 Yellow: Warnings/continuations
- ✅ Green check: Complete
- ❌ Red X: Errors

Example logs:

```
🔵 [Admin] Starting Google OAuth flow...
🔵 [Admin] OAuth flow completed
🔵 [Admin] OAuth signUp status: missing_requirements
🔵 [Admin] OAuth signUp missing fields: ["phone_number", "username"]
🟡 [Admin] Sign-up missing requirements: ["phone_number", "username"]
✅ [Admin] Stored OAuth signUp in context, navigating to sign-up
🟢 [Admin Sign-Up] Found OAuth signUp in context
🟢 [Admin Sign-Up] Status: missing_requirements
🟢 [Admin Sign-Up] Missing fields: ["phone_number", "username"]
```

## Testing

1. Start fresh (no existing account)
2. Click "Continue with Google" on sign-in screen
3. Complete Google OAuth
4. Should see: "Please complete your profile to continue"
5. Navigate to sign-up screen
6. Should auto-skip to profile step with email/name pre-filled
7. Enter username and phone number
8. Verify phone with SMS code
9. Complete organization creation
10. Successfully signed in!

---

**Status:** ✅ Implemented
**Date:** 2025-10-08
**Files Changed:** 5

- `src/contexts/OAuthContext.tsx` (new)
- `app/_layout.tsx`
- `app/org-auth/sign-in.tsx`
- `app/org-auth/sign-up.tsx`
- `src/screens/auth/ClerkSignInScreen.tsx`
