# Kiosk Clock-In Security Hardening — Executor Instructions

> **Date:** 2026-09-25
> **Status:** Ready for Implementation
> **Target:** `firestore.rules`, `cloudflare-worker/worker.js`, `src/features/attendance/shiftsRepository.js`, `src/features/attendance/Kiosk*.jsx`
> **Reference Standards:** `AGENTS.md`, `docs/ARCHITECTURE.md`
> **Sources merged into this doc:** `kiosk-security-and-audit-summary.md` (v1.0), `kiosk-security-and-audit-summary-revised.md` (v1.1), and the remediation design agreed in chat on 2026-09-25.

## 0. Why this doc exists

v1.0 identified the right problem shape (account-bound access vs. action-bound clock-in) but described some controls as implemented when they are only UI-level. v1.1 corrected this against the actual repo and confirmed, by direct inspection of `firestore.rules`, that:

- `/shifts` `create` requires only `isAdmin() || (isFrontOffice() && isSameBranch(...))` — no device, challenge, or physical-presence proof of any kind.
- `clockOut` is accepted as an arbitrary client-supplied string; `clockIn` is not server-validated at all.
- Nothing prevents two open shifts for the same `userId`.
- `/classes` and `/attendance` `read` are granted to `isStaff()` with **no branch predicate**; `/users` `list` uses `isSameBranch()`, not `isSameBranchStrict()`.

A grep of `src/` during this review also found **zero** occurrences of `kioskDeviceId` or any device/challenge concept anywhere in the client code — there is currently no kiosk identity mechanism at all, client or server. "Kiosk mode" today is a UI state of an ordinary authenticated Front Office session.

This doc is the single implementation reference. Treat v1.0 and v1.1 as historical input; if anything here conflicts with them, this doc wins because it was checked against the code on this date.

## 1. Non-Goals — do not touch these

Per v1.1 §7 "Do Not Change Yet," carried forward unchanged:

1. Domain-centered feature layout (`src/features/*`).
2. Repository-owns-Firestore-access pattern.
3. Direct lazy-loaded role routes in `App.jsx`.
4. Browser-side pagination for rendering long lists.
5. The full in-memory `users` read (documented, intentional — see `docs/ARCHITECTURE.md`). Do not add `status == 'active'` filtering to reduce reads; it will silently break alumni search, unenrolled-student workflows, and historical lookups.
6. Existing date-windowed reads for `shifts`/`attendance`.

Do not fold general branch-isolation hardening (HIGH-02) into this pass beyond what's listed in §7 below — it's called out separately so this change stays reviewable.

## 2. Target security model

```
ACCOUNT AUTHENTICATION
    ↓
ROLE + BRANCH AUTHORIZATION
    ↓
ACTION-SPECIFIC TRUST PROOF   ← this doc builds this layer
    ↓
DATA INTEGRITY / REPLAY CONTROLS  ← and this one
```

Concretely, a shift is only created when:

```
authenticated Front Office / Admin account
        +
correct branch
        +
valid, unexpired, single-use kiosk challenge from a provisioned device
        +
server-generated timestamp
        +
no existing open shift for that userId (checked in the same transaction)
        ↓
shift document written by the Worker's own credential, not the client's
```

## 3. New data model

### 3.1 `kioskDevices/{deviceId}`
```
{
  branchId: string,
  secretHash: string,      // SHA-256 of the provisioning secret; raw secret is never stored
  revoked: boolean,
  createdAt: Timestamp,
  createdBy: string,       // admin uid
  lastSeenAt: Timestamp | null
}
```

### 3.2 `kioskChallenges/{deviceId}`
```
{
  nonce: string,           // random, e.g. 24 bytes base64url
  branchId: string,
  issuedAt: Timestamp,
  expiresAt: Timestamp,    // issuedAt + 30s
  consumed: boolean
}
```
One document per device, overwritten on each poll. Never read or written by client SDK — Worker-only (see §5).

## 4. Firestore rules changes

