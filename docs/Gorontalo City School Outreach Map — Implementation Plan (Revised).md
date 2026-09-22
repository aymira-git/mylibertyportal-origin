# Gorontalo City School Outreach Map — Implementation Plan (Revised)

> Revised against the current `main` branch of `aymira-git/mylibertyportal-origin` on 2026-09-22, using the uploaded audited plan as the starting point.
>
> This revision keeps the original MVP intent, but aligns it more closely with the repository's current architecture, validation, testing, Firestore naming, and field-work constraints.

---

## 1. Executive Summary

Build a **School Visits & Outreach Map** inside the existing Marketing Portal so a marketing officer can:

- see target schools around Kota Gorontalo on an interactive map;
- filter schools by outreach status;
- open a school record and log a visit quickly from the field;
- record contact person, contact role, WhatsApp/phone, flyers handed out, leads collected, notes, and next action date;
- see outreach progress at a glance; and
- open turn-by-turn navigation for a selected school.

The feature should be additive. It should not restructure the existing dashboard, authentication flow, Firebase setup, or other domains.

### Recommended MVP scope

- **Geographic scope:** seed Kota Gorontalo schools first.
- **Data model:** keep a `municipality` field so other municipalities can be added later without redesign.
- **History:** keep individual visit records rather than overwriting the entire visit history on the school document.
- **Mapping:** Leaflet with a configurable tile layer; do not treat the public OpenStreetMap tile server as an unlimited/free production dependency.
- **Offline:** no offline map requirement in MVP. The existing PWA does not by itself guarantee that map tiles or Firestore data are available offline.

---

## 2. Repository Verification

The current repository already provides the architectural pieces this feature needs:

- `MarketingDashboard.jsx` is still a relatively small role-specific dashboard file and already uses the shared `DashboardShell` tab pattern.
- The project uses domain-centered organization under `src/features/`.
- Firestore access is expected to live in `*Repository.js` files rather than inside React components.
- The repository already has a Zod schema layer under `src/schemas/`.
- WITA date handling is centralized in `src/utils/dateWita.js`.
- Current `package.json` includes `test`, `typecheck`, `lint`, `build`, and Playwright scripts.
- `marketing` is already part of the existing staff-role model.

### Important correction to the earlier audit

The uploaded audit said the current `package.json` did not contain `test` or `typecheck` scripts. The current GitHub `main` branch **does** contain both, plus Vitest and TypeScript. The implementation plan below therefore uses the repository's actual current verification commands rather than the stale audit assumption.

---

## 3. Scope Decision

### Geographic scope

Use **Kota Gorontalo** for the initial seed dataset and default map view.

Keep these fields in the data model:

- `municipality`
- `district` (nullable/optional)
- `address`
- `lat`
- `lng`

This gives a clean city-first MVP without blocking later expansion to Kabupaten Gorontalo, Bone Bolango, or other areas.

Do not silently mix outside-city schools into the starter dataset.

### School categories

Retain the useful school tier/category concept, but keep it extensible:

- `SMA`
- `SMK`
- `SMP`
- `University`
- `Other`

The UI may initially filter by category only if the seed data actually needs it; otherwise keep it as metadata for later reporting.

---

## 4. Data Model

### 4.1 School master record

Use a Firestore collection named:

```text
schoolOutreach/{schoolId}
```

Use **camelCase** naming to match existing collections such as `corporateEvents`, `staffLeave`, and `shiftAuditEvents`.

Suggested fields:

```text
name: string
municipality: string
district: string | ""
address: string
lat: number
lng: number
tier: "SMA" | "SMK" | "SMP" | "University" | "Other"
active: boolean
status: "pending" | "scheduled" | "visited" | "follow_up"
scheduledDate: string | ""          // YYYY-MM-DD in WITA
lastVisitDate: string | ""           // YYYY-MM-DD in WITA
lastVisitId: string | ""
lastContactName: string | ""
lastContactRole: string | ""
lastOutcome: string | ""
nextActionDate: string | ""          // YYYY-MM-DD in WITA
createdBy: string
createdAt: string                    // ISO timestamp
updatedBy: string
updatedAt: string                    // ISO timestamp
```

### 4.2 Visit history

Store each visit under the school:

```text
schoolOutreach/{schoolId}/visits/{visitId}
```

Suggested fields:

```text
visitDate: string                    // YYYY-MM-DD in WITA
contactName: string
contactRole: string
phone: string
flyersHandedOut: number
leadsCollected: number
outcome: string
notes: string
nextActionDate: string | ""
createdBy: string
createdAt: string                    // ISO timestamp
```

### Why keep visit history separate?

