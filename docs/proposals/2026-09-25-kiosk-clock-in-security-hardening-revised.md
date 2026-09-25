# Kiosk Clock-In Security Hardening — Revised Executor Instructions

> **Date:** 2026-09-25  
> **Revision:** 1.2  
> **Status:** Ready for implementation after the security-boundary revisions in this document  
> **Target:** `firestore.rules`, `cloudflare-worker/worker.js`, `src/features/attendance/shiftsRepository.js`, `src/features/attendance/Kiosk*.jsx`

## 0. Purpose

This document is the implementation reference for moving kiosk clock-in from a normal Front Office Firestore write to a server-mediated, action-bound flow.

The v1.0/v1.1 design correctly separated:

- **Account authentication** — who is signed in.
- **Role + branch authorization** — what that account may do.
- **Action-specific trust proof** — whether the request came from a provisioned kiosk station.
- **Data integrity / replay controls** — whether the request is fresh, unique, and produces one valid shift state.

This revision adds several controls that should be treated as mandatory before implementation rather than follow-ups.

---

## 1. Security decisions that changed from v1.1

### 1.1 A browser secret is not a hardware token

The previous design stored a raw kiosk secret in browser storage and called the resulting device identity "physical".

That should be renamed to **provisioned kiosk-station identity**. A browser-local secret can identify a provisioned browser profile, but it does not cryptographically prove that the request came from a particular physical tablet.

For the first implementation, use the secret-based flow only if the threat model explicitly accepts this limitation.

For stronger device binding, prefer a non-exportable Web Crypto keypair stored as a `CryptoKey` in IndexedDB:

- The browser generates the private key during provisioning.
- `extractable: false` is used for the private key.
- The Worker stores only the public key.
- The kiosk signs a fresh server challenge instead of sending a reusable secret.

Web Crypto supports non-extractable keys, and `CryptoKey` objects are designed to be stored through IndexedDB without exposing the underlying key material directly.  
Reference: MDN Web Crypto / `CryptoKey.extractable`.

**Important limitation:** this is still browser/application-level possession, not tamper-proof hardware attestation. An attacker who gains code execution in the kiosk origin may still be able to invoke the legitimate signing operation.

### 1.2 Challenge consumption must be atomic

The v1.1 wording says to read a challenge, verify `consumed == false`, then immediately set `consumed: true`.

That is **not sufficient by itself** against two concurrent requests. Both requests can observe `false` before either write completes.

Implement challenge consumption with one of these mechanisms:

1. A Firestore transaction that reads and updates the challenge document atomically; or
2. A Firestore write using `currentDocument.updateTime` as a precondition, so only the request holding the observed document version can consume it.

Firestore's REST API supports document preconditions based on `updateTime`. 

The endpoint must treat a failed precondition as a replay/consumption failure, not retry the same nonce blindly.

### 1.3 Do not overwrite one challenge document if concurrent sessions are possible

`kioskChallenges/{deviceId}` being overwritten every ~20 seconds is workable only if the kiosk is guaranteed to have exactly one active challenge consumer.

Prefer:

`kioskChallenges/{deviceId}/attempts/{challengeId}`

with:

```text
challengeId
nonce
issuedAt
expiresAt
consumedAt
```

and a short TTL/lifecycle policy.

This gives each challenge its own identity and makes audit/debugging much easier.

If the simpler single-document model is retained, explicitly document that only one kiosk tab/session is permitted and test duplicate-tab behavior.

---

## 2. Target security model

A successful kiosk clock-in requires all of the following:

```text
Authenticated account
    +
Role authorized for clock-in operation
    +
Caller branch == kiosk branch
    +
Provisioned kiosk proof
    +
Fresh single-use server challenge
    +
Valid target employee identity
    +
No existing open shift for target employee
    +
Server-generated clockIn timestamp
    +
Server-side schema validation
    ↓
Worker creates exactly one shift
```

### 2.1 Target employee identity is part of the trust boundary

The current plan sends `userId` in the clock-in body. That is not enough by itself.

