# My Liberty Portal — Available Batches Integration Roadmap

## Status

This roadmap defines how **Available Batches** should fit into the existing My Liberty Portal workflow.

> **Repository audit note:** the public GitHub repository `aymira-git/mylibertyportal-origin` could not be fetched from this environment. GitHub/raw endpoints returned cache/network failures and a direct `git clone` could not resolve GitHub. Therefore, this document intentionally does **not** invent exact file names, API routes, database schemas, or component locations. Those should be mapped against the repository once it is accessible locally.

---

## 1. Core decision

**Available Batches should not become a separate source of truth.**

The real source of truth should be the application's **Batch** records plus their **Enrollment** records.

Conceptually:

```text
Program / Course
       |
       v
     Batch
       |
       +---- Instructor
       +---- Room
       +---- Schedule
       +---- Capacity
       +---- Status
       |
       v
   Enrollment
       |
       v
    Student
```

`Available Batches` is then a filtered operational view of batches that are currently open for enrollment.

---

## 2. Role boundary — important

### Admin

Admin owns batch configuration and administrative control.

Admin can:

- Create batches
- Edit batch details
- Assign instructors
- Assign rooms
- Configure capacity
- Configure schedules
- Open / close batches
- Cancel batches
- View utilization
- Correct or override batch configuration when necessary

### Manager

**Managers must not inherit Admin batch-management permissions.**

In the current company workflow, managers are also instructors, so their portal permissions should remain operational/instructor-focused.

Manager can:

- View assigned batches
- View batch rosters
- Work with students in their assigned batches
- Perform instructor duties already allowed by the existing application
- Use attendance/instruction workflows

Manager cannot:

- Create a batch
- Edit batch configuration
- Assign/reassign instructors
- Assign/reassign rooms
- Change capacity
- Change the official schedule
- Open/close/cancel a batch
- Modify administrative batch settings
- View admin-only utilization/configuration controls unless separately granted by an explicit future permission

### Front Office

Front Office is the operational enrollment role.

Front Office can:

- View Available Batches
- Search/filter available batches
- View remaining capacity
- Enroll a student into a batch
- View enrollment status
- Transfer a student according to existing business rules

Front Office should **not** manage batch configuration.

### Instructor

Instructor can:

- See their assigned batches
- See enrolled students
- Use attendance workflow
- See relevant batch schedule/room information

Instructor should not be able to alter official batch configuration.

### Student

Student-facing access should be limited to what the product actually exposes today.

Possible future use:

- View current enrollment
- Request enrollment/change
- Browse available batches if the product later supports self-service enrollment

Do not add self-service enrollment automatically unless the existing product requirements call for it.

---

## 3. What “Available Batches” means

A batch is **available** when its business rules say that a new enrollment can be accepted.

Recommended baseline rules:

```text
batch.status == OPEN
AND active_enrollment_count < capacity
AND batch is not cancelled
AND batch is not completed
```

The UI should derive availability from the underlying data instead of maintaining an independent `available` flag unless there is a proven domain need for one.

Example:

```text
Capacity: 15
Active enrollments: 12
Remaining seats: 3
Status: OPEN

=> Available
```

When the last seat is taken:

```text
Capacity: 15
Active enrollments: 15
Remaining seats: 0
Status: OPEN

=> FULL / not selectable
```

---

## 4. Recommended batch lifecycle

Use a small, explicit lifecycle.

```text
DRAFT
  |
  v
OPEN
  |
  +----> FULL
  |
  v
ONGOING
  |
  v
COMPLETED
```

Cancellation can happen from an appropriate pre-completion state:

```text
DRAFT / OPEN / possibly ONGOING
            |
            v
       CANCELLED
```

Exact transitions should match the business rules already present in the application.

### Why this matters

The lifecycle gives Available Batches a clean definition:

```text
Available Batches = batches that are OPEN and have remaining capacity
```

No duplicated state is necessary.

---

## 5. Integration into the existing workflow

The intended end-to-end flow should be:

```text
ADMIN
  |
  | creates/configures batch
  v
BATCH
  |
  | status = OPEN
  v
AVAILABLE BATCHES
  |
  | Front Office chooses a batch
  v
ENROLLMENT
  |
  | student -> batch relationship
  v
BATCH ROSTER
  |
  +-------------------+
  |                   |
  v                   v
INSTRUCTOR         ATTENDANCE
  |                   |
  +---------+---------+
            |
            v
         STUDENT
```

The key design decision is that **Enrollment connects the student to the batch**.

Do not make the Available Batches page directly manipulate unrelated student fields unless the existing schema requires it.

---

## 6. Enrollment should be the bridge

The preferred relationship is:

```text
Student
  |
  +---- Enrollment ----> Batch
```

This allows the system to support:

- Current batch
- Previous batch history
- Future enrollment
- Transfers
- Enrollment status
- Enrollment dates
- Multiple historical enrollments

It is safer than treating a student's `batch_id` as the only permanent representation of their batch history.

### Important constraint

The app should prevent invalid duplicate active enrollments according to the business rules.

For example:

```text
Same student
+ same batch
+ active enrollment

=> reject duplicate enrollment
```

Exact uniqueness rules must follow the application's existing data model.

---

## 7. Available Batches UI

The feature should answer one operational question:

> “Which batches can this student be enrolled into right now?”

Recommended card/table information:

```text
Batch Name
Course / Program
Instructor
Schedule
Room
Capacity
Enrolled / Capacity
Remaining Seats
Status
Action
```

Example:

```text
English Intermediate
Mon & Wed · 17:00–18:30
Instructor: John
Room: A2
12 / 15 enrolled
3 seats remaining

[ Enroll ]
```

Full batch:

```text
15 / 15 enrolled
0 seats remaining

[ FULL ]
```

The UI should not rely on visual hiding alone for authorization. The backend/business layer must also enforce enrollment eligibility.

---

## 8. Recommended frontend behavior

### Available Batches page

The page should:

- Load only enrollable batches
- Support useful search/filtering
- Show capacity clearly
- Disable enrollment for full/unavailable batches
- Preserve existing app navigation/layout conventions
- Reuse existing design-system components where possible

### Enrollment action

Preferred flow:

```text
Available Batches
      |
      v
Select Batch
      |
      v
Select / identify Student
      |
      v
Confirm Enrollment
      |
      v
Create Enrollment
      |
      v
Refresh availability + roster
```

After a successful enrollment, the available-seat count should update immediately or after a fresh data fetch.

---

## 9. Authorization model

This part is critical because the Manager/Admin distinction must survive beyond the UI.

### Frontend

Hide admin-only actions from Manager accounts.

Example conceptually:

```ts
if (role === 'admin') {
  // show batch configuration controls
}
```

But frontend checks are only for UX.

### Backend / server-side enforcement

Every protected batch mutation must independently verify authorization.

Examples:

```text
POST   create batch          -> ADMIN only
PATCH  edit batch            -> ADMIN only
PATCH  assign instructor    -> ADMIN only
PATCH  assign room          -> ADMIN only
PATCH  capacity             -> ADMIN only
PATCH  schedule             -> ADMIN only
PATCH  status/configuration -> ADMIN only
```

Operational reads/actions can be broader:

```text
GET assigned batches        -> MANAGER / INSTRUCTOR as appropriate
GET available batches       -> FRONT OFFICE / permitted operational roles
POST enrollment             -> FRONT OFFICE / permitted enrollment roles
GET roster                  -> assigned instructor / permitted staff
attendance actions          -> instructor workflow already defined by app
```

Exact route names should be mapped to the repository once available.

---

## 10. Do not duplicate batch truth

Avoid creating separate competing fields such as:

```text
batches.is_available
batches.status
available_batches.status
available_batches.remaining_seats
```

when those values can be derived.

Prefer:

```text
Batch
  - status
  - capacity

Enrollment
  - active/inactive state

Available Batches view
  - derives remaining seats
  - derives available/full state
```

This reduces synchronization bugs.

---

## 11. Utilization belongs to Admin

Utilization is an administrative/reporting concern.

Examples:

```text
Batch capacity      15
Active enrollments  12
Utilization         80%
Remaining seats      3
```

Potential future metrics:

- Capacity utilization by batch
- Utilization by instructor
- Enrollment growth
- Full-batch count
- Empty/underfilled batches
- Historical enrollment trends

Managers should not receive these administrative configuration controls merely because they are instructors.

A future reporting permission could be introduced separately if the company needs managers to see selected analytics.

---

## 12. Attendance integration

Attendance should resolve through the student's active enrollment/batch context.

Conceptually:

```text
Student badge / student identity
          |
          v
Student record
          |
          v
Active enrollment
          |
          v
Batch
          |
          v
Today's session
          |
          v
Attendance record
```

This keeps the batch system meaningful to the rest of the portal rather than making it a standalone enrollment page.

This also aligns with the existing kiosk responsibility rule:

```text
ADMIN        -> staff badge scanning where required
FRONT OFFICE  -> student badge workflow
INSTRUCTOR    -> instructor workflow
STUDENT       -> student-facing attendance interaction
```

Keep those role boundaries explicit while integrating batches.

---

## 13. Implementation phases

### Phase 0 — Repository mapping

Once the repository is accessible locally:

- Locate `src/features/available-batches`
- Identify the current Batch model/type
- Identify Enrollment model/type
- Identify Student model/type
- Identify role/permission definitions
- Identify existing API/server actions/hooks
- Identify existing batch-management screens
- Identify current attendance/kiosk data path
- Identify current dashboard navigation