A school can be visited many times. Updating only the school document would lose the previous visit record and make reporting harder. The parent school document should hold the **current summary**, while the subcollection holds the **history**.

The visit creation flow should update both records in one Firestore write batch:

1. create the visit document;
2. update the school's `status`, `lastVisit*`, `lastOutcome`, `nextActionDate`, and `updated*` fields.

This keeps the map fast while preserving historical outreach data.

---

## 5. Validation

### [NEW] `src/schemas/schoolOutreachSchema.js`

Add Zod schemas for:

- school master records;
- visit records; and
- allowed status/category values.

Export them from the existing:

```text
src/schemas/index.js
```

Use the schema at the repository boundary before writes, following the pattern already used by other repositories.

Validation should cover at minimum:

- non-empty school name;
- valid municipality/address strings;
- latitude between `-90` and `90`;
- longitude between `-180` and `180`;
- valid status/category values;
- non-negative integers for `flyersHandedOut` and `leadsCollected`;
- valid `YYYY-MM-DD` date strings for WITA date-only fields.

---

## 6. Repository Layer

### [NEW] `src/features/dashboard/marketing/schoolOutreachRepository.js`

Keep direct Firestore operations here. React components should not call Firestore directly for this feature.

Recommended functions:

```js
listenToSchools(callback)
addSchool(schoolData)
updateSchool(schoolId, updateData)
createSchoolVisit(schoolId, visitData)
listenToSchoolVisits(schoolId, callback)
```

### Repository behavior

`listenToSchools(callback)`

- attach one real-time listener to `schoolOutreach`;
- sort/filter in memory for the expected small city-school dataset;
- avoid adding a composite Firestore index just for initial UI ordering unless real data volume proves it necessary.

`addSchool(schoolData)`

- validate with Zod;
- trim string inputs;
- set `createdBy`, `createdAt`, `updatedBy`, and `updatedAt` from the authenticated user/context available to the feature.

`updateSchool(schoolId, updateData)`

- validate updateable fields;
- update `updatedBy` and `updatedAt`;
- do not allow the UI to overwrite immutable creation metadata.

`createSchoolVisit(schoolId, visitData)`

- validate visit payload;
- create the visit record under the school;
- update the school's current outreach summary in the same batch;
- use WITA utilities for default date handling.

`listenToSchoolVisits(schoolId, callback)`

- listen only to the selected school's visit history;
- do not fetch visit subcollections for every school while the map is open.

### Seeding

Do **not** use `seedInitialSchoolsIfEmpty()` from the normal marketing dashboard.

Client-side auto-seeding can race between users and turns initial dataset setup into normal application behavior.

Instead:

- keep a verified starter dataset in a dedicated seed source;
- load it once through a controlled admin/manual deployment process; and
- make the application itself responsible only for normal CRUD after seeding.

If a developer wants a repeatable seed command later, add it as a separate tooling task rather than as an implicit UI side effect.

---

## 7. UI Structure

Create a new role-scoped folder consistent with the existing feature layout:

```text
src/features/dashboard/marketing/
```

### [NEW] `GorontaloOutreachMap.jsx`

Responsibilities:

- initialize/destroy the Leaflet map cleanly inside React lifecycle hooks;
- center on Kota Gorontalo by default;
- render one marker per active school;
- use lightweight custom `L.DivIcon` markers for status colors instead of relying on Leaflet's default image assets, avoiding the common Vite marker-path problem;
- show school name, address, tier, current status, and last/next outreach information in the popup/card;
- expose `Log Visit` and `Open Navigation` actions.

Suggested status presentation:

- `visited` — completed outreach;
- `scheduled` — a planned target date exists;
- `follow_up` — action is pending;
- `pending` — not yet visited.

Do not rely on color alone. Include text/status labels for accessibility and for users who cannot distinguish colors reliably.

### [NEW] `SchoolVisitModal.jsx`

Fields:

- visit date, defaulted using `todayWita()`;
- contact person;
- contact role (Guru BK / Kepsek / Wakasek / Other);
- WhatsApp/phone;
- flyers handed out;
- leads collected;
- outcome;
- notes;
- next action date.

For field use:

- keep the form compact;
- make the primary save action sticky/obvious on small screens;
- use numeric inputs for flyer/lead counts;
- prevent accidental duplicate submission while saving.

### [NEW] `OutreachProgressWidget.jsx`

Show:

- total active schools;
- visited count;
- scheduled count;
- follow-up count;
- pending count;
- visited percentage.

Optional filters:

- All
- Pending
- Scheduled
- Visited
- Follow-up

Municipality breakdown can be retained in the component for future multi-city expansion, but the MVP UI does not need to emphasize it while the seed data is city-only.

