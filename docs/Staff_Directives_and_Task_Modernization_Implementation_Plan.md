# Staff Directives & Task System Modernization — Implementation Plan (Revision 2)

This plan establishes a role-wide **Staff Directives & Task Management System** for MYLIBERTY International English School. Core principle: **staff roles take directives from the Manager (and Admin), and each staff member can see, act on, and complete their own directives inside their portal.**

> **How to read this revision.** Revision 1 (the uploaded plan) is kept in spirit. Revision 2 adds findings from checking that plan against the current zip (`firestore.rules`, `todosRepository.js`, `TasksPanel.jsx`, `useDashboardData.js`, `ManagerDashboard.jsx`, `OfficeBoyDashboard.jsx`, `App.jsx`, `WelcomeBanner.jsx`).
> The auditor is an AI and can be wrong. Every finding below has file evidence so the executing agent can verify it, and every "current stance" is an opening position. Counter-proposals with reasons are welcome, from the executing agent and from Kifry alike.

---

## 1. Audit Findings (verify, then argue or adopt)

Severity: **A** = would break or weaken the feature as written, **B** = likely rework or a gap, **C** = polish.

| # | Sev | Finding | Evidence | Suggested direction (open to challenge) |
|---|-----|---------|----------|------------------------------------------|
| F1 | A | Rule `update: isStaff()` lets any staff member change any field of any directive (rewrite text, reassign, un-complete a colleague's task, forge `completedBy`). Rules cannot restrict "only the completion fields" unless written to. | Plan §3A vs. Firestore rules semantics | Recipients update only completion fields via `affectedKeys().hasOnly([...])` and only on directives addressed to them (sketch in §4A). |
| F2 | A | **Broadcast completion is ambiguous.** One directive to "Instructors" has a single `completed` flag, so the first teacher to tap it completes it for every teacher. That suits chores ("clean room 3") but not personal deliverables ("everyone submit syllabus by Friday"). | Plan §2 schema (`completed`, `completedBy` are single values) | Add a completion mode (see §3). Stance: per-person for `instructor` / `marketing` / `all`, shared for `officeboy` / `frontoffice` / individual. |
| F3 | A | `useDashboardData.handleAddTodo` destructures only `{ text, type, isPinned, assignee }`, so `priority`, `dueDate`, `assigneeType`, `createdBy` would be silently dropped even after `createTodo` is upgraded. The plan omits this file (the repo copy in `docs/` includes it). | `useDashboardData.js` ~L255–259 | Pass the whole object through, and inject creator info in one place (see §4B). |
| F4 | A | Rules are not deployed by CI; the GitHub workflow only builds and deploys hosting. New UI shipped before new rules gives staff "permission denied". | `.github/workflows/firebase-hosting-merge.yml`; the Manager dashboard already shows a "deploy the updated rules" banner | Deploy rules first (they are backward compatible, see §6). Give Kifry a copy-paste path via Firebase Console → Firestore → Rules. |
| F5 | B | Office Boy currently queries `assignee == "officeboy"` only, so "Everyone" directives never reach them today. Rule `update` also allows Office Boy only for `['officeboy','all']`, so UID-targeted directives would fail. | `OfficeBoyDashboard.jsx` L14; `firestore.rules` L112 | One shared query for all recipient roles: `where("assignee","in",[role,"all",uid])`. Plan §3E6 already points this way. |
| F6 | B | Manager dashboard owns a separate `todos` listener plus a "local-" fallback (`local-…` ids kept in state when Firestore denies). Toggling or editing a `local-` item would call Firestore with an id that does not exist. | `ManagerDashboard.jsx` ~L898–995 | Route Manager through the shared todos handlers and retire the local fallback once rules are deployed (or keep it but block toggle/edit on `local-` ids). |
| F7 | B | Completion attribution `currentUser.displayName \|\| currentUser.email` will often record the email: the profile name lives in the `users` document (`nickname` / `displayName` / `firstName`), not always in Firebase Auth. | `WelcomeBanner.jsx` L23–37 | Resolve the name from the `users` doc once (small shared helper or hook) and reuse it for `createdByName` and `completedByName`. |
| F8 | B | Individual-staff picker reads `users`, but rules let Front Office read only `student` and `instructor` profiles. Front Office would not see Marketing or Office Boy individuals. | `firestore.rules` `/users` read rule | Front Office assigns by role (which covers the "chores to Office Boy" case); individual picker for Admin/Manager. Alternatively widen the read rule for a minimal staff list. |
| F9 | B | `read: isStaff()` exposes every directive (including one-to-one ones) to every staff member, and every portal would subscribe to the whole `/todos` collection, which grows as completed items pile up. | Plan §3A; `useDashboardData.js` L85 | Targeted read rule plus the same `in` query (sketch in §4A). Simple `isStaff()` remains a valid choice if privacy between staff is not a concern; see Open Question Q2. |
| F10 | B | Front Office role is described three ways: takes orders (§1), creates/deletes (§3A), "widget or tailored panel" (§3E3). Today it has full create/delete/update on all todos, including Manager's. | Plan §1, §3A, §3E3; `firestore.rules` L112–113 | Pick a stance in Q1. Stance: Front Office creates directives for Office Boy, edits/deletes only its own, and also receives directives via the widget. |
| F11 | B | Staff status ripple: individual directives to someone who later resigns or is terminated stay orphaned (App.jsx blocks their login). On-leave staff still get badges. | `App.jsx` L88–89, L135–136; existing status-lifecycle audit | Picker lists active staff only; Manager view flags directives whose assignee is no longer active so they can be reassigned. |
| F12 | C | Badge says "unread / incomplete" but the schema has no read-tracking. | Plan §3E4 | Badge = count of incomplete directives for that user. Read-tracking can wait. |
| F13 | C | Legacy `/todos` documents lack `priority`, `assigneeType`, `createdBy`, `dueDate`. | `todosRepository.js` current fields | UI treats missing fields as `priority: "normal"`, `assigneeType: "role"`; no data migration needed. |
| F14 | C | Due-date buckets (Overdue / Due Today / Due Soon) should use school time, not the device clock. A WITA constant already exists. | `attendance/shiftStatus.js` `WITA_TIMEZONE = "Asia/Makassar"` | Reuse that constant for "today". |
| F15 | C | New helpers and the widget need exporting from the feature barrel; hooks/constants in separate `.js` files satisfy the `react-refresh/only-export-components` lint rule used in this repo. | `staff/index.js` exports only `createTodo`, `deleteTodo` | Export `toggleTodoComplete`, `updateTodo`, `StaffDirectivesWidget`; keep constants/hooks in `.js` files. |
| F16 | C | Delete confirmation should reuse the project's `useConfirm` modal (native dialogs are being phased out). | Overview: shared UI kit | Show the directive title in the `useConfirm` message. |

---

## 2. Operational Goals (unchanged from Revision 1)

1. **Manager & Admin command**: issue directives with type, priority, due date, and a target (department or individual).
2. **Every role receives**: Instructors (pedagogy/grading/syllabus), Marketing (campaigns/outreach/leads), Front Office (reception/admissions), Office Boy (campus readiness/supplies), Everyone (school-wide notices).
3. **Complete lifecycle**: one tap to complete, with who and when recorded; finished items are archived in a collapsible section.
4. **Rules alignment**: recipients read what is addressed to them and complete it without permission errors.

---

## 3. Core Data Schema: `/todos/{todoId}`

Revision 1 fields are kept. New or changed fields are marked ★.

```typescript
interface TodoDirective {
  id: string;
  text: string;
  type: "directive" | "task" | "deadline" | "appointment";
  priority: "urgent" | "high" | "normal";      // legacy docs: treat missing as "normal"
  isPinned: boolean;

  // Assignment
  assignee: string;                            // "all" | "frontoffice" | "instructor" | "marketing" | "officeboy" | staff UID
  assigneeType: "role" | "individual";          // legacy docs: treat missing as "role"
  assigneeName?: string;

  // Time
  dueDate?: string | null;                     // YYYY-MM-DD, compared against school time (WITA)

  // ★ Completion model (see Q3)
  completionMode?: "shared" | "each";          // missing = "shared" (matches today's behavior)

  // shared mode: one completion for the whole directive
  completed: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
  completedByName?: string | null;

  // ★ each mode: one entry per recipient, keyed by UID
  completions?: {
    [uid: string]: { at: string; name: string };
  };

  // Creation metadata
  createdAt: string;
  createdBy: string;                           // UID; rules can require it equals request.auth.uid
  createdByName: string;
  branch?: string;
}
```

Notes for the executing agent:
- In `each` mode, "how many have completed" for a role broadcast needs the roster of active staff in that role; Manager's view can compute it from `users` (Admin/Manager can read all profiles).
- If `each` mode feels heavy for a first release, a lighter path is to ship `shared` only and let Manager use individual assignment for personal deliverables. Both paths fit this schema.

---

## 4. Detailed Changes by Component

### A. Firestore Security Rules (`firestore.rules`) — sketch, needs testing

Auditor's sketch (syntax and behavior of `in` queries against these conditions should be verified in the Rules Playground or emulator, since this was not run):

```
function isRecipient(data) {
  return data.assignee in ['all', userProfile().role, request.auth.uid];
}

match /todos/{todoId} {
  allow read: if isAdmin() || isManager() || isFrontOffice()
              || (isStaff() && isRecipient(resource.data));

  allow create: if (isAdmin() || isManager() || isFrontOffice())
                && request.resource.data.createdBy == request.auth.uid;

  allow update: if isAdmin() || isManager()
                || (isFrontOffice() && resource.data.createdBy == request.auth.uid)
                || (isStaff() && isRecipient(resource.data)
                    && request.resource.data.diff(resource.data).affectedKeys()
                         .hasOnly(['completed','completedAt','completedBy','completedByName','completions']));

  allow delete: if isAdmin() || isManager()
                || (isFrontOffice() && resource.data.createdBy == request.auth.uid);
}
```

Points worth arguing about:
- For `each` mode, a tighter check can require that only the caller's own key changes inside `completions`.
- Legacy documents have no `createdBy`, so Front Office cannot edit or delete them under this sketch; Admin/Manager can. This may be desirable or annoying.
- If per-staff privacy is not wanted, `read: if isStaff()` is simpler (Q2).

### B. Domain Repository (`src/features/staff/todosRepository.js`)
- `createTodo(data)`: writes the normalized directive with defaults (`completed: false`, `createdAt`, `priority: data.priority || "normal"`, `assigneeType`, `branch: data.branch || "Cabang Utama"`). Accepts the full object, so nothing is dropped on the way in (F3).
- `toggleTodoComplete(todoId, completed, actor)`: `actor` carries `uid` and a resolved display name (F7). Shared mode updates the four completion fields; each mode updates only `completions.<uid>`.
- `updateTodo(todoId, fields)`: title, due date, priority, assignee.
- `deleteTodo(todoId)`: unchanged.
- One small helper resolves the acting user's name from the `users` doc (F7).

### C. `useDashboardData.js`
- `handleAddTodo` passes the whole payload through and adds `createdBy` / `createdByName` (F3).
- Add `handleToggleTodo` and `handleUpdateTodo`.
- `handleDeleteTodo` asks for confirmation with the directive title using `useConfirm` (F16).

### D. Reusable Directives Component (`src/features/staff/StaffDirectivesWidget.jsx` — NEW)
For Instructors, Marketing, Front Office (received directives):
- Subscribes with `where("assignee","in",[role,"all",uid])` (F5, F9); no client-side filtering of the entire collection.
- Urgent banner, due buckets (Overdue / Due Today / Due Soon) computed in WITA (F14).
- One-tap completion; collapsible "Completed" section.
- Tolerates legacy documents (F13).
- Badge count = incomplete directives for the user (F12).

### E. Upgraded Management Panel (`src/features/staff/TasksPanel.jsx`)
For Admin and Manager (Front Office gets a reduced version, see Q1):
- Corkboard for pinned / urgent items (keep the current rule that `deadline` type also appears there unless there is a reason to change it).
- Filters: status, department/role, priority, search.
- Creator form: title, type, priority, assignee (department, or an active individual from `users`, F8, F11), due date, pin, completion mode (Q3).
- List: responsive cards with completion state, who/when, and `useConfirm` delete.
- Replaces the `max-h-48` box.
- Flags directives whose individual assignee is no longer active (F11).

### F. Portal Integrations
1. **Manager Dashboard**: swap in the upgraded panel; move onto the shared todos handlers and retire or guard the local fallback (F6). Keep the department breakdown.
2. **Admin Dashboard**: upgraded panel with full permissions; pass `users` and acting-user info.
3. **Front Office Dashboard**: receives directives via the widget and creates chores for Office Boy (Q1).
4. **Instructor Dashboard**: "Directives" tab + badge.
5. **Marketing Dashboard**: "Directives" tab + badge.
6. **Office Boy Dashboard**: shared `in` query; keeps the large tap-to-complete button; records `completedBy` / `completedByName` / `completedAt` (today only `completedAt` is saved).
7. `staff/index.js` exports the new pieces (F15).

---

## 5. Rollout Order (suggested)

1. Publish the new `firestore.rules` first (Firebase Console → Firestore → Rules, or `firebase deploy --only firestore:rules`). The sketch in §4A still accepts today's Office Boy completion write (`completed`, `completedAt` on `officeboy` tasks), so the current app keeps working.
2. Ship repository + hook changes (§4B, §4C).
3. Ship `TasksPanel` + Admin/Manager integration.
4. Ship the widget and the Instructor / Marketing / Front Office tabs, then the Office Boy query update.

If the executing agent sees a safer ordering, that is fine; the main constraint from F4 is that rules and UI reach production close together.

---

## 6. Verification Plan

**Static**
- `npm run lint` — 0 errors, 0 warnings.
- `npm run build` — clean Vite build.

**Lifecycle**
1. Manager creates a High-priority directive for "Instructors" with a due date; Instructor sees the badge, opens the tab, completes it; Manager sees who and when.
2. Office Boy sees `officeboy` and `all` directives and directives addressed to their UID; completion records name and time.
3. Marketing sees `marketing` directives.
4. Pinned items show on the Corkboard; delete shows a `useConfirm` with the title.
5. Legacy todos (no priority / assigneeType) still render.

**Rules matrix** (Firebase Console → Rules Playground is free and needs no code; the executing agent can also script the emulator):

| Actor | Action | Expected |
|-------|--------|----------|
| Instructor | Complete a directive for `instructor` | Allowed |
| Instructor | Edit the `text` of that directive | Denied |
| Instructor | Complete a directive for `marketing` | Denied |
| Instructor | Read a directive for another individual | Denied (if targeted read chosen) |
| Office Boy | Complete a directive for their UID | Allowed |
| Front Office | Delete a directive created by Manager | Denied (if stance in Q1 holds) |
| Manager / Admin | Create, edit, delete any directive | Allowed |
| Resigned / terminated user | Any access | Blocked at login by `App.jsx`; confirm rules also behave sensibly if a session is still open |

---

## 7. Open Questions (current stance + reason; all open to challenge)

| # | Question | Current stance | Reason | What would change the stance |
|---|----------|----------------|--------|-------------------------------|
| Q1 | What can Front Office do with directives? | Receives via widget; creates directives for Office Boy; edits/deletes only its own | Matches the "front desk assigns daily chores" idea while keeping Manager's directives safe | Kifry wanting Front Office to see or manage everything |
| Q2 | Should staff see only directives addressed to them? | Yes (targeted read) | One-to-one directives can be sensitive; fewer reads as data grows | If school culture prefers open visibility, `isStaff()` read is simpler and acceptable |
| Q3 | Broadcast completion: shared or per-person? | Per-person (`each`) for `instructor` / `marketing` / `all`; shared for `officeboy` / `frontoffice` / individual | Personal deliverables need personal accountability; chores need one owner | Small team sizes, or a first release that prefers less complexity (ship `shared` only) |
| Q4 | Should Manager and Admin also be recipients? | Not in this release | Plan's audience is the five staff roles; adding roles later is additive | Kifry wanting Admin-to-Manager directives |
| Q5 | Retention of completed directives | Show recent items, and archive or limit older completed ones after a period chosen with Kifry (e.g. 30–60 days) | Keeps listeners light | Reporting needs that want full history in the UI |
| Q6 | Manager's local fallback | Retire it once rules are live | It masked permission errors and cannot toggle/edit safely | Kifry wanting offline-style drafts for Manager |

For Kifry: nothing here needs a decision today. If the executing agent and you agree on different answers to Q1–Q6, update this table and continue.
