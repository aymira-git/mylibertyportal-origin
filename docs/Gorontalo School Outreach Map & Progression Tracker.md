# Gorontalo School Outreach Map & Progression Tracker

Integrate an interactive, mobile-friendly map into the Marketing Portal to track daily field visits across schools in Gorontalo (Kota Gorontalo, Bone Bolango, Limboto/Kab. Gorontalo, etc.), log visit outcomes, and monitor territory coverage progression.

---

## User Review Required

> [!IMPORTANT]
> **Map Engine Choice**: We recommend **Leaflet (OpenStreetMap)** wrapped cleanly in a React 19 component. It requires **no API keys, has zero cost**, loads fast on mobile, and doesn't require Google Cloud billing. We will also include a 1-tap **"Open in Google Maps"** navigation button for real-time turn-by-turn routing on your phone.
>
> If you require native Google Maps satellite/street view instead, a Google Maps JavaScript API key with billing enabled would be needed.

> [!NOTE]
> **Starter School Dataset**: We propose pre-populating the system with a starter set of prominent Gorontalo high schools (e.g., SMAN 1 Gorontalo, SMAN 2 Gorontalo, SMAN 3 Gorontalo, SMKN 1 Gorontalo, MAN 1 Kota Gorontalo, SMA Negeri 1 Limboto, etc.) with coordinates, while allowing you to add, edit, or import additional schools directly from the UI.

---

## Open Questions

> [!IMPORTANT]
> 1. **Data Source & Scope**: Do you already have an Excel/Google Sheet or list of specific target schools in Gorontalo you'd like us to preload, or should we initialize with the top public/private schools in Gorontalo and let you add more on the go?
> 2. **Daily Metrics**: Besides contact person (Guru BK/Kepsek), visit status, and notes, are there specific numbers you want to log per visit (e.g., number of brochures handed out, leads collected, presentation date scheduled)?

---

## Proposed Changes

### Dependencies & Core Map Setup

#### [MODIFY] [package.json](file:///e:/myliberty-portal/package.json)
* Add `leaflet` (and `@types/leaflet` if needed) for open-source, zero-cost map rendering compatible with React 19.
* Import Leaflet CSS in [`index.html`](file:///e:/myliberty-portal/index.html) or [`App.jsx`](file:///e:/myliberty-portal/App.jsx).

---

### Data Models & Constants

#### [NEW] [schoolOutreach.js](file:///e:/myliberty-portal/src/constants/schoolOutreach.js)
* Seed data of notable schools in Gorontalo with verified coordinates (latitude, longitude), municipality (Kota Gorontalo, Bone Bolango, Kab. Gorontalo / Limboto), and school tier (SMA, SMK, SMP, University).
* Status definitions:
  * `pending` (⚪ Not Visited)
  * `scheduled` (🟡 Scheduled / Today's Target)
  * `visited` (🟢 Visited / Completed)
  * `follow_up` (🟣 Follow-up Needed / Partnered)

#### [NEW] [schoolsRepository.js](file:///e:/myliberty-portal/src/features/dashboard/marketing/schoolsRepository.js)
* Firestore CRUD functions for `school_outreach` collection:
  * `listenToSchools(callback)`: Real-time listener for live map pins and stats.
  * `updateSchoolVisit(schoolId, visitData)`: Logs visit date, status, notes, contact person, leads count.
  * `addNewSchool(schoolData)`: Allows marketing officers to add new target schools with coordinates or address.
  * `seedInitialSchoolsIfEmpty()`: One-click or automated seed function if Firestore has no school records yet.

---

### UI Components & Map View

#### [NEW] [GorontaloOutreachMap.jsx](file:///e:/myliberty-portal/src/features/dashboard/marketing/GorontaloOutreachMap.jsx)
* Interactive map centered on Gorontalo (`0.5401, 123.0595`).
* Custom styled pins color-coded by status (Green for visited, Yellow for scheduled today, Red/Gray for pending).
* Clickable markers with quick action popups:
  * School name, address, current status.
  * "Log Visit" quick button.
  * "Navigate in Google Maps" link (`https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`).

#### [NEW] [SchoolVisitModal.jsx](file:///e:/myliberty-portal/src/features/dashboard/marketing/SchoolVisitModal.jsx)
* Modal form to update a school's status:
  * Visit Date (defaults to today WITA).
  * Status selector (`Visited`, `Scheduled`, `Follow-up Needed`).
  * Contact Person Name & Role (e.g., Guru BK, Kepala Sekolah, Wakasek Kesiswaan).
  * WhatsApp / Phone number.
  * Flyers distributed / Prospects collected count.
  * Follow-up notes and next action date.

#### [NEW] [OutreachProgressWidget.jsx](file:///e:/myliberty-portal/src/features/dashboard/marketing/OutreachProgressWidget.jsx)
* Territory progression stats card:
  * Total schools vs. visited schools (e.g. `24 / 45 Schools Visited — 53%`).
  * Breakdown by municipality filter (Kota Gorontalo, Bone Bolango, Limboto).
  * Filter list: view "Today's Target", "Needs Follow-up", or "Unvisited".

#### [MODIFY] [MarketingDashboard.jsx](file:///e:/myliberty-portal/src/features/dashboard/MarketingDashboard.jsx)
* Add new tab: **"School Visits & Map"** (with map, filters, and visit logs).
* Add a quick-glance outreach progression card to the **"Campaign & Outreach"** overview tab.

---

### Security & Firestore Rules

#### [MODIFY] [firestore.rules](file:///e:/myliberty-portal/firestore.rules)
* Add security rules for `school_outreach`:
  * Read allowed for all staff (`isStaff()`).
  * Write (create/update) allowed for `marketing`, `admin`, and `manager`.

---

## Verification Plan

### Automated Tests
- Run existing test suite to ensure no regression:
  ```powershell
  npm test
  npm run typecheck
  ```
- Add unit tests for `schoolsRepository.test.js` verifying status transitions and validation.

### Manual Verification
- Test map rendering, zoom, and panning centered on Gorontalo.
- Verify status filter chips (All, Visited, Scheduled, Pending).
- Log a visit to a sample school (e.g. SMAN 1 Gorontalo) and verify that:
  1. Pin updates to 🟢 Visited immediately in real time.
  2. Progress percentage increments.
  3. Last visited date and notes are saved to Firestore.
- Test "Navigate in Google Maps" link to verify it opens external navigation with correct coordinates.
- Verify responsive layout on mobile viewport (for on-the-road field use).