### Optional: `SchoolOutreachList.jsx`

Strongly recommended even though the feature is map-first.

The map is useful visually, but a searchable list is faster when the officer already knows the school name. On mobile, provide a compact list/card view below or alongside the map rather than forcing every action through map popups.

---

## 8. Marketing Dashboard Integration

### [MODIFY] `src/features/dashboard/MarketingDashboard.jsx`

Add one new tab to the existing `DashboardShell` configuration:

```text
School Visits & Map
```

The new tab should compose the new components rather than embedding the full feature into the existing dashboard file.

### Overview tab

Add a small outreach summary card to the existing `Campaign & Outreach` overview.

Keep this integration intentionally small:

- visited / total schools;
- follow-up count;
- shortcut to the new tab.

Do not duplicate the entire map or visit table on the overview screen.

---

## 9. Map Dependency and Tile Policy

### [MODIFY] `package.json`

Add:

```text
leaflet
```

Do not add a second map framework unless implementation experience shows a real need.

### CSS

Import Leaflet CSS from the map feature/component rather than globally when practical:

```js
import "leaflet/dist/leaflet.css";
```

### Tile layer

Use a configurable tile URL rather than hard-coding a provider throughout the component.

For an OpenStreetMap-backed layer, retain the required visible attribution and follow the provider's current tile-usage rules. OSM's public tile servers are community-funded, best-effort services rather than an unlimited production API.

The implementation should therefore make the tile provider swappable without rewriting the map component.

### Important MVP constraint

Do not implement:

- background tile prefetch;
- "download map for offline" behavior;
- large-area tile caching outside normal browser behavior.

Those behaviors can violate public tile-provider usage policies.

---

## 10. Navigation Link

The popup/card may include:

```text
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
```

This is only an external navigation link. It does not require a Google Maps API key and should not become a new in-app maps dependency.

Open it in a new tab/window where appropriate for the current mobile UX.

---

## 11. Security & Firestore Rules

### [MODIFY] `firestore.rules`

Add explicit rules for:

```text
match /schoolOutreach/{schoolId}
match /schoolOutreach/{schoolId}/visits/{visitId}
```

### School records

Recommended access model:

- **read:** `isStaff()`;
- **create:** marketing/admin/manager;
- **update:** marketing/admin/manager, with field restrictions;
- **delete:** preferably disabled for normal users; archive with `active = false` instead.

Marketing should not be able to alter immutable audit fields such as:

- `createdBy`;
- `createdAt`.

### Visit records

Recommended access model:

- **read:** `isStaff()`;
- **create:** marketing/admin/manager;
- **update/delete:** disabled for normal users to keep visit history auditable; admin-only correction can be added only if there is a demonstrated business need.

### Rule-level validation

Do not rely solely on the client-side Zod schema.

The Firestore rules should validate the key security/integrity properties that matter server-side, including:

- authenticated user;
- required field types;
- allowed status/category values;
- audit field ownership where applicable;
- immutable creation metadata;
- visit creator matching the authenticated user for newly created visits.

This follows the existing repository's RBAC style while making the new collection safer than a broad `allow write` rule.

---

## 12. Testing Strategy

The repo already has Vitest configured for `src/**/*.test.js` and uses a Firestore fake for repository tests.

### [NEW] `src/features/dashboard/marketing/schoolOutreachRepository.test.js`

Test at least:

1. valid school creation is accepted;
2. invalid coordinates are rejected;
3. invalid status is rejected;
4. visit payload rejects negative flyer/lead counts;
5. `createSchoolVisit()` writes both the visit record and school summary update;
6. WITA visit date defaults correctly;
7. required audit fields are written;
8. listener cleanup is handled by the caller-facing repository API as designed.

Follow the existing repository-test pattern instead of introducing a new test harness.

### Schema tests

If schema logic becomes non-trivial, add a small `schoolOutreachSchema.test.js` alongside it.

### Verification commands

Run the repository's actual scripts:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

For UI changes, also run the existing Playwright suite when practical:

```powershell
npm run test:e2e
```

---

## 13. Manual Verification Checklist

### Map

- map renders without console errors;
- default view is Kota Gorontalo;
- markers render for all active seed schools;
- markers are readable on mobile;
- map can pan and zoom normally;
- Leaflet CSS is loaded;
- custom marker icons do not break under Vite production build;
- attribution is visible.

### Filters and list

- All / Pending / Scheduled / Visited / Follow-up filters work;
- list and map remain synchronized;
- inactive schools do not appear in normal outreach view;
- school search works if the list view is implemented.

### Visit logging

