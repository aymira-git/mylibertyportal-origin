# Staff Invitation System Modernization — Implementation Plan (revised after audit)

This plan covers the upgrade of the **Invites** system in `src/features/staff/InvitesPanel.jsx`, `src/features/staff/invitesRepository.js`, `src/features/auth/StaffSignup.jsx`, plus the wiring in `useDashboardData.js`, `AdminDashboard.jsx` and `firestore.rules`.

> **A note on how to read this.** The audit below was done by Claude (an AI) by reading the uploaded zip. It can be wrong or incomplete. Executing agent: please check each finding against the real code before acting on it, and push back or counter-propose wherever you see a better route. Kifry's stances are written as "current stance + reason" so they can be discussed too. Everyone here (auditor, executing agent, Kifry) is expected to double-check each other.

---

## Audit Notes

Checked against the zip: `invitesRepository.js`, `InvitesPanel.jsx`, `StaffSignup.jsx`, `authRepository.js`, `useDashboardData.js`, `AdminDashboard.jsx`, `staffUtils.js`, `shared/index.js`, `firestore.rules`.

**Looks consistent with the code:** token lookup by document id, `users` already passed into `AdminDashboard`, `STANDARD_BRANCHES` / `getDistinctStaffBranches` exist in `staffUtils.js`, `useConfirm` and `useToast` are exported from `shared`, and `completeStaffSignup` already writes the profile and deletes the invite in one batch (so manual check 4 should pass as-is).

**Findings worth a second look**

1. **Expiry is only enforced in the browser.** `firestore.rules` lets anyone `get` an invite, and the `users` create rule checks invite email + role only. An expired link would still work for anyone calling Firebase directly. `firestore.rules` was not in the original file list. Suggested handling: add an expiry check to the `users` create rule and list the rules file as a modified file. Kifry has no coding experience, so the agent could include copy-paste steps for publishing rules (Firebase Console → Firestore → Rules, or `firebase deploy --only firestore:rules`).
   - Untested sketch, for the agent to verify or replace:
     ```
     function inviteStillValid(inviteId) {
       let inv = get(/databases/$(database)/documents/invites/$(inviteId)).data;
       return inv.get('expiresAt', null) == null
           || inv.expiresAt > request.time.toMillis();
     }
     ```
     It tolerates legacy invites without `expiresAt`, matching the backward-compatibility goal.
