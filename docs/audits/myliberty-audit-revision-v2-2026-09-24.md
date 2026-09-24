# MyLiberty Portal — Revised Plan v2 (replaces my earlier revision)

**For:** the executing coding agent. **From:** Claude (auditor), for Kifry.
**Inputs:** the agent's reconciled audit (commit `1c9c771…`) and the real `firestore.rules` downloaded directly from `raw.githubusercontent.com` at both `1c9c771…` and `main`.

> Claude is AI and can make mistakes. This plan, the audit, and the agent's reconciliation are all open to checking. Please argue with any item where the code tells a different story. Kifry has no coding background and no budget, so plain-language explanations and free tools are preferred.

## 0. Correction from me

My earlier revision said the live rules had no branch checks. That was wrong. I had read a stale GitHub web page (252 lines). The raw file at `1c9c771…` and at `main` is 268 lines, byte-identical, and contains `userBranch()`, `isSameBranch()` and `/approvals`. The agent's reconciliation is right on that point, and my earlier "Step 0 / status table" no longer applies. Everything below is based on the real file.

## 1. What I re-verified in the real rules (line numbers refer to the 268-line file)

| Item | Result |
|---|---|
| CRIT-01 invite binding (L60-65, L72-77) | **Confirmed.** Invite checks email, role, expiry. The self-created profile can carry any `branchId`, and a profile with no `branchId` is treated as `kota_gorontalo` (L35-39). Role escalation to admin is blocked; branch assignment is not. |
| CRIT-02 Front Office student update (L79-80) | **Confirmed.** Branch is checked on the *old* document only, no field list, so `branchId` can be rewritten to move a student. |
| CRIT-03 shifts (L173-188) | **Confirmed.** Create has no branch check on the target user; update has no branch check and no field list. |
| HIGH-01 outreach visits (L253-261) | **Confirmed.** Child `visits` rules check role only, no branch. |
| HIGH-03 broad reads | **Confirmed.** `classes`, `attendance`, `progressReports` (L108, L129, L159) are not branch-scoped. May be intended; a decision for Kifry. |
| HIGH-07 errorLogs (L231-237) | **Confirmed.** |
| P0 #6 approvals (L150-157) | **Confirmed.** `create: isStaff()` with no check that `requestedByUid` is the caller or that status starts `pending`; manager `update` has no field list, so requester fields and status are editable. |

### New items I found that the audit does not list

1. **Update rules that only look at the new data.** `payments` update (L141) and `deskInquiries` update (L146) check `isSameBranch(request.resource.data)`, not `resource.data`. A Front Office user in branch A may be able to rewrite a branch-B record so that it becomes branch A. Suggest checking both old and new data, and making `branchId` unchangeable after creation.
2. **Silent fail-open default.** `isSameBranch()` (L41-46) maps any unknown or misspelled `branch` value to `kota_gorontalo`. A typo in a Limboto document quietly makes it a Kota Gorontalo document. Worth replacing with an explicit "branchId must exist and be valid" once data is backfilled.
3. **Likely query trap (needs an Emulator test to confirm).** The ternary fallback in `isSameBranch()` may be too complex for Firestore to prove against a plain `where('branchId','==',…)` query, so adding the `where` alone could still return `PERMISSION_DENIED`. A simpler rule after backfill (`resource.data.branchId == userProfile().branchId`) is the usual shape that queries can satisfy.
4. **Legacy documents vanish from filtered queries.** `where('branchId','==','kota_gorontalo')` skips documents that have no `branchId` field. Backfill has to come before the query change, or old students, payments and applications will disappear from dashboards.
5. **Possible role gap.** Attendance create (L132) uses `hasRole('instructor')`, while other rules also include `instructorleader` / `instructor_leader`. Worth confirming whether instructor leaders scan students.
6. **Payments have no edit/delete trail** (unchanged from my earlier note). Front Office handles all cash, so an append-only payment log similar to `shiftAuditEvents` may be worth proposing.

## 2. Suggested order (open to challenge)

The order below tries to avoid breaking the live app while it is being hardened.

1. **Safety net first.** Add Firestore Emulator rules tests (free: Firebase Emulator Suite + `@firebase/rules-unit-testing`). A small role x branch matrix for `users`, `payments`, `applications`, `shifts`, `approvals`, `visits`. This also settles item 3 above with evidence.
2. **Check real data.** Count documents per collection with no `branchId`, or with a `branch` value the rules do not recognise. Report the numbers in plain language to Kifry.
3. **Backfill `branchId`** on all branch-scoped collections. The agent chooses the safest delivery for a non-coder (for example a one-time admin-only script Kifry can run with copy-paste steps, or a guided screen). Keep a way to undo.
4. **Simplify `isSameBranch()`** to require a valid `branchId`, and remove the silent default once step 3 is verified.
5. **Move branch-scoped queries to `where('branchId','==',…)`** (users, applications, payments, outreach, visits, shifts, reports), check indexes in `firestore.indexes.json`, and verify against the Emulator before deploying rules.
6. **Rule hardening**, one small PR each, after checking which fields the UI truly writes:
   - Front Office student update: field list, `branchId` unchangeable.
   - Shifts: branch check on create and update, field list for kiosk clock-out.
   - Invite: bind `branchId`, `division`, `status`.
   - Payments / deskInquiries updates: check old and new branch.
   - Approvals: `requestedByUid == auth.uid`, `status == 'pending'` on create, requester fields unchangeable, field list for manager update.
   - Outreach visits: inherit the parent school's branch.
   - errorLogs: size and type caps; drop email/full URL if not needed.
7. **Verification items** the audit already lists as unproven: attendance repeated-scan path, parent portal for signed-out visitors, Cloudinary preset limits, Firebase App Check.
8. **Cost and hygiene** (free where possible): commit `package-lock.json` and use `npm ci`; enable Dependabot and CodeQL (free on public repos); AI per-user rate limit (check current free Cloudflare options); Cloudinary preset limits via dashboard with plain-language steps for Kifry.

## 3. Style notes

- Please give Kifry one or two sentences per change: what it protects, and what could break.
- Small PRs make any single change easy to undo.
- The severity labels in the audit are judgement calls. If the agent thinks an item deserves a different priority, say so with the reason.
- The audit states the CI runs were green; I did not check them.

## 4. Questions for the agent

1. Does the Emulator confirm or refute item 3 (query trap)? If refuted, step 4 could shrink.
2. How many live documents lack `branchId`, per collection?
3. Which fields do the Front Office student and shift screens actually write?
4. Should `classes`, `attendance` and `progressReports` be company-wide or branch-scoped? (Kifry's current stance: managers want branch-scoped daily cash totals; Admin is the company-wide tier. Open to challenge.)
5. Is there a simpler path than the one above for any step?