Both new collections are **Worker-only by construction**: the Worker authenticates to Firestore with a service-account credential (via the Firestore REST API, see §6), which is a Google Cloud IAM identity, not a Firebase Auth user — service-account writes are not subject to Security Rules at all. The rules below only need to keep normal client SDK access closed.

```javascript
match /kioskDevices/{deviceId} {
  allow read: if isAdmin();   // so the Admin UI can list/revoke provisioned stations
  allow write: if false;      // provisioning happens only through the Worker
}

match /kioskChallenges/{deviceId} {
  allow read, write: if false; // Worker-internal state only
}
```

### 4.1 Tighten `/shifts`

Current (`firestore.rules` lines ~266–297):
```javascript
match /shifts/{shiftId} {
  allow read: if isAdmin()
    || (isManager() && isSameBranch(resource.data))
    || (signedIn() && resource.data.userId == request.auth.uid);
  allow create: if (isAdmin() || (isFrontOffice() && isSameBranch(request.resource.data)))
    && request.resource.data.userId is string
    && request.resource.data.clockOut == null
    && isTrackedShiftRole(roleOf(request.resource.data.userId));
  allow update: if isAdmin()
    || (isFrontOffice()
      && isSameBranch(resource.data)
      && resource.data.clockOut == null
      && request.resource.data.clockOut is string
      ...
      .hasOnly(['clockOut', 'updatedAt', 'cashReconciliation', 'notes', 'status', 'verifiedBy', 'verifiedAt', 'autoClosed']))
    || ((isFrontOffice() || isManager()) && ... isApprovedShiftCorrection(...) ...);
  allow delete: if isAdmin();
}
```

Change to:
```javascript
match /shifts/{shiftId} {
  allow read: if isAdmin()
    || (isManager() && isSameBranch(resource.data))
    || (signedIn() && resource.data.userId == request.auth.uid);

  // Kiosk-originated create/clock-out now happens exclusively through the
  // Worker's service-account credential, which bypasses these rules by
  // Firestore design. Direct client create is intentionally removed —
  // Front Office no longer has a client-writable path to open a shift.
  allow create: if isAdmin();

  // Direct client clock-out is removed for the same reason. The
  // maker-checker correction path (already reviewed/approved via
  // /approvals) is unchanged and stays available for Front Office/Manager.
  allow update: if isAdmin()
    || ((isFrontOffice() || isManager())
      && isSameBranch(resource.data)
      && request.resource.data.userId == resource.data.userId
      && request.resource.data.appliedFromApproval is string
      && isApprovedShiftCorrection(shiftId, request.resource.data.appliedFromApproval)
      && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['clockIn', 'clockOut', 'corrected', 'reviewStatus', 'appliedFromApproval']));
  allow delete: if isAdmin();
}
```

`isAdmin()` stays on `create` only so an Admin can still manually open a shift from the Admin dashboard when needed (e.g. data fix). Ordinary kiosk clock-in for Front Office no longer has a direct client path at all.

## 5. Cloudflare Worker changes

Extend `cloudflare-worker/worker.js` — it already does Firebase ID token verification via `jose`/JWKS for the Gemini proxy; reuse that, don't duplicate it.

### 5.1 New helper: Google service-account access token

