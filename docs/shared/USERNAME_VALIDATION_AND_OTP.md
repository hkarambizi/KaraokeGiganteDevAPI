# Username Validation & OTP Input Components

## Overview

Two new components to enhance the sign-up experience:

1. **Real-time username availability checking** with visual feedback
2. **Beautiful 6-digit OTP input** for verification codes

---

## 1. Username Validation

### `useUsernameValidation` Hook

**Location:** `src/hooks/useUsernameValidation.ts`

Real-time username availability checking using Clerk's API.

#### Features:

- ✅ Debounced validation (500ms default)
- ✅ Checks username availability via Clerk
- ✅ Shows loading state while checking
- ✅ Returns validation result with error message
- ✅ Only validates usernames 3+ characters

#### Usage:

```typescript
import { useUsernameValidation } from "../../hooks/useUsernameValidation";

const MyComponent = ({ signUp }) => {
	const [username, setUsername] = useState("");
	const validation = useUsernameValidation(signUp, username);

	return (
		<>
			<Input
				value={username}
				onChangeText={setUsername}
				error={validation.error}
			/>

			{validation.isChecking && <Text>Checking availability...</Text>}

			{validation.isValid === true && (
				<Text style={{ color: "green" }}>✓ Username available!</Text>
			)}

			<Button
				disabled={validation.isValid !== true || validation.isChecking}
				onPress={handleSubmit}
			/>
		</>
	);
};
```

#### Return Value:

```typescript
{
	isValid: boolean | null; // true = available, false = taken, null = not checked
	isChecking: boolean; // true while API call in progress
	error: string | null; // Error message if username invalid/taken
}
```

#### How It Works:

1. User types username
2. Hook waits 500ms after last keystroke (debounce)
3. Calls `signUp.update({ username })` to check availability
4. If successful → username available ✅
5. If error with username param → username taken or invalid ❌
6. Updates validation state with result

---

## 2. OTP Input Component

### `OTPInput` Component

**Location:** `src/components/ui/OTPInput/OTPInput.tsx`

Beautiful 6-digit verification code input with individual boxes.

#### Features:

- ✅ 6 individual digit boxes (configurable length)
- ✅ Auto-focus next box on digit entry
- ✅ Auto-focus previous box on backspace
- ✅ Paste support (fills all boxes)
- ✅ Neumorphic design matching app theme
- ✅ Focus state with enhanced shadow
- ✅ Error state with red border
- ✅ Filled state with highlight color
- ✅ iOS one-time code autofill support

#### Usage:

```typescript
import { OTPInput } from "../ui/OTPInput";

const MyComponent = () => {
	const [code, setCode] = useState("");

	return (
		<OTPInput
			value={code}
			onChange={setCode}
			length={6}
			error={errorMessage}
			disabled={loading}
		/>
	);
};
```

#### Props:

```typescript
{
  value: string;              // Current OTP value (e.g., "123456")
  onChange: (otp: string) => void;  // Called when OTP changes
  length?: number;            // Number of digits (default: 6)
  error?: string;             // Error message to display
  disabled?: boolean;         // Disable input
}
```

#### Visual Design:

```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  6  │
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘
```

**States:**

- **Empty**: Light gray border, white background
- **Focused**: Purple border, subtle purple background, enhanced shadow
- **Filled**: Purple border, light purple background
- **Error**: Red border, light red background

#### Behavior:

1. **Typing**: Each digit auto-advances to next box
2. **Backspace**: Clears current digit, moves to previous box
3. **Paste**: Fills all boxes with pasted digits (up to length)
4. **Tap**: Focus specific box for editing
5. **Auto-complete**: iOS suggests code from SMS

---

## Integration in RequiredFieldsFlow

Both components are integrated into `RequiredFieldsFlow`:

### Username Step:

```typescript
<Input
	label="Username"
	value={username}
	onChangeText={setUsername}
	error={usernameValidation.error}
/>;

{
	usernameValidation.isChecking && (
		<View>
			<ActivityIndicator />
			<Text>Checking availability...</Text>
		</View>
	);
}

{
	usernameValidation.isValid === true && (
		<View>
			<Ionicons name="checkmark-circle" color="green" />
			<Text>Username available!</Text>
		</View>
	);
}

<Button
	disabled={
		!username.trim() ||
		usernameValidation.isValid === false ||
		usernameValidation.isChecking
	}
/>;
```

### Verification Steps:

```typescript
// Phone verification
<OTPInput
  value={phoneCode}
  onChange={setPhoneCode}
  length={6}
/>

// Email verification
<OTPInput
  value={emailCode}
  onChange={setEmailCode}
  length={6}
/>
```

---

## User Experience

### Username Input:

1. User types "john"
2. Shows: "Checking availability..." (spinner)
3. After 500ms: "✓ Username available!" (green checkmark)
4. Continue button enabled

If username taken:

1. User types "admin"
2. Shows: "Checking availability..." (spinner)
3. After 500ms: "Username is already taken" (red text under input)
4. Continue button disabled

### OTP Input:

1. User receives SMS: "Your code is 123456"
2. Taps first box
3. Types "1" → auto-advances to box 2
4. Types "2" → auto-advances to box 3
5. Continues until all 6 digits entered
6. Last digit entered → keyboard dismisses
7. Verify button enabled

Or with paste:

1. User copies "123456" from SMS
2. Taps any OTP box
3. Pastes → all 6 boxes fill instantly
4. Verify button enabled

---

## Styling

### OTP Input Design:

- **Box size**: 56x56px (1:1 aspect ratio)
- **Border radius**: 12px (neumorphic)
- **Font size**: 24px bold
- **Spacing**: 8px gap between boxes
- **Colors**:
  - Default border: `subtleText` at 40% opacity
  - Focused border: `highlight` (purple/lime)
  - Filled background: `highlight` at 10% opacity
  - Error border: `#FF4444`

### Username Validation Feedback:

- **Checking**: Spinner + gray text
- **Available**: Green checkmark + green text
- **Taken**: Red text under input field

---

## Performance

### Username Validation:

- **Debounced**: Only checks 500ms after user stops typing
- **Cancellable**: Previous check cancelled if user types again
- **Efficient**: Single API call per validation

### OTP Input:

- **Native performance**: Uses native TextInput components
- **No re-renders**: Optimized state updates
- **Smooth animations**: CSS transitions for focus states

---

## Accessibility

### OTP Input:

- `textContentType="oneTimeCode"` - iOS autofill support
- `autoComplete="sms-otp"` - Android autofill support
- `keyboardType="number-pad"` - Numeric keyboard
- Touch targets: 56x56px (meets accessibility guidelines)

### Username Input:

- Clear error messages
- Visual feedback (color + icon)
- Loading state indication

---

## Testing

### Username Validation:

- [ ] Type short username (< 3 chars) - no validation
- [ ] Type valid username - shows "available"
- [ ] Type taken username - shows error
- [ ] Type quickly - only validates after 500ms pause
- [ ] Change username while checking - cancels previous check

### OTP Input:

- [ ] Type 6 digits - auto-advances through boxes
- [ ] Press backspace - moves to previous box
- [ ] Paste 6-digit code - fills all boxes
- [ ] Tap specific box - focuses that box
- [ ] Submit with incomplete code - button disabled
- [ ] iOS: Code autofill from SMS works

---

**Status:** ✅ Implemented
**Date:** 2025-10-08
**Files:**

- `src/hooks/useUsernameValidation.ts` (new)
- `src/components/ui/OTPInput/OTPInput.tsx` (new)
- `src/components/ui/OTPInput/index.ts` (new)
- `src/components/auth/RequiredFieldsFlow.tsx` (updated)
- `src/components/ui/index.ts` (updated)
