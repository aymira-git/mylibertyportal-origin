# MYLIBERTY Portal — Academic Model, Batches & RBAC Implementation Plan

**Scope:** Level/Tier data model, Available Batches, Admissions → Student redirect, WhatsApp outreach, RBAC (UI + Firestore rules).

---

## 1. Core Principle

> **Level is the stored academic fact. Tier is a derived label. Never store both as independently editable fields.**

```
stored:   level = "master"
derived:  tier  = "intermediate"
          stars = 2
```

The tier selector in the UI is a shortcut for *setting* level (e.g. picking "Intermediate" narrows the level dropdown to Master/Grandmaster), not a second field that gets saved alongside it.

### Level → Tier mapping (single source of truth)

This lives in **one file only** — e.g. `src/constants/levels.js` — and every component (`UserForm`, `StudentProfile`, `AvailableBatches`) imports from it. No component re-implements this mapping.

| Tier | Stars | Levels |
|---|---|---|
| Beginner | ⭐ | Warrior, Elite |
| Intermediate | ⭐⭐ | Master, Grandmaster |
| Fluent | ⭐⭐⭐ | Epic |

```js
// src/constants/levels.js
export const LEVELS = {
  warrior:     { tier: "beginner",     stars: 1, order: 1 },
  elite:       { tier: "beginner",     stars: 1, order: 2 },
  master:      { tier: "intermediate", stars: 2, order: 3 },
  grandmaster: { tier: "intermediate", stars: 2, order: 4 },
  epic:        { tier: "fluent",       stars: 3, order: 5 },
};

export function getTier(level)  { return LEVELS[level]?.tier; }
export function getStars(level) { return LEVELS[level]?.stars; }
```

`order` is included now because enrollment compatibility (next section) needs a way to compare levels, not just group them.

---

## 2. Enrollment Compatibility Rule

The plan this was reviewing left this undefined. It can't stay undefined — "same tier = compatible" is not a rule, it's a placeholder.

**Decision needed before coding, pick one:**

- **Option A — Exact match only:** a student can only enroll in a batch matching their exact level. Simplest, safest, most rigid.
- **Option B — Batch declares an explicit level range:** each batch document stores `minLevel` / `maxLevel` (using the `order` field above), and a student qualifies if their level falls in range. Handles "Master can join Grandmaster batch" without hardcoding tier logic.
- **Option C — Batch declares an explicit allowed-levels array:** most flexible, handles irregular cases (e.g. a batch open to Elite *and* Master but not Grandmaster) at the cost of more manual setup per batch.

**Recommendation: Option B.** It's flexible enough for real operational needs (a slightly-mixed-level batch) without per-batch manual level lists, and it's a simple two-field comparison:

```js
function isCompatible(studentLevel, batch) {
  const studentOrder = LEVELS[studentLevel].order;
  return studentOrder >= batch.minLevelOrder && studentOrder <= batch.maxLevelOrder;
}
```