- visit date defaults to current WITA date;
- required fields validate;
- flyer/lead counts reject negative values;
- successful save updates the school status/summary immediately;
- a visit history record is created;
- repeated visits do not overwrite previous visit history;
- duplicate submissions are prevented.

### Navigation

- Google Maps navigation URL contains the correct latitude/longitude;
- link works from desktop and mobile.

### Security

- marketing can create/update permitted school data;
- marketing cannot change immutable audit fields;
- unauthorized roles cannot write outreach data;
- unauthenticated access is denied;
- normal users cannot rewrite historical visit records.

### Responsive field use

Test at a mobile viewport and verify:

- map height is usable;
- filter controls are thumb-friendly;
- visit modal fits without awkward scrolling;
- save/cancel actions remain accessible;
- network error states are understandable.

---

## 14. Implementation Order

1. Add Zod schema(s) and export them through `src/schemas/index.js`.
2. Add `leaflet` dependency.
3. Create `schoolOutreachRepository.js` and repository tests.
4. Add Firestore rules for `schoolOutreach` and its `visits` subcollection.
5. Add a verified Kota Gorontalo starter dataset through a controlled seed process.
6. Build `GorontaloOutreachMap.jsx`.
7. Build `SchoolVisitModal.jsx`.
8. Build `OutreachProgressWidget.jsx`.
9. Add the optional searchable school list if the map-only flow proves slow on mobile.
10. Add the new tab and small overview widget to `MarketingDashboard.jsx`.
11. Run automated verification and production build.
12. Perform mobile/manual field-flow verification.

Keep each step small enough that the existing portal remains buildable after each meaningful change.

---

## 15. Open Decisions Before Implementation

Only a few business choices are still needed:

1. **Starter school list:** which schools should be included in the first Kota Gorontalo seed set?
2. **Visit outcomes:** what standard outcome labels should the officer choose from, if any, instead of relying only on free-text notes?
3. **Lead meaning:** does `leadsCollected` mean student leads, school partnership leads, or a combined count?
4. **Manager role:** should managers be allowed to create/update outreach data, or should they be read-only with marketing/admin retaining write access?

These decisions do not block the core architecture; they mainly determine final validation, UI labels, and Firestore rule boundaries.

---

## 16. Files Summary

### New

```text
src/schemas/schoolOutreachSchema.js
src/features/dashboard/marketing/schoolOutreachRepository.js
src/features/dashboard/marketing/schoolOutreachRepository.test.js
src/features/dashboard/marketing/GorontaloOutreachMap.jsx
src/features/dashboard/marketing/SchoolVisitModal.jsx
src/features/dashboard/marketing/OutreachProgressWidget.jsx
```

Optional:

```text
src/features/dashboard/marketing/SchoolOutreachList.jsx
```

### Modified

```text
package.json
src/schemas/index.js
src/features/dashboard/MarketingDashboard.jsx
firestore.rules
```

Potentially modified only if implementation establishes a project-level map configuration:

```text
src/features/dashboard/marketing/...
```

---

## 17. Main Revisions From the Earlier Plan

| Earlier plan | Revision | Reason |
|---|---|---|
| `school_outreach` collection | `schoolOutreach` | Matches existing Firestore naming style such as `corporateEvents`. |
| One school document stores visit state | School document + `visits` subcollection | Preserves repeat-visit history. |
| `seedInitialSchoolsIfEmpty()` in app | Controlled one-off seeding | Avoids race conditions and hidden writes during normal dashboard use. |
| No dedicated schema | Add Zod schema | Matches the repository's existing validation architecture. |
| Manual date handling | Reuse `todayWita()` and WITA helpers | Matches the portal's centralized timezone handling. |
| Broad write rule for the collection | Field-restricted RBAC + server-side validation | Better protection of audit/history fields. |
| OSM described as simply zero-cost | Configurable tile provider + policy-aware implementation | Public OSM tiles have usage limits and no SLA. |
| Map-only interaction | Map + recommended searchable list | Faster school lookup for field officers who already know the school name. |
| `npm test` + `npm run typecheck` based on the audit's assumption | Use the scripts currently present in `package.json` | The current repo already defines both scripts. |

---

## 18. Definition of Done

The feature is ready for normal use when:

- marketing can open the new School Visits & Map tab;
- the Kota Gorontalo starter schools appear correctly on the map;
- the officer can find a school without relying exclusively on the map;
- a visit can be logged in under a minute on a mobile viewport;
- repeat visits remain historically available;
- progress counts update from Firestore in real time;
- Firestore rules prevent unauthorized or unsafe writes;
- `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass;
- the production Vite build still displays Leaflet markers correctly; and
- the implementation does not introduce unrelated changes to the portal's protected infrastructure.