The Worker must explicitly determine why that `userId` is allowed to be clocked in.

Choose and document one of these modes:

**Self clock-in:**

```text
request.userId == request.auth.uid
```

**Badge/scanner clock-in:**

The kiosk scans an employee credential whose payload is validated by the Worker, and the resulting employee identity is used server-side.

Do not accept an arbitrary `userId` from the browser and consider the request authenticated merely because the caller is Front Office.

The same rule applies to clock-out.

---

## 3. Data model

### 3.1 `kioskDevices/{deviceId}`

Secret-based minimum model:

```javascript
{
  branchId: string,
  secretHash: string,
  revoked: boolean,
  createdAt: Timestamp,
  createdBy: string,
  lastSeenAt: Timestamp | null
}
```

Stronger public-key model:

```javascript
{
  branchId: string,
  publicKeyJwk: object,
  revoked: boolean,
  createdAt: Timestamp,
  createdBy: string,
  lastSeenAt: Timestamp | null
}
```

Do not store the raw kiosk secret or private key in Firestore.

### 3.2 `kioskChallenges/{challengeId}`

Preferred model:

```javascript
{
  deviceId: string,
  nonce: string,
  branchId: string,
  issuedAt: Timestamp,
  expiresAt: Timestamp,
  consumedAt: Timestamp | null
}
```

Use a unique `challengeId` per issued challenge.

### 3.3 `kioskAuditEvents/{eventId}`

Add a small append-only audit stream for security-sensitive station operations:

```javascript
{
  eventType: 'provision' | 'revoke' | 'challenge' | 'clockIn' | 'clockOut' | 'reject',
  deviceId: string | null,
  branchId: string | null,
  actorUid: string | null,
  targetUserId: string | null,
  reason: string | null,
  createdAt: Timestamp
}
```

This should be Worker-written for kiosk events and Admin-written/Worker-written for provisioning operations. Avoid logging raw secrets, raw Authorization headers, or full scanned badge contents.

---

## 4. Firestore rules

### 4.1 Worker-only collections

```javascript
match /kioskDevices/{deviceId} {
  allow read: if isAdmin();
  allow write: if false;
}

match /kioskChallenges/{challengeId} {
  allow read, write: if false;
}

match /kioskAuditEvents/{eventId} {
  allow read: if isAdmin() || (isManager() && isSameBranch(resource.data));
  allow write: if false;
}
```

The Worker uses a service-account credential, so these writes bypass Firebase Security Rules. That means the Worker itself becomes the security boundary and must perform every authorization and validation check server-side.

### 4.2 `/shifts`

Direct client clock-in/clock-out writes should be removed for Front Office.

```javascript
allow create: if isAdmin();
```

For updates, retain only:

- Admin correction paths; and
- the already-approved maker-checker shift-correction path.

A normal Front Office client must not be able to set `clockIn` or `clockOut` directly.

### 4.3 Admin manual shift creation

`isAdmin()` retaining direct create access is acceptable only if this is explicitly a maintenance/correction function and is audited.

Prefer giving manual Admin creation a separate `source: 'admin'` marker rather than making it indistinguishable from a kiosk event.

---

## 5. Worker architecture

### 5.1 Authentication

Reuse the existing Firebase ID-token verification mechanism.

For every endpoint:

1. Verify the ID token cryptographically.
2. Resolve the caller's role and branch from trusted server-side data.
3. Validate the request body against an explicit schema.
4. Enforce endpoint-specific authorization.
5. Perform the Firestore operation.
6. Emit a security audit event where appropriate.

### 5.2 Service-account credential

A Cloudflare Worker secret is an appropriate place to keep sensitive Worker configuration; Cloudflare explicitly recommends Worker Secrets rather than plaintext environment variables for sensitive values.

However, a service-account private key grants the Worker a powerful Firestore identity. Therefore:

- use a **dedicated** service account;
- grant the minimum IAM role(s) required for Firestore access;
- never use a project-owner credential;
- never return the private key to the browser;
- never log the JWT assertion or access token;
- document the credential rotation procedure.