Add `cloudflare-worker/googleAuth.js`:
- Build a JWT (RS256, via `jose`'s `SignJWT`, same dependency already installed) claiming the Firestore scope, signed with a service-account private key stored as a Worker secret (`env.FIRESTORE_SA_PRIVATE_KEY`, `env.FIRESTORE_SA_CLIENT_EMAIL`).
- Exchange it at `https://oauth2.googleapis.com/token` (grant type `urn:ietf:params:oauth:grant-type:jwt-bearer`) for a bearer access token.
- Cache the token in memory for its ~1hr lifetime (Workers reuse memory across requests within an isolate).

Use this token for all Firestore REST calls below (`https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/...`).

### 5.2 `POST /kiosk/provision` (Admin only)
1. Verify caller's ID token (existing pattern) and that their role is `admin`.
2. Generate a random secret (32 bytes), compute `secretHash` (SHA-256).
3. Write `kioskDevices/{deviceId}` via the service-account token.
4. Return `{ deviceId, secret }` once — this is the only time the raw secret leaves the server. Client stores it in that browser's storage (see §7.3).

### 5.3 `POST /kiosk/challenge`
1. Verify caller's ID token; role must be Front Office/Admin, branch must match the device's `branchId`.
2. Body: `{ deviceId }`. Look up `kioskDevices/{deviceId}`; reject if missing/revoked.
3. Generate a random nonce, write `kioskChallenges/{deviceId}` with `issuedAt`/`expiresAt` (+30s) and `consumed: false`.
4. Return `{ nonce, expiresIn: 30 }`. Client polls this every ~20s while Reception Mode is open.

### 5.4 `POST /shift/clock-in`
Body: `{ deviceId, secret, nonce, userId }`.
1. Verify caller's ID token → Front Office/Admin, branch match.
2. Look up `kioskDevices/{deviceId}`: not revoked, `sha256(secret) == secretHash`, branch matches caller's branch.
3. Look up `kioskChallenges/{deviceId}`: `nonce` matches, not expired, `consumed == false`. Immediately set `consumed: true` (single write, closes the replay window) before doing anything else.
4. In a Firestore transaction: query `shifts` where `userId == userId and clockOut == null`. If one exists, reject with `409 already-open-shift` (this closes HIGH-01 as a side effect).
5. Verify `isTrackedShiftRole(roleOf(userId))` — reuse the existing role list from `firestore.rules` (keep both copies in sync, or centralize — see §8.3).
6. Write the new `shifts` doc with `clockIn` as a Firestore server timestamp, `openedVia: 'kiosk'`, `deviceId`.
7. Return the created shift.

### 5.5 `POST /shift/clock-out`
Same verification chain (steps 1–3), then:
1. Look up the target shift, confirm `clockOut == null` and branch match.
2. Update with server timestamp `clockOut`, plus any `cashReconciliation`/`notes` fields passed through unchanged from the existing `clockOutShiftWithCashReconciliation` payload shape.

## 6. Client changes

### 6.1 `src/features/attendance/shiftsRepository.js`
- `clockIn({...})` (currently `addDoc` directly to `shifts`, line ~108): change to call `POST {WORKER_URL}/shift/clock-in` with the Firebase ID token in `Authorization: Bearer`, passing the device's stored `deviceId`/`secret` and the current polled `nonce`.
- `clockOutShift(shiftId, ...)` (currently `updateDoc` with a client ISO string, line ~156) and `clockOutShiftWithCashReconciliation(...)`: change to call `POST {WORKER_URL}/shift/clock-out`.
- Keep `fetchOpenShiftFor`, `fetchUserShifts`, `adjustShiftWithAudit`, `applyApprovedShiftCorrection` as direct Firestore reads/the existing approval-gated update — those paths are unaffected.

### 6.2 Kiosk components (`KioskModal.jsx`, `Kiosk.jsx`, `StandaloneKioskPage.jsx`, `useKioskScanner.js`)
- On entering Reception Mode, read the provisioned `deviceId`/`secret` from local storage (see §7.3). If absent, show "This station is not provisioned" and block clock-in — do not silently fall back to the old direct-write path.
- Start polling `/kiosk/challenge` every ~20s while the kiosk view is open; hold the latest nonce in memory (not persisted).
- If the Worker call to `/shift/clock-in` or `/challenge` fails (offline, expired nonce, network error), show a blocking "Cannot clock in — no connection to server" state. Do **not** route this mutation through the PWA's normal offline mutation queue (this satisfies v1.1 HIGH-04 — clock-in must fail closed, not queue-and-replay later).

### 6.3 Admin provisioning UI
- Add a small "Reception Stations" panel (Admin dashboard) listing `kioskDevices` (read via existing client rules, `isAdmin()`), with:
  - "Provision this device" button (calls `/kiosk/provision`, then writes the returned secret into *this* browser's storage — meant to be clicked once, on the physical station itself, by an Admin).
  - "Revoke" button per device (sets `revoked: true` directly via Admin's normal Firestore access — Admin already has full rights here).

### 6.4 Environment/config
- Add `VITE_WORKER_URL` (or reuse whatever env var already points the AI Assistant at the Worker) for the new endpoints.
- Add Worker secrets: `FIRESTORE_SA_CLIENT_EMAIL`, `FIRESTORE_SA_PRIVATE_KEY` (a dedicated service account scoped to Firestore only, not a broad project-owner key).

## 7. Tests to add

Mirror the existing repo convention (co-located `*.test.js` files) and the audit's own evidence standard (§9 below).

1. **Rules tests** (extend the existing security rules test file):
   - Front Office client `create` on `/shifts` is now rejected outright (no more direct path).
   - Front Office client `update` on `/shifts` without `appliedFromApproval` is rejected.
   - `kioskDevices`/`kioskChallenges` reject all direct client reads/writes except Admin read on `kioskDevices`.
2. **Worker/integration tests**:
   - Valid device + valid unexpired nonce + no open shift → clock-in succeeds.
   - Reused nonce → second call rejected (replay protection).
   - Expired nonce → rejected.
   - Revoked device → rejected.
   - Second clock-in attempt for a `userId` with an already-open shift → rejected with `409`.
   - Branch mismatch between caller and device → rejected.
3. **Offline behavior test**: simulate Worker call failure while kiosk is in Reception Mode → UI shows fail-closed state, no mutation is queued.

## 8. Follow-ups intentionally out of scope here

Carried over from v1.1, not part of this pass — track separately:

1. **HIGH-02** (branch-isolation wording/consistency across `/users`, `/classes`, `/attendance`) — needs its own review of intended policy per collection before changing rules, since some of this may be intentional (e.g. instructors needing to see students across branches).
2. **HIGH-03** (class-capacity as a database invariant, not just a client transaction).
3. Centralizing the tracked-shift-role list so `firestore.rules` and the Worker don't maintain two copies that can drift (`isTrackedShiftRole`/`roleOf`) — worth a small shared-constants pass once this lands.
4. Load-testing kiosk bursts and concurrent shift creation (v1.1 §7 "Fix Before Growth").

## 9. Evidence standard going forward

Per v1.1 §5: every claim in future audit updates about this feature must record `Commit SHA / Command / Date / Environment / Result / CI artifact`, or be labeled `UNVERIFIED — requires runtime/CI verification`. Once this ships, update `docs/ARCHITECTURE.md` §"security model" to describe the four-layer model in §2 above as implemented, with a pointer to the rules tests as evidence — not before.

## 10. Ordered implementation checklist

1. Create a dedicated Firestore-only service account (not project-owner) in GCP; store its key as Worker secrets.
2. `cloudflare-worker/googleAuth.js` — service-account token exchange helper.
3. Worker routes: `/kiosk/provision`, `/kiosk/challenge`, `/shift/clock-in`, `/shift/clock-out` (§5.2–5.5).
4. `firestore.rules`: add `kioskDevices`/`kioskChallenges` blocks, tighten `/shifts` `create`/`update` (§4).
5. Rules tests (§7.1) — write these against the *new* rules before wiring the client, so the rules are proven first.
6. `shiftsRepository.js`: repoint `clockIn`/`clockOutShift`/`clockOutShiftWithCashReconciliation` at the Worker (§6.1).
7. Kiosk components: device provisioning read, challenge polling, fail-closed UI (§6.2).
8. Admin "Reception Stations" panel (§6.3).
9. Worker/integration tests (§7.2) and offline fail-closed test (§7.3).
10. Run full test suite, linter, typecheck, build.
11. Update `docs/ARCHITECTURE.md` per §9 — only after tests are green.
