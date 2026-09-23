# Gorontalo City School Outreach Map — Implementation Plan (Audited)

> Note: this plan was produced by an AI (Claude) auditing an earlier AI-produced plan against the actual repository. Both the earlier plan and this audit can contain mistakes — please double-check anything load-bearing before building on it, and feel free to push back on any of it.

## Audit basis

Checked against `src/features/dashboard/MarketingDashboard.jsx`, `package.json`, and `firestore.rules` in the uploaded `myliberty-portal.zip` (2026-09-22).

---

## Scope check — city vs. province

The original plan mixes municipalities across the wider Gorontalo area (Kota Gorontalo, Bone Bolango, Limboto/Kab. Gorontalo), including seed examples like SMA Negeri 1 Limboto, which sits outside the city. Kifry's actual field workflow (as marketing officer) covers Kota Gorontalo — the city — not the wider province.

Two ways to handle this, both technically fine:
- **Option A**: scope the starter dataset and filters to Kota Gorontalo only for now, add other municipalities later if the workflow expands.
- **Option B**: keep the province-wide data structure (it costs little extra code — a `municipality` field either way) and just seed city schools first, adding others later without a rebuild.

This is a data/seeding decision, not an architecture one — whoever executes this can run with whichever Kifry confirms, or propose a third option.

---

## What checks out

- `MarketingDashboard.jsx` currently sits around 226 lines as a single file, using the shared `DashboardShell` tabs pattern. Adding a "School Visits & Map" tab there is a small, additive change, not a restructure.
- The `marketing` role already exists in `firestore.rules` (`isStaff()` includes `'marketing'`), so scoping write access on a new `school_outreach` collection to `marketing` / `admin` / `manager` lines up with the existing role pattern rather than introducing a new one.
- No mapping library is in `package.json` yet. Leaflet + OpenStreetMap is a reasonable zero-cost fit given there's no budget for Google Maps billing — no API key, no recurring cost.
- Splitting the new UI into separate files (`GorontaloOutreachMap.jsx`, `SchoolVisitModal.jsx`, `OutreachProgressWidget.jsx`) rather than growing `MarketingDashboard.jsx` itself fits the project's existing concern about files growing past ~1000 lines.

---

## Worth a look before building (technical notes)

- **Leaflet marker icons under Vite**: Leaflet's default marker icon images are known to not resolve correctly when bundled by Vite (a common gotcha, not specific to this repo). Worth planning for custom marker icons or an explicit icon-path fix from the start rather than discovering broken/missing pins after the fact.
- **CSS import location**: the original plan says "import Leaflet CSS in `index.html` or `App.jsx`". Importing it directly inside the new map component file (`import 'leaflet/dist/leaflet.css'`) is more contained and closer to how the rest of this codebase seems to scope styles — a minor preference, either works.
- **Folder placement**: the proposed `src/features/dashboard/marketing/` subfolder doesn't exist yet. The closest existing precedent is `src/features/dashboard/manager/` — a role-scoped subfolder holding that dashboard's growing feature set. Creating `marketing/` the same way looks consistent with how the codebase already organizes things, not a conflict.

---

## Open questions (carried over, still open)

1. Does Kifry already have a list of specific target schools in Kota Gorontalo to preload, or should the app start with a small seed list and let the officer add the rest from the UI on the go?
2. Beyond contact person (Guru BK/Kepsek), visit status, and notes — any specific numbers worth logging per visit (brochures handed out, leads collected, next visit date)?
3. City-only scope for now, or keep the data model open for other municipalities later (see Scope check above)?

---

## Proposed changes

Carried forward from the original plan, with the notes above folded in.

### Dependencies & Core Map Setup

#### [MODIFY] `package.json`
- Add `leaflet` for open-source, zero-cost map rendering.

#### CSS
- Import `leaflet/dist/leaflet.css` inside the new map component (see technical note above).

### Data Models & Constants

#### [NEW] `src/constants/schoolOutreach.js`
- Seed data for schools — scope per the "Scope check" decision above — with coordinates, municipality field, and school tier (SMA/SMK/SMP/University).
- Status set: `pending` (not visited), `scheduled` (today's target), `visited` (completed), `follow_up` (needs follow-up / partnered).

### Data Layer

#### [NEW] `src/features/dashboard/marketing/schoolsRepository.js`
- `listenToSchools(callback)` — real-time listener for map pins and stats.
- `updateSchoolVisit(schoolId, visitData)` — logs visit date, status, notes, contact person, leads count.
- `addNewSchool(schoolData)` — lets marketing officers add new target schools.
- `seedInitialSchoolsIfEmpty()` — seeds starter data if the collection is empty.

### UI Components & Map View

#### [NEW] `src/features/dashboard/marketing/GorontaloOutreachMap.jsx`
- Interactive map centered on Kota Gorontalo.
- Pins color-coded by status (green = visited, yellow = scheduled, gray/red = pending).
- Popup with school name, address, status, "Log Visit" button, and a "Navigate in Google Maps" link (`https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` — no API key needed for this link, it just opens the Google Maps app/site).

#### [NEW] `src/features/dashboard/marketing/SchoolVisitModal.jsx`
- Visit date (defaults to today, WITA), status selector, contact person + role, WhatsApp/phone, flyers/leads count, follow-up notes and next action date.

#### [NEW] `src/features/dashboard/marketing/OutreachProgressWidget.jsx`
- Total vs. visited count and percentage, breakdown by municipality, filter shortcuts (Today's Target / Needs Follow-up / Unvisited).

#### [MODIFY] `src/features/dashboard/MarketingDashboard.jsx`
- New "School Visits & Map" tab (map + filters + visit log).
- Small progress card on the existing overview tab.

### Security & Firestore Rules

#### [MODIFY] `firestore.rules`
- New `school_outreach` collection: read for `isStaff()`, write (create/update) for `marketing` / `admin` / `manager` — matches the existing role pattern already used elsewhere in the file.

---

## Verification Plan

### Automated
```powershell
npm test
npm run typecheck
```
Add `schoolsRepository.test.js` covering status transitions and validation, consistent with how other repositories in this codebase are tested.

### Manual
- Map renders, zooms, and pans centered on Kota Gorontalo.
- Status filter chips work (All / Visited / Scheduled / Pending).
- Logging a visit on a sample school updates the pin color, the progress percentage, and Firestore in real time.
- "Navigate in Google Maps" opens with the correct coordinates.
- Responsive on a mobile viewport (this is meant for on-the-road field use).
