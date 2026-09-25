# Kiosk Clock-In Hardening — Audit Comparison & Executor Brief

> **Date:** 2026-09-25
> **Inputs reviewed:** `2026-09-25-kiosk-clock-in-security-hardening-revised.md` (v1.2, the spec) and `deepseek_markdown_20260925_b1485c.md` (the review of that spec)
> **Purpose:** Verify the review's claims against the spec, correct two inaccuracies, and hand the executor agent a single prioritized worklist. **This is not the final implementation doc** — the blocking decisions below are left open on purpose so the executor can push back or propose alternatives.

---

## 1. Corrections to the review doc

Before using the review doc's status table as-is, apply these two corrections:

1. **A3 is mislabeled "Addressed."** The spec (§1.2, §5.4) covers atomic challenge *consumption*, not the clock-skew/expiry-validation problem A3 describes. **Treat A3 as still open**: the Worker must check challenge expiry using its own server clock only, never trusting anything the client sends about timing.
2. **B12 is more resolved than its severity suggests.** Spec §5.2 already specifies a dedicated service account, least-privilege IAM, no project-owner credential, no logging of tokens, and a rotation requirement. **Treat B12 as a build-time checklist item, not an open design question.**

Everything else in the review's A1–A7 / B1–B11 list is accurate as described.

---

## 2. Blocking decisions — NOT locked, executor to resolve or counter-propose

These must be answered before the Worker/rules code is written. Each lists the options on the table; pick one, document the choice in code comments and in `docs/ARCHITECTURE.md`, or argue for a different option if you see a better fit.

### D1 — Target employee identity mode (spec §2.1)
- **Option A — Self clock-in:** `request.userId == request.auth.uid`. Simplest, no scanner hardware needed.
- **Option B — Badge/scanner clock-in:** kiosk scans a credential, Worker derives employee identity server-side from the scan payload, never trusts a bare `userId` field.
- **Option C — Both**, gated by a per-branch or per-role config flag.
- Whichever is picked, the rule applies identically to clock-out (§2.1 last line).

### D2 — Multi-shift-per-day business rule (spec §6.1)
- Can one employee have two valid (open→closed) shifts on the same WITA calendar date?
- This is a **product** question, not a technical one — flag it to whoever owns shift/payroll policy. The answer determines whether the Worker needs a transaction-based "no open shift" check only, or a deterministic per-user/day shift ID scheme.