The long-term architecture can move the privileged Firestore writer behind a narrower backend service if the Worker credential becomes too broad.

### 5.3 `POST /kiosk/provision`

Admin-only.

Preferred flow:

1. Verify Admin identity.
2. Generate the device identity.
3. Persist the public key or secret hash.
4. Create an audit event.
5. Return only the one-time provisioning material required by the kiosk.

For the public-key design, do not transmit a reusable secret to the browser at all.

### 5.4 `POST /kiosk/challenge`

Verify:

- authenticated caller;
- Front Office/Admin role;
- device exists;
- device is not revoked;
- caller branch matches device branch.

Issue a random challenge with an explicit expiration.

Do not treat the challenge itself as proof of physical presence. It becomes proof only when combined with the provisioned device credential and valid caller authorization.

### 5.5 `POST /shift/clock-in`

Request should be conceptually:

```javascript
{
  deviceId,
  challengeId,
  proof,
  targetUserId
}
```

Server sequence:

1. Verify Firebase ID token.
2. Resolve caller role/branch.
3. Validate `deviceId` and device state.
4. Verify device proof.
5. Atomically consume the challenge.
6. Validate target employee identity.
7. Verify target branch and tracked shift role.
8. Atomically verify that no open shift already exists.
9. Create the shift with a server timestamp.
10. Record `openedVia: 'kiosk'` and `deviceId`.
11. Write a kiosk audit event.
12. Return the created shift.

A failure at any security step must produce no shift write.

### 5.6 `POST /shift/clock-out`

Apply the same authentication, branch, device, challenge, and target-identity checks.

Then:

1. Load the target shift.
2. Verify it belongs to the target employee and expected branch.
3. Verify it is still open.
4. Validate the permitted payload fields with a schema.
5. Write `clockOut` using a server timestamp.
6. Write the kiosk audit event.

Do not accept arbitrary fields through a generic "pass-through" object.

---

## 6. Idempotency and concurrency

### 6.1 Open-shift invariant

The Worker must close the race between:

```text
check for open shift
        ↓
create shift
```

Two simultaneous requests must not both pass the check.

Use a Firestore transaction or a deterministic per-user/day shift identifier that matches the business rule, depending on whether multiple shifts in a day are permitted.

The design must explicitly answer:

> Can the same employee have two valid shifts on the same WITA date?

Do not encode an idempotency key until this business rule is settled.

### 6.2 Request idempotency

Add a short-lived request id supplied by the kiosk, for example:

```text
idempotencyKey
```

Store the result of a successful mutation against that key for a bounded retention period.

This handles browser retries where the Worker commits successfully but the HTTP response is lost and the kiosk retries.

Replay protection from the challenge and request-level idempotency solve different problems; keep both.

---

## 7. Client / kiosk changes

### 7.1 Provisioning storage

The v1.1 plan says to place a raw secret in browser local storage.

Revision:

- Prefer a non-exportable `CryptoKey` in IndexedDB.
- Store only non-secret metadata in local storage.
- Never print the secret into logs, UI diagnostics, analytics, or error telemetry.

If the first release retains a raw secret, explicitly label that as **software-provisioned kiosk identity, not hardware identity**.

### 7.2 Reception Mode

On entry:

- confirm the station is provisioned;
- begin challenge acquisition;
- display station status;
- block clock-in if the device proof is unavailable or stale.

### 7.3 Offline behavior

Clock-in and clock-out security mutations must fail closed.

Do not put them into the ordinary PWA offline mutation queue.

Offline reads may continue according to existing application behavior, but an offline state must never cause a delayed clock-in to execute automatically after reconnect.

### 7.4 Session state

Do not keep the kiosk signed into an Admin account merely to enable clock-in.

The kiosk can remain an ordinary authenticated Front Office session; the action-specific kiosk proof is the additional trust layer.

---

## 8. Provisioning and revocation governance

The Admin UI should support:

- provision station;
- view branch assignment;
- last seen timestamp;
- revoke station;
- re-provision replacement station;
- view security audit history.