Deliverable:

```text
Feature -> data model -> API -> permission -> UI -> downstream usage
```

Do not refactor anything yet.

---

### Phase 1 — Establish source of truth

Verify whether Batch and Enrollment already exist.

If they do:

- Reuse them
- Do not introduce duplicate models
- Add only missing fields/relationships

If they do not:

- Define the minimum batch domain model
- Define enrollment relationship
- Keep the schema as small as possible

Deliverable:

```text
Batch
Enrollment
Student relationship
```

---

### Phase 2 — Lock down RBAC

Define explicit permissions.

Minimum split:

```text
ADMIN
MANAGER / INSTRUCTOR
FRONT OFFICE
```

Admin-only batch mutations should be enforced server-side.

Remove accidental Manager access inherited from broad role checks.

Deliverable:

```text
Admin -> batch administration
Manager -> instructor operations
Front Office -> enrollment operations
```

---

### Phase 3 — Make Available Batches a derived view

Implement the availability query/filter.

Conceptually:

```text
OPEN batches
+
remaining capacity
+
valid enrollment window
=
Available Batches
```

Deliverable:

A reliable list of batches that can actually accept enrollment.

---

### Phase 4 — Integrate enrollment

Connect the Available Batches action to the existing enrollment workflow.

Requirements:

- Choose student
- Choose batch
- Validate eligibility
- Prevent duplicate/invalid enrollment
- Create enrollment
- Recalculate availability
- Update roster

Deliverable:

```text
Available Batch -> Enrollment -> Roster
```

---

### Phase 5 — Integrate instructor workflow

Ensure instructors/managers see only batches assigned to them, unless existing requirements explicitly allow broader visibility.

They should consume batch data rather than modify batch configuration.

Deliverable:

```text
Manager/Instructor dashboard
        |
        v
Assigned batches
        |
        v
Roster + attendance
```

---

### Phase 6 — Integrate attendance/kiosk context

Verify that attendance can resolve the student's current active batch/session where required.

Do not duplicate enrollment state inside attendance.

Deliverable:

```text
Student -> active enrollment -> batch -> session -> attendance
```

---

### Phase 7 — Admin utilization/reporting

Add admin-facing utilization views only after the underlying batch/enrollment data is stable.

Deliverable:

```text
Admin
  -> batch utilization
  -> occupancy
  -> remaining capacity
```

---

### Phase 8 — Validation and regression testing

Run at minimum:

```text
Admin
  create batch       PASS
  edit batch         PASS
  assign instructor  PASS
  change room        PASS
  change capacity    PASS
  change schedule    PASS

Manager
  view assigned      PASS
  attendance         PASS
  create batch       DENIED
  edit batch         DENIED
  assign instructor  DENIED
  change capacity    DENIED

Front Office
  view available     PASS
  enroll student     PASS
  cannot configure batch   DENIED

Availability
  open + seats       AVAILABLE
  full               NOT AVAILABLE
  cancelled          NOT AVAILABLE
  completed          NOT AVAILABLE
```

Then run the repository's existing validation commands (for example lint/build/type checks if those are already configured).

---

## 14. Recommended implementation order

Do not build everything at once.

Use this order:

```text
1. Map current repo
2. Confirm Batch + Enrollment data model
3. Lock Admin vs Manager permissions
4. Make Available Batches a derived query/view
5. Connect enrollment
6. Connect assigned-batch instructor view
7. Connect attendance/session context
8. Add Admin utilization
9. Test RBAC + availability edge cases
10. Run lint/build/tests
```

The most important dependency is:

```text
RBAC + data model
       ↓
availability
       ↓
enrollment
       ↓
instructor/attendance integration
       ↓
reporting
```

Do not start with the dashboard UI.

---

## 15. Definition of done

The Available Batches feature is considered properly integrated when:

- There is one authoritative Batch dataset.
- Enrollment is the bridge between Students and Batches.
- Available Batches is derived from real batch/enrollment state.
- Full/cancelled/completed batches cannot be enrolled into.
- Front Office can enroll students through the feature.
- Enrollment updates availability and the batch roster.
- Managers can operate as instructors without inheriting Admin batch-management privileges.
- Only Admin can configure batches.
- Attendance can use the student's active batch/session context where required.
- Admin can inspect utilization.
- UI restrictions are backed by server-side authorization.
- Existing lint/build/tests continue to pass.

---

## 16. Architectural principle to keep

> **Batch configuration is administrative. Batch participation is operational.**

That distinction should drive the implementation:

```text
ADMIN
  owns the batch

FRONT OFFICE
  manages enrollment into the batch

MANAGER / INSTRUCTOR
  operates the batch

STUDENT
  participates in the batch
```

This keeps the feature aligned with the actual company workflow and prevents the role model from becoming ambiguous later.
