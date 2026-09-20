# Staff Directives & Task System Modernization

This plan establishes an academy-wide **Staff Directives & Task Management System** across MYLIBERTY International English School. It fulfills the core operational principle: **every staff role takes directive orders from the Manager (and Admin), and each staff member can view, act on, and complete their assigned tasks directly within their portal.**

## User Review Required

> [!IMPORTANT]
> **Cross-Role Directives Visibility & Firestore Rules**:
> All active staff members (`instructor`, `marketing`, `frontoffice`, `officeboy`) will be granted read and completion-toggle access to their assigned directives in `firestore.rules`.
> Manager and Admin retain executive management privileges (create, update details, assign, delete).

> [!NOTE]
> **Instructor & Marketing Dashboard Navigation**:
> We will add a dedicated **"Directives"** tab to both the [InstructorDashboard.jsx](file:///e:/myliberty-portal/src/features/dashboard/InstructorDashboard.jsx) and [MarketingDashboard.jsx](file:///e:/myliberty-portal/src/features/dashboard/MarketingDashboard.jsx), accompanied by an active task count badge in their tab navigation bar so staff never miss urgent school mandates.

---

## Proposed Changes

Grouped by component layer:

### 1. Data Layer & Security Rules

#### [MODIFY] [firestore.rules](file:///e:/myliberty-portal/firestore.rules)
- Update `/todos/{todoId}` rules:
  - `allow read: if isStaff();`
  - `allow create, delete: if isAdmin() || isManager() || isFrontOffice();`
  - `allow update: if isStaff();` (enabling staff recipients to toggle completion status and timestamps, while restricting administrative edits to leadership).

#### [MODIFY] [todosRepository.js](file:///e:/myliberty-portal/src/features/staff/todosRepository.js)
- Extend `createTodo` to support `priority`, `dueDate`, `assigneeType` ("role" vs "individual"), `assigneeName`, `createdBy`, and `createdByName`.
- Add `toggleTodoComplete(todoId, completed, currentUser)` storing `completedAt`, `completedBy`, and `completedByName`.
- Add `updateTodo(todoId, updates)` for editing task details.
- Retain `deleteTodo(todoId)`.

---

### 2. UI Components & Shared Widgets

#### [NEW] [StaffDirectivesWidget.jsx](file:///e:/myliberty-portal/src/features/staff/StaffDirectivesWidget.jsx)
- A lightweight, responsive directives widget for staff portals (**Instructors**, **Marketing**, **Front Office**):
  - Automatically filters directives relevant to the logged-in user (`assignee === userRole || assignee === "all" || assignee === user.uid`).
  - Visual urgency badges (<span style="color:#e11d48;font-weight:bold">🚨 Overdue</span>, <span style="color:#d97706;font-weight:bold">⏰ Due Today</span>, <span style="color:#2563eb;font-weight:bold">📅 Due Soon</span>).
  - One-tap / checkbox completion toggle with completion attribution.
  - Collapsible "Completed" archive section.

#### [MODIFY] [TasksPanel.jsx](file:///e:/myliberty-portal/src/features/staff/TasksPanel.jsx)
- Redesign the administrative management view for **Admin** and **Manager**:
  - **Corkboard / Pinboard**: Clean visual cards for pinned notices (`isPinned: true`).
  - **Filter Bar**: Filter by status (Active / Completed / All), Department/Role (`All`, `Front Office`, `Instructors`, `Marketing`, `Office Boy`, `Individual`), Priority, and Search text.
  - **Comprehensive Directive Creator**:
    - Title / description input.
    - Type selector: Directive, Task, Deadline, Appointment.
    - Priority selector: Normal, High, Urgent.
    - Assignee selector: Any Department OR specific individual staff member from `users`.
    - Due Date picker.
    - Pin to Corkboard checkbox.
  - **List View**: Expanded, responsive card list replacing the cramped 192px box, with completion checkboxes, completion timestamps, and single-confirm deletion prompts.

---

### 3. Dashboard Integrations

#### [MODIFY] [InstructorDashboard.jsx](file:///e:/myliberty-portal/src/features/dashboard/InstructorDashboard.jsx)
- Add a `"directives"` tab labeled **"Directives"** rendering the `StaffDirectivesWidget`.
- Include active directive count badge on the tab item.

#### [MODIFY] [MarketingDashboard.jsx](file:///e:/myliberty-portal/src/features/dashboard/MarketingDashboard.jsx)
- Add a `"directives"` tab labeled **"Directives"** rendering the `StaffDirectivesWidget`.
- Include active directive count badge on the tab item.

#### [MODIFY] [OfficeBoyDashboard.jsx](file:///e:/myliberty-portal/src/features/dashboard/OfficeBoyDashboard.jsx)
- Update query to include tasks where `assignee in ["officeboy", "all"]` or matching user UID.
- Save `completedByName` and `completedAt` on task completion.

#### [MODIFY] [useDashboardData.js](file:///e:/myliberty-portal/src/features/dashboard/useDashboardData.js)
- Provide `handleToggleTodo` helper and single-confirm `handleDeleteTodo` with task title prompt.

#### [MODIFY] [AdminDashboard.jsx](file:///e:/myliberty-portal/src/features/dashboard/AdminDashboard.jsx) & [ManagerDashboard.jsx](file:///e:/myliberty-portal/src/features/dashboard/ManagerDashboard.jsx)
- Pass `users` and current user context to `TasksPanel`.
- Connect modernized toggle and delete handlers.

---

## Verification Plan

### Automated Checks
- `npm run lint` — verify zero ESLint errors/warnings.
- `npm run build` — verify successful production bundle compilation.

### Manual / Operational Flow Verification
1. **Manager Command**: Create a directive assigned to "Instructors" with Due Date and High Priority.
2. **Instructor Portal**: Log in as Instructor -> see badge in "Directives" tab -> open tab -> see directive -> click complete.
3. **Accountability**: Manager/Admin inspects task list -> verifies task shows as completed with instructor's name and timestamp.
4. **Office Boy & Marketing**: Verify Office Boy and Marketing portals receive directives and can complete them.
5. **Accidental Deletion Guard**: Click delete on a directive -> verify single confirmation modal displays the directive's title before proceeding.