Revoke must take effect server-side before the next clock-in is accepted.

Provisioning and revocation should generate audit events containing actor, device, branch, and timestamp.

There must also be an explicit recovery procedure for:

- lost tablet;
- browser profile reset;
- device replacement;
- compromised station;
- staff turnover.

---

## 9. Tests that are mandatory before rollout

### 9.1 Firestore rules tests

- Front Office client create on `/shifts` is rejected.
- Front Office direct `clockIn` update is rejected.
- Front Office direct `clockOut` update is rejected.
- Approval-gated correction still works.
- `kioskDevices` client writes are rejected.
- `kioskChallenges` client reads/writes are rejected.

### 9.2 Worker security tests

- valid caller + valid device + valid challenge succeeds;
- wrong branch fails;
- revoked device fails;
- expired challenge fails;
- already-consumed challenge fails;
- concurrent reuse of the same challenge results in exactly one success;
- invalid device proof fails;
- arbitrary target `userId` outside the allowed target-identity rule fails;
- wrong target branch fails;
- wrong target role fails;
- already-open shift fails;
- simultaneous clock-ins cannot create two open shifts;
- lost HTTP response + retry does not create duplicate shift;
- malformed `cashReconciliation` / `notes` payloads are rejected;
- offline/fetch failure causes no local mutation queue entry.

### 9.3 Device-binding tests

If using Web Crypto:

- private key is non-extractable;
- public key is correctly registered;
- copied browser storage without the private key cannot authenticate the station;
- revocation is enforced immediately;
- regenerated/replaced device credentials invalidate the previous credential.

---

## 10. Observability

Record security-relevant failures with a safe, structured event such as:

```text
KIOSK_CHALLENGE_EXPIRED
KIOSK_REPLAY_REJECTED
KIOSK_DEVICE_REVOKED
KIOSK_BRANCH_MISMATCH
KIOSK_TARGET_REJECTED
KIOSK_ALREADY_OPEN
KIOSK_DEVICE_UNREGISTERED
```

Do not log:

- Firebase ID tokens;
- Worker access tokens;
- service-account private keys;
- kiosk private keys;
- raw kiosk secrets;
- full employee badge payloads.

Add monitoring for unusual repeated failures from one device, branch, or account.

---

## 11. Explicit out-of-scope items

These remain separate from the kiosk hardening pass:

1. General `/users`, `/classes`, and `/attendance` branch-isolation policy review.
2. Database-level class-capacity invariant.
3. Broader architectural redesign of the full `users` dataset.
4. High-scale load testing beyond the focused concurrency tests needed for kiosk correctness.
5. Physical tamper resistance / MDM / OS-level kiosk lockdown.

---

## 12. Ordered implementation checklist

1. Decide whether v1 uses a reusable kiosk secret or the stronger non-exportable public-key model.
2. Define the exact target-employee identity rule for clock-in/out.
3. Add Firestore collections and restrictive client rules.
4. Implement Worker authentication and request schemas.
5. Implement atomic challenge issuance/consumption.
6. Implement atomic open-shift protection and request idempotency.
7. Implement server-authoritative clock-in/out timestamps.
8. Implement kiosk audit events.
9. Implement provisioning/revocation UI.
10. Repoint the repository clock-in/out methods to the Worker.
11. Disable the ordinary offline mutation path for kiosk clock-in/out.
12. Add rules, Worker, concurrency, replay, idempotency, and device-binding tests.
13. Run full lint/typecheck/build/test suite.
14. Perform a manual adversarial test on a real kiosk station.
15. Only after evidence is green, update `docs/ARCHITECTURE.md` to describe the kiosk security model as implemented.

---

## 13. Evidence requirement

Every implementation claim should record:

```text
Commit SHA
Command
Date
Environment
Result
CI/test artifact
```

Any item not proven by code, automated tests, or runtime verification must be labeled:

> **UNVERIFIED — requires runtime/CI verification**

Do not describe a browser-local kiosk credential as a physical hardware token unless the deployment actually includes a hardware-backed attestation mechanism.
