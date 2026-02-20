

# Fix: Forgot Password Flow + Wallet Balance Card Overflow

## Bug 1: Forgot Password Logs In Without Password Reset

### Root Cause
The `ForgotPasswordForm` sets `redirectTo: window.location.origin + '/auth'`. When the user clicks the reset link in their email, the auth system creates a session (recovery event) and redirects to `/auth`. But the `Auth` page (line 30-41) sees `user` is now set and immediately redirects to `/` -- the user is logged in without ever entering a new password. There is no `/reset-password` page in the app.

### Fix
1. **Create a new `/reset-password` page** (`src/pages/ResetPassword.tsx`) that:
   - Detects the `PASSWORD_RECOVERY` auth event
   - Shows a form with "New Password" and "Confirm Password" fields
   - Calls `supabase.auth.updateUser({ password })` to set the new password
   - Redirects to `/auth` on success with a toast message
   - Has password strength validation matching the signup form requirements

2. **Update `ForgotPasswordForm.tsx`** -- change the `redirectTo` from `/auth` to `/reset-password`:
   ```
   const redirectUrl = `${window.location.origin}/reset-password`;
   ```

3. **Add the route in `App.tsx`**:
   ```
   <Route path="/reset-password" element={<ResetPassword />} />
   ```

4. **Update `Auth.tsx`** -- skip auto-redirect when the URL contains a recovery token (type=recovery in hash), so users aren't bounced away before the recovery event fires.

---

## Bug 2: Wallet Balance Card Buttons Overflow on Small Screens

### Root Cause
The action buttons (Send, Buy, Withdraw) in `BalanceCard.tsx` use `flex gap-2` with each button having `flex-1`. On narrow screens, 3 buttons with icons + text don't fit, causing horizontal overflow.

### Fix
In `src/components/wallet/BalanceCard.tsx`, update the actions container (line 95):
- Add `flex-wrap` so buttons wrap to a second row on small screens
- Add `min-w-0` to the buttons to allow shrinking
- Alternatively, use a grid layout: `grid grid-cols-3 gap-2` with `text-xs` on small screens to ensure they always fit

---

## Technical Details

### New File: `src/pages/ResetPassword.tsx`
- Uses `supabase.auth.onAuthStateChange` to detect `PASSWORD_RECOVERY` event
- Shows a password input form with confirm field
- Enforces the same password rules as signup (8+ chars, uppercase, lowercase, number, special char)
- Calls `supabase.auth.updateUser({ password: newPassword })`
- On success, navigates to `/auth` with a success toast
- Public route (no auth guard)

### Modified Files
| File | Change |
|------|--------|
| `src/components/auth/ForgotPasswordForm.tsx` | Change `redirectTo` to `/reset-password` |
| `src/App.tsx` | Add `<Route path="/reset-password">` |
| `src/pages/Auth.tsx` | Skip redirect when URL hash contains `type=recovery` |
| `src/components/wallet/BalanceCard.tsx` | Change action buttons container to `grid grid-cols-3 gap-2` for consistent fit |

### Summary
- 1 new file (ResetPassword page)
- 4 existing files modified with small edits
- Fixes critical security issue where password reset bypasses password change
- Fixes UI overflow in wallet balance card on mobile
