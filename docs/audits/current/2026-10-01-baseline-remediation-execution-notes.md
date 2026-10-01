# Baseline Remediation Execution Notes

**Plan:** `2026-10-01-baseline-remediation-plan.md`
**Baseline commit:** `2a7c7ac`
**Status:** Local remediation complete; production verification and kiosk fallback decision pending

## Phase 0 — Current-code baseline

- Current commit: `2a7c7ac`.
- Owner reports Firestore rules were redeployed and believes they match the repository; an exact console-to-file comparison is still unverified.
- Owner reports payment recording works as Admin, but Front Office sees "missing or insufficient permission"; a Front Office account was not available to complete all live payment tests. Student status change succeeded. Pending-payment update remains unverified.
- Cloudflare Worker deployment, `VITE_AI_WORKER_URL`, and live kiosk clock-in remain unverified.
- The owner reports that parent-to-student linking is currently unavailable; the precise live error still needs to be retested after the Worker and app are deployed.
- The safer default is for kiosk clock-in to fail visibly rather than bypass device proof and server-side validation. The existing fallback has not been removed because the live Worker and kiosk remain unverified.

### Initial local checks

| Command | Result |
|---|---|
| `npm test` | Pass — 76 files, 1,007 passed, 46 Firestore emulator tests skipped |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm run test:rules` | Fail — 42 passed, 4 failed; three Front Office allowed operations hit the Firestore 1,000-expression limit, and the parent class query was denied |

## Phase 1 — Reproducible rules-test command

The Firebase CLI was installed globally on the original machine, not declared in the project. The `test:rules` script now invokes pinned `firebase-tools@15.32.0` through `npx`, so a fresh checkout does not require a pre-installed global CLI. This avoids adding the CLI and its large dependency tree to every normal project install; running the command downloads the pinned CLI if it is not cached.

Run the actual Firestore rules tests with:

```sh
npm run test:rules
```

The Firestore emulator requires Java. Java 21 LTS was present and successfully started the emulator during this remediation; older Java versions have not been verified here.

## Phase 2 — H-01 rules expression budget

For payment creation, the old rules evaluated the caller's active profile and role through `isAdmin()` and `isFrontOffice()`, called branch checks for the payment and student, called a division helper that rechecked manager/Front Office role and division, and separately read the student role and profile for its branch. The student-summary update repeated the active-user/Front Office, branch, and division predicates for both the existing and resulting student record. A payment batch evaluates both writes.

The baseline call counts on the allowed Front Office path were:

| Operation | Top-level rule calls per affected write | Repeated checks inside helpers |
|---|---|---|
| Payment record | `isAdmin` 1, `isFrontOffice` 1, `isSameBranch` 2 (payment and student), `isDivisionAllowedForBranchStaff` 1, `roleOf(student)` 1, plus one explicit student `get` for branch | Each `isSameBranch` also evaluates `isAdmin` and `userBranch`; the division helper checks `isManager`, `isFrontOffice`, and `userDivision`. Both student role/branch reads target the same user document and can be cached. |
| Mark payment pending | Student update rule: `isAdmin` 1, `isFrontOffice` 1, `isSameBranch` 2 (before/after), `isDivisionAllowedForBranchStaff` 2 | Each branch helper also evaluates `isAdmin` and `userBranch`; each division helper rechecks manager/Front Office role and caller division. |
| Student status update | Same student update rule and counts as mark-payment-pending | The `status` field itself adds no extra authorization lookup; the shared user update predicates are what repeat. |

Firebase's current [access-call limits](https://firebase.google.com/docs/firestore/security/rules-conditions#access_call_limits) are 10 document access calls for a single-document/query request and 20 for a transaction or batch, with the 10-call limit also applying to each operation in a batch. Cached document calls do not count toward those limits. The remediation therefore reused a profile snapshot inside each rule evaluation while preserving all role, branch, division, and field restrictions.

The H-01 fix adds operation-specific helpers that read the caller profile once per rule evaluation, compare the payment/student branches against that profile, retain role/division restrictions, and use one student document read for its role and branch. Tests were added for kindergarten Front Office cross-division denial.

Intermediate emulator result before Phase 3: 47 passed, 1 failed. Payment recording, pending-payment update, student status update, cross-branch and wrong-role denials, and wrong-division cases passed. The remaining failure was the parent class query (INT-017), addressed in Phase 3 below.

The H-01 rules were deployed to Firebase project `mylibertyies-f2f38` with `firebase-tools@15.32.0 deploy --only firestore:rules --project mylibertyies-f2f38 --non-interactive`. Firebase confirmed the rules compiled and were released. The later Phase 3 rule changes, indexes, Hosting app, and Worker are not deployed; live rules therefore do not yet contain the complete local remediation.

## Phase 3 — Parent access lifecycle

The owner confirmed the plan's lifecycle decisions: Admin and the child's same-branch Front Office may manage links through the Worker; unlinking one child is retry-safe and preserves siblings; archived children lose parent access; deleting a student removes links; and unlinking blocks the parent's class, attendance, payment, report, and class-list reads.

The parent class query now includes the child's authoritative branch, and permission errors reach a visible error state instead of appearing as an empty schedule. Parent report list rules now use the same active-child predicate as direct reads. Parent links use the authenticated Worker with service-account writes and Firestore array transforms; deletion and archive cleanup remove only the selected child's ID from each parent. Archive/delete failures after one side of cleanup now report which part completed so the owner can safely retry.

Validation: `npm run test:rules` passes all 50 emulator tests, including the exact production parent class query, active/archive/unlink reads, and denied cross-branch, unlinked, or wrong-role cases. Focused parent repository and Worker endpoint tests pass. The class query's composite index is present locally but has not been deployed.

## Phase 4 — Worker hardening and shift state

Worker endpoint tests now cover each corporate-event audience (`all`, `branch`, `division`, and `role`) against the frontend eligibility helper, plus wrong branch/division/role, cancelled events, and an out-of-window event. The Worker recomputes eligibility from Firestore data and server time. Clock-out now checks that the staff profile, shift, and kiosk belong to the same explicitly assigned branch.

Clock-in creates the shift and active lock in one Firestore commit. Clock-out closes the shift and deletes the matching lock atomically. Class switch now updates the old shift, creates the new shift, and replaces the lock in one commit with update-time preconditions; stale writes fail without partial state, and a committed retry can return the same result using the transition nonce. The old unconditional recovery writes were removed. Worker tests cover normal, duplicate, concurrent, stale, failed-commit, and uncertain-response cases.

The kiosk's direct Firestore fallback (M-01) remains unchanged and gated on live confirmation of the Worker URL, service credentials, and a real kiosk clock-in. Worker deployment has not been attempted.

## Phase 5 — Cash reconciliation

The 200-payment fallback was removed. A missing required index now produces an explicit blocked reconciliation error, other permission/network failures propagate, the screen clears stale totals, displays the failure, and prevents ending the shift against incomplete totals. The required ascending composite indexes for branch/division/day queries are in `firestore.indexes.json`. They are local only and must be deployed before relying on affected production queries.

## Phase 6 — gRPC advisory

`npm ls @grpc/grpc-js --all --depth=10` found dependency paths through `firebase-admin` -> `@google-cloud/firestore` -> `google-gax` -> `@grpc/grpc-js@1.14.5`, and through the client `firebase` -> `@firebase/firestore` -> `@grpc/grpc-js@1.9.16`. Searches of the production `dist` output and Worker source/bundle found no gRPC server code or `@grpc/grpc-js` reference. The Worker is bundled with Wrangler and uses `jose`; its dry-run bundle completed at 106.37 KiB (22.02 KiB gzip). No dependency upgrade was made because this advisory dependency was not found in either shipped bundle.

## Phase 7 — CI gates

Both Firebase Hosting pull-request and merge workflows now install Temurin Java 21 and the locked Worker runtime dependency used by its endpoint tests, then run lint, typecheck, Firestore rules emulator tests, the full unit suite, and the frontend build before the Hosting action. Formatting checks were intentionally not added. These workflow changes have not yet run in GitHub Actions.

## Phase 8 — Targeted re-audit

- H-01 checks remain present; the full rules emulator suite passes, including wrong-branch, wrong-role, and wrong-division denials.
- Parent list and direct-read rules agree on active-child access; branch-scoped production query and unlink/archive/delete behavior are covered by emulator and repository tests.
- Shift changes use Firestore commit preconditions and atomic multi-write commits; tests show concurrent or stale class switches do not leave a second open shift or partially close the original.
- Worker event eligibility is recomputed using stored event/profile data and Worker server time, with parity tests against the existing frontend helper.
- Cash reconciliation no longer returns a quiet partial total when the required index is missing.
- Targeted implementation files were changed; the owner-provided audit, assessment, and plan documents were left unchanged.

Final local results: `npm test` — 1,039 passed, 50 emulator tests skipped in the non-emulator run; `npm run test:rules` — 50 passed; `npm run test:e2e` — 21 passed; `npm run lint`, `npm run typecheck`, and `npm run build` — passed; `npx wrangler deploy --dry-run` — Worker bundle succeeded. Live Firebase/Cloudflare state, deployed indexes, production kiosk behavior, and GitHub Actions remain unverified.

## Decisions and outstanding live checks

- Rules tests should block deploys (executor decision, following the plan recommendation).
- Archived-child access is revoked, as confirmed by the owner.
- Before deploying the local Phase 3/4 changes, deploy the Worker first, then deploy rules and indexes, then the Hosting app. The Worker needs `FIREBASE_SERVICE_ACCOUNT_EMAIL` and `FIREBASE_SERVICE_ACCOUNT_KEY` secrets configured in Cloudflare.
- Do not remove the kiosk fallback until the owner confirms the Worker is deployed, `VITE_AI_WORKER_URL` points to it, and a normal live kiosk clock-in succeeds.
- The owner still needs to retest Front Office payment recording and pending-payment updates with an available account, compare published Firestore rules with the repository, and share the exact live parent-link error if it persists.

### Owner's live checks

1. In Firebase Console, select project `mylibertyies-f2f38`, open **Firestore Database → Rules**, and compare the published rules with the repository's `firestore.rules`. The H-01 rules were deployed earlier, but Phase 3's parent-report rule change is local only, so do not assume the two copies currently match or deploy rules before coordinating the full release.
2. Sign in with a Front Office test account. On a test student, record a small payment, mark a payment pending, and change the student's status. Note which actions succeed and copy the exact error for any failure.
3. In Cloudflare Dashboard, open **Workers & Pages → myliberty-ai-proxy** and confirm a current deployment exists. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and confirm `VITE_AI_WORKER_URL` points to that Worker. Confirm the two Worker secrets are configured without copying or sharing their values.
4. At a normal kiosk, complete a real clock-in and report whether it succeeds. Do not test by disabling the Worker or changing production configuration.
5. After the coordinated Worker/rules/indexes/app deployment, retry parent linking and report the exact message if it still fails.
