# Drop-in instructions — pagination & data volume

## 1. Copy these files over your project

Three are brand new:

- `firestore.indexes.json`
- `src/features/shared/Pagination.jsx`
- `src/features/shared/usePagination.js`

The rest replace existing files.

## 2. Deploy the new Firestore index

The Reports page now filters shifts by date, and Firestore needs an index
for that. From the project root:

    firebase deploy --only firestore:indexes

It takes a minute or two to build. Until it finishes, the Staff Attendance
tab may show nothing and print an error in the browser console — that's
expected, and it clears on its own once the index is ready.

If you skip this step, the error message in the console contains a direct
link that creates the index for you. Either way works.

## 3. Still outstanding from last time

The three old folders were not deleted yet. Nothing imports them, so this
is safe whenever you get to it:

    Remove-Item -Recurse -Force src\components, src\hooks, src\utils   (PowerShell)
    rm -rf src/components src/hooks src/utils                          (Mac/Linux)

`src/features/shared/` looks similar and must STAY.

## 4. Verify

    npm run lint
    npm run build

Then open Reports and try the new "Period" dropdown, and open the Student
Roster and page through it.

# Lint fixes — 4 files

These replace the same-named files from the previous two drops. All four
errors were from React's newer `react-hooks` rules (set-state-in-effect and
purity), not from anything actually broken — the app worked, ESLint just
flagged the pattern.

## What changed, in one line each

- `StaffSignup.jsx` — the "no invitation token" check now runs once at
  mount (as initial state) instead of inside the effect.
- `useInstructorRoster.js` — same fix, for the "signed out" check.
- `ReportsDashboard.jsx` — `Date.now()` no longer runs during render; it's
  now called inside the fetch functions themselves, which only run from an
  effect or a click.
- `usePagination.js` — dropped the page-clamping effect entirely. It
  turned out to be unnecessary: the value this hook already returns as
  `page` is the clamped one, so nothing downstream ever saw the stale
  number in the first place.

## Steps

1. Copy these 4 files over the ones already in your project.
2. `npm run lint` — should come back clean.
3. `npm run build`.

Everything else (the 3 shim folders to delete, the GitHub secret, the
Firestore index deploy) is unchanged from before — see the earlier
READ-ME-FIRST files if you still need those.