2. **`expiresAt` type needs a choice.** `createdAt` is an ISO string today, while `now + 7*24*60*60*1000` produces a millisecond number. Rules can compare a number to `request.time.toMillis()` easily; an ISO string is harder. Suggested: store `expiresAt` as milliseconds and keep the client check consistent with it. Open to a different approach.
3. **The delete confirmation already exists.** `handleDeleteInvite` in `useDashboardData.js` already calls `confirm("Cancel this invitation?")`. Wrapping the panel's button in another dialog would ask twice. The original "Delete Confirmation Guard" item is therefore dropped; improving that existing prompt's wording (e.g. naming the email) is a small optional touch.
4. **Create failures look like successes in the panel.** `handleCreateInvite` catches errors and shows a toast, and `InvitesPanel` then clears the email field regardless. Suggested: have `handleCreateInvite` return true/false so the panel keeps the typed email when creation fails. This also helps the duplicate-warning flow.
5. **`status: "active"` is tidy, not a bug fix.** `staffUtils.js` already treats a missing status as active (`u.status || "active"`). Writing it explicitly is still reasonable and makes the data self-describing; the reason in the plan is reworded accordingly.
6. **Trimming and validation.** The nickname input already has the `required` attribute, so the `nickname || firstName` fallback rarely triggers. A whitespace-only value passes `required`, and after trimming it becomes an empty string. Suggested: validate after trimming (first name, last name, phone) and show a friendly message.
7. **Duplicate-email warning has a blind spot.** It reads the `users` collection. Someone deleted from Firestore may still exist in Firebase Auth, and the existing `auth/email-already-in-use` message at signup already covers that case. The warning is a helpful early hint, and it may be worth noting in a code comment that it does not see Auth. For a duplicate *pending invite*, whether to warn only, or offer "replace the old invite", is left to the agent.
8. **Language mix.** The WhatsApp text is Indonesian, while the signup page and the expiry message are English. Kifry to confirm which language staff read best; a bilingual message is one option.
9. **Row crowding on mobile.** Copy Link + Copy WhatsApp text + Share via WhatsApp + Delete is four actions per row. Options: one primary "Share" with a small menu, or icon buttons. Agent's call.
10. **Renewing an expired invite.** The current `invites` update rule only allows `used`, `usedAt`, `usedBy`, so extending an invite would need a rules change. For now, delete + regenerate is the simple path; a "Renew" action is an optional idea for later.
11. **Noticed while reading (for the agent's judgment, no action requested):** the `invites` update rule is `if true` for the `used` fields, so anyone who knows a token could flip it. The token is a random UUID so risk looks low, but tightening it could be considered while the rules file is open anyway.

---

## Current Stance (open to challenge)

- **School name in messages:** WhatsApp text uses **"MYLIBERTY International English School"**. Reason: Kifry wants the official name shown to staff. Open to discussion if another form reads better.
- **No QR modal for invite links:** Reason: Kifry wants invite links kept conceptually separate from the Attendance Kiosk identity badges.
- **Backward compatibility:** Existing pending invites without `expiresAt` or `branch` keep working (branch defaults to `"Cabang Utama"`, no expiry). The panel can show nothing or "No expiry" for these.

---

## Proposed Changes

### 1. Repository & Data Layer

#### [MODIFY] `invitesRepository.js`
- `createInvite(email, role, branch = "Cabang Utama")`:
  - `expiresAt` = 7 days from creation (type per Audit Note 2).
  - Store normalized fields: `email: email.toLowerCase().trim()`, `role`, `branch`, `createdAt`, `expiresAt`, `used: false`, `token`.

#### [MODIFY] `useDashboardData.js`
- `handleCreateInvite(email, role, branch = "Cabang Utama")` passes `branch` through and returns true/false (Audit Note 4).

#### [MODIFY] `firestore.rules`
- Add an expiry check to the `users` create rule (Audit Note 1). Agent to confirm the best shape and provide deployment steps for Kifry.

---

### 2. Staff Registration & Onboarding Lifecycle

#### [MODIFY] `StaffSignup.jsx`
- **Expiration check:** in the token lookup, if `invite.expiresAt` exists and is in the past, set `inviteError` to:
  `"This invitation link has expired. Please contact the administration at MYLIBERTY International English School to request a new invitation."`
- **Profile data:** `status: "active"` (Audit Note 5), `branch: invite.branch || "Cabang Utama"`, trimmed text inputs, validation after trimming (Audit Note 6), keep the `nickname || firstName` fallback.

---

### 3. Invites Management Cockpit

#### [MODIFY] `InvitesPanel.jsx`
- **Branch selection:** dropdown from `STANDARD_BRANCHES` and `getDistinctStaffBranches(users)`, default `"Cabang Utama"`.
- **Duplicate email hint:** compare lowercase/trimmed email against `users` and unexpired pending invites; show feedback before generating (Audit Note 7).
- **Keep the typed email when creation fails** (Audit Note 4).
- **WhatsApp share:** "Share via WhatsApp" using a pre-filled message (language per Audit Note 8), for example:
  > *"Halo! Berikut adalah tautan resmi untuk melengkapi pendaftaran akun staf Anda di MYLIBERTY International English School: [link]"*
  Copy actions for the raw link and the full message; layout per Audit Note 9.
- **Expiry badges:** `Expires in Xd`, `Expires today`, `Expired` (and a neutral state for legacy invites).
- **Search & filter:** search pending invites by email or role.
- **Design refresh:** card layout with role-colored badges, timestamp, mobile-first actions.
- Delete keeps using the existing confirmation in `handleDeleteInvite` (Audit Note 3).

#### [MODIFY] `AdminDashboard.jsx`
- Pass `users={users}` to `<InvitesPanel />`.

---

## Verification Plan

### Automated
- `npm run lint` with 0 errors and warnings.
- `npm run build` compiles cleanly.

### Manual
1. **Invite with branch & expiry:** generate an invite; the Firestore document has `branch` and `expiresAt` (about 7 days ahead).
2. **Duplicate hint:** typing an existing registered email shows a clear message.
3. **Failed creation:** the typed email stays in the field.
4. **WhatsApp share:** the opened text includes "MYLIBERTY International English School".
5. **Registration lifecycle:** open `/join/[token]`, complete signup; the new `users` profile has `status: "active"` and the right `branch`; the invite document is removed.
6. **Expired link (UI):** an expired token shows the friendly expiry message.
7. **Expired link (rules):** after rules are published, a signup attempt with an expired invite is rejected by Firestore (agent to suggest a simple way to test, given Kifry's no-code setup).
8. **Legacy invite:** an old pending invite without `expiresAt` still opens and completes signup.
9. **Delete:** one confirmation appears, not two.

---

## Resolution & Completion Report

*Completed on September 20, 2026. Automated verification: `npm run lint` (0 errors, 0 warnings) and `npm run build` (clean production bundle in 5.82s).*

### Implementation Details

1. **Integer Millisecond `expiresAt` & Branch Binding**:
   - `invitesRepository.js`: `createInvite(email, role, branch = "Cabang Utama")` calculates `expiresAt` as integer milliseconds (`Date.now() + 7 * 24 * 60 * 60 * 1000`). It stores `branch`, normalized lowercase/trimmed `email`, and `createdAt` as an ISO string.
2. **Server-Side Security Rules Expiry Enforcement**:
   - `firestore.rules`: Updated `/users/{userId}` create rule with `isInviteValid(inviteId)` checking `(!('expiresAt' in inv) || inv.expiresAt > request.time.toMillis())`. Legacy pending invites lacking `expiresAt` remain fully valid.
3. **Graceful Error Handling & Input Retention**:
   - `useDashboardData.js`: `handleCreateInvite` returns `true` on success and `false` on failure. `InvitesPanel.jsx` only clears the typed email on success.
4. **Single Delete Confirmation Prompt**:
   - `useDashboardData.js`: `handleDeleteInvite(id, email)` shows a single prompt: `"Cancel and revoke invitation for [email]?"`. No duplicate prompt in `InvitesPanel.jsx`.
5. **Staff Registration Data Integrity & Post-Trim Validation**:
   - `StaffSignup.jsx`:
     - Checks expiration: displays friendly error with `"MYLIBERTY International English School"` if expired.
     - Validates post-trim `firstName`, `lastName`, and `phone`.
     - Writes `status: "active"`, `branch: invite.branch || "Cabang Utama"`, and `nickname: (formData.nickname || formData.firstName).trim()`.
6. **Invites Management Cockpit (`InvitesPanel.jsx`)**:
   - Campus branch dropdown populated from `STANDARD_BRANCHES` and `getDistinctStaffBranches(users)`.
   - Live duplicate warning hints if the typed email matches an existing user or active pending invite.
   - WhatsApp share button formatting message with `"MYLIBERTY International English School"`.
   - Expiry countdown pills (`Expires in Xd`, `Expires today`, `Expired`, `No expiry`).
   - Compact, uncrowded mobile action layout.

### Copy-Paste Guide for Publishing `firestore.rules` (Firebase Console)
1. Open [Firebase Console](https://console.firebase.google.com/) -> Select Project `mylibertyies-f2f38`.
2. Navigate to **Firestore Database** -> **Rules** tab.
3. Replace the `/users/{userId}` creation rule with:
```rules
    function isInviteValid(inviteId) {
      let inv = get(/databases/$(database)/documents/invites/$(inviteId)).data;
      return inv.email == request.auth.token.email.lower()
          && inv.role == request.resource.data.role
          && (!('expiresAt' in inv) || inv.expiresAt > request.time.toMillis());
    }

    match /users/{userId} {
      allow read: if isAdmin()
        || isManager()
        || (isStaff() && resource.data.role in ['student', 'instructor'])
        || (signedIn() && userId == request.auth.uid);
      allow create: if isAdmin() 
        || (isFrontOffice() && request.resource.data.role == 'student')
        || (signedIn()
            && userId == request.auth.uid
            && request.resource.data.inviteId is string
            && isInviteValid(request.resource.data.inviteId));
      allow delete: if isAdmin() || (isFrontOffice() && resource.data.role == 'student');
      allow update: if isAdmin()
        || (isFrontOffice() && resource.data.role == 'student' && request.resource.data.role == 'student')
        || (signedIn()
          && userId == request.auth.uid
          && request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['displayName', 'phone', 'dob', 'photoURL', 'nickname']));
    }
```
4. Click **Publish**.