### D3 — Idempotency key storage (spec §6.2, review B2)
- **Option A — Durable Objects:** strong per-key serialization, more Cloudflare architecture to stand up.
- **Option B — Firestore, dedicated collection with TTL:** simpler, reuses existing infra, slightly higher latency.
- **Option C — Firestore transaction on the shift document itself** (idempotency folded into the open-shift check rather than a separate key store) — worth considering as a lower-complexity alternative not listed in either source doc.
- Define retention window and failure behavior (what happens if the idempotency store is unreachable — fail closed, per §7.3's general offline-safety principle).

### D4 — Challenge lifecycle / cleanup (spec §1.3, review B3)
- **Option A — Subcollection per challenge** (`kioskChallenges/{deviceId}/attempts/{challengeId}`) plus a scheduled Cloudflare Worker Cron cleanup job (don't rely on Firestore TTL's up-to-24h delay alone).
- **Option B — Single capped-array document** per device, bounded size, no separate cleanup job needed.
- If the simpler single-document model from v1.1 is kept instead, it must be explicitly documented as "one active kiosk session per device" and duplicate-tab behavior must be tested (spec §1.3 last paragraph).

### D5 — Device binding mechanism (spec §1.1, §3.1)
- **Option A — Raw shared secret**, hashed at rest. Faster to ship, must be labeled "software-provisioned kiosk identity, not hardware identity" everywhere it's surfaced (UI, docs, audit logs).
- **Option B — Non-exportable Web Crypto keypair** (`ES256`/P-256, `extractable: false`, private key never leaves IndexedDB, Worker verifies signatures against the stored `publicKeyJwk`). Stronger, more implementation work (recovery-on-IndexedDB-loss flow, revocation-invalidates-old-key flow).
- Both are legitimate v1 choices; the spec's own preference is Option B, but explicitly allows Option A if the threat model accepts the limitation (§1.1).

**Fix needed regardless of which options are picked above:**

### D6 — `kioskAuditEvents` write-path contradiction (spec §3.3 vs §4.1)
This is not really a design choice so much as a bug in the spec that must be resolved before coding: §3.3 says Admin actions write to this collection directly; §4.1's rule blocks all client writes (`allow write: if false`). **Route all writes — including Admin provisioning/revocation — through a Worker endpoint**, so the rule can stay `if false` for clients. This is the simplest fix and keeps the Worker as the single security boundary, consistent with the rest of the spec's model.

---

## 3. Not open for debate — implement as specified

These are already fully specified in v1.2 and confirmed correct in this review. No decision needed, just correct implementation:

- **Auth flow per endpoint** (spec §5.1): verify Firebase ID token → resolve role/branch from Firestore server-side (never from client-supplied fields) → validate request schema → authorize → mutate → audit-log.
- **Atomic challenge consumption** (spec §1.2): use a Firestore transaction or an `updateTime` precondition — never a bare read-then-write.
- **Atomic open-shift check** (spec §6.1 mechanism, once D2/D4 are answered): must be transactional, not check-then-create.
- **Service-account scope** (spec §5.2 / review B12): dedicated SA, minimum IAM roles, no project-owner credential, no token logging, documented rotation procedure.
- **Offline behavior** (spec §7.3): kiosk clock-in/out must fail closed and must NOT enter the ordinary PWA offline mutation queue.
- **Rate limiting on `/kiosk/challenge`** (review A5): add a minimum interval per device/account; not addressed anywhere in v1.2 and should be added during Worker implementation.
- **Admin provisioning confirmation step** (review A6): require a displayed target-device confirmation or one-time code before provisioning completes, to blunt stolen-session risk.
- **Clock-out idempotency** (review B8): apply the same idempotency-key handling used for clock-in to clock-out — the spec's §6.2 describes the mechanism generically but §5.6 doesn't call it out explicitly; make sure the implementation does.
- **Admin manual shift marker** (spec §4.3): tag Admin-created shifts with `source: 'admin'` and an audit event, distinct from `openedVia: 'kiosk'`.
- **API route versioning** (review A7, low priority): prefix Worker routes with `/api/v1/`.

---

## 4. Mandatory tests before rollout (spec §9, unchanged — copy as acceptance criteria)

- Firestore rules: Front Office direct create/update on `/shifts` rejected; `kioskDevices`/`kioskChallenges` client access rejected.
- Worker: valid full flow succeeds; wrong branch, revoked device, expired challenge, already-consumed challenge, concurrent reuse of same challenge (exactly one success), invalid device proof, arbitrary `userId`, wrong target branch/role, already-open shift, simultaneous clock-ins, lost-response retry (no duplicate), malformed payload, offline/fetch failure (no queued mutation).
- Device binding (if D5 = Option B): private key non-extractable; public key correctly registered; copied storage without private key can't authenticate; revocation immediate; replaced credential invalidates the old one.
- Manual adversarial test scenarios (review B9, was vague in spec — use this concrete list): replay a captured request; tamper with nonce; use revoked device; use wrong branch; reuse expired challenge; two concurrent clock-ins for same user; disconnect network mid-request and confirm fail-closed.

---

## 5. Evidence standard (spec §13 / review B11 — enforce, don't skip)

No implementation claim is complete without:
```
Commit SHA / Command / Date / Environment / Result / CI artifact
```
Anything not proven by code, automated test, or runtime check gets labeled:
> **UNVERIFIED — requires runtime/CI verification**

Do not describe the browser-local kiosk credential as a "physical hardware token" anywhere (code comments, UI copy, docs) unless real hardware attestation is added later.

---

## 6. Suggested execution order

1. Resolve D6 (audit-write contradiction) — quick fix, unblocks rules work.
2. Resolve D1, D2 (product/identity decisions) — needed before schema is finalized.
3. Resolve D3, D4, D5 (storage/crypto mechanism choices) — needed before Worker code is written.
4. Write Firestore rules + rules tests.
5. Write Worker endpoints (`/kiosk/provision`, `/kiosk/challenge`, `/shift/clock-in`, `/shift/clock-out`) with schema validation, per §5.
6. Write Worker security tests (§9.2) before touching the client.
7. Repoint `shiftsRepository.js` clock-in/out methods to the Worker.
8. Build provisioning/revocation Admin UI (§8), including recovery procedures for lost/reset/replaced/compromised devices.
9. Run full lint/typecheck/build/test suite; record evidence per §13.
10. Manual adversarial test on a real kiosk station (§9's scenario list above).
11. Update `docs/ARCHITECTURE.md` only after evidence is green.