*(Whichever option is chosen, write it down in this doc before implementation starts — don't let it get decided implicitly inside a component.)*

---

## 3. Available Batches

- Tier is the **filter/discovery layer** (what the Front Office sees when browsing: "Beginner ⭐", "Intermediate ⭐⭐", "Fluent ⭐⭐⭐").
- Level is the **enrollment constraint** (whether a specific student can actually be placed in a specific batch), evaluated with the compatibility rule from §2.
- `AvailableBatches.jsx` should not contain any level/tier derivation logic itself — it imports `getTier`/`isCompatible` from the shared constants file.

---

## 4. Admissions → Student Redirect

```
Application
   ↓ Approve
approveApplication() → returns newly created student record
   ↓
onApproveAndEdit() → opens Student Profile in edit mode
   ↓
Complete placement / academic information (level, batch)
```

Collapses the old flow (approve → close → search → find → open → edit) into approve → edit. No changes needed to this part of the plan — it was already well-specified.

---

## 5. WhatsApp Outreach (kept intentionally dumb)

- Normalize phone: strip `+`, spaces, dashes; convert local `0812…` → `62812…`.
- Link format only — no messaging API/SDK:

```
https://wa.me/<normalized_number>?text=<url_encoded_message>
```

- UI offers a Parent / Student toggle to pick which number to message.
- The application stays the source of truth for all student data; WhatsApp is an outreach shortcut, not a data channel. Don't build message logging, delivery tracking, or a WhatsApp inbox — that's a different, much bigger feature.

---

## 6. RBAC

### 6.1 Permission table

| Action | Admin | Manager/Instructor | Front Office | Student |
|---|:---:|:---:|:---:|:---:|
| Create/edit batch | ✓ | ✗ | ✗ | ✗ |
| Assign instructor/room | ✓ | ✗ | ✗ | ✗ |
| Change capacity/schedule | ✓ | ✗ | ✗ | ✗ |
| Open/close/cancel batch | ✓ | ✗ | ✗ | ✗ |
| View utilization | ✓ | ✗ | ✗ | ✗ |
| View assigned batches/roster/schedule | ✓ | ✓ | ✗ | ✗ |
| Perform instructor workflow (attendance, etc.) | ✓ | ✓ | ✗ | ✗ |
| View available batches | ✓ | ✓ | ✓ | ✗ |
| Enroll/place students | ✓ | ✗ | ✓ | ✗ |
| View own batch | — | — | — | ✓ |

**Important org-specific note:** in this company, Manager *is* Instructor. The Manager role must **not** inherit batch-administration powers just because the dashboard component happens to expose batch-related UI elements. Manager gets the Instructor row's permissions — nothing more — regardless of what else appears in `AdminDashboard.jsx` vs `FrontOfficeDashboard.jsx`.

### 6.2 Enforcement — UI is not enough

Because this app has no custom backend (Firestore only), **hiding a button in React does not stop anyone from calling the Firestore SDK directly** from the browser console. The permission table above has to be mirrored into **Firestore Security Rules**, not just conditional rendering.

```js
// Firestore rules — illustrative, adapt to actual schema
match /batches/{batchId} {
  allow read: if request.auth != null; // any logged-in role can view
  allow create, update, delete: if getUserRole(request.auth.uid) == "admin";
}

match /students/{studentId} {
  allow read: if request.auth != null;
  allow write: if getUserRole(request.auth.uid) in ["admin", "front_office"];
}

function getUserRole(uid) {
  return get(/databases/$(database)/documents/users/$(uid)).data.role;
}
```

UI-level hiding is still worth doing (better UX — don't show buttons people can't use), but it is a convenience layer on top of the real enforcement, not the enforcement itself.

---

## 7. Implementation Order

1. **Shared level/tier model** (`constants/levels.js`) — everything else depends on this.
2. **Enrollment ↔ batch compatibility rule** (§2) — decide the option, implement `isCompatible()`.
3. **Firestore Security Rules for RBAC** — do this alongside the data model, *before* building batch-management UI, since the UI shouldn't be built against an unprotected backend even temporarily.
4. **Available Batches UI/filtering** — now has a stable model and rules to build against.
5. **Admissions approval → student redirect**.
6. **Student profile placement/level workflow**.
7. **WhatsApp shortcut**.
8. **UI-level permission gating** (hide/disable controls per role, matching the rules already enforced server-side).
9. **Full regression testing** — lint/build, plus manual checks for: WhatsApp deep links, approval redirect, tier filtering, and *role-switching tests* (log in as each role, confirm both UI gating and that a direct Firestore write attempt is rejected for disallowed actions).

*(Note: RBAC/Firestore rules moved up to step 3, ahead of where the original review put it at step 7 — the batch-management UI in step 4 should never be built or tested against an open backend, even temporarily.)*

---

## 8. Architecture

```
                ADMIN
                  │
                  ▼
               BATCH ──────────────► Firestore Security Rules
          ┌───────┼────────┐         (enforce §6 server-side)
          ▼       ▼        ▼
      Instructor Schedule Capacity
          │
          ▼
       AVAILABLE
        BATCHES  ◄──────────── Level/Tier model (§1) +
          │                     Compatibility rule (§2)
          ▼
       ENROLLMENT
          │
          ▼
        STUDENT
          │
          ▼
      ATTENDANCE
```

**Two decisions to lock in before any AI starts editing `AvailableBatches.jsx`:**
1. Which compatibility option (§2) — A, B, or C.
2. Confirmation that Firestore rules will be written in step 3, not deferred to the end.
