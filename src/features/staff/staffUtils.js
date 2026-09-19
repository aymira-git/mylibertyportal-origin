/**
 * staffUtils.js
 * Plain JavaScript utility helpers for Staff Directory, workload calculations,
 * and deletion guardrails.
 */

export const STAFF_ROLES = [
  "instructor",
  "frontoffice",
  "manager",
  "marketing",
  "officeboy",
  "admin",
];

export const STAFF_ROLE_LABELS = {
  instructor: "Instructor",
  frontoffice: "Front Office",
  manager: "Manager",
  marketing: "Marketing Staff",
  officeboy: "Office Boy",
  admin: "Administrator",
};

export const STAFF_STATUS_MAP = {
  active: {
    label: "Active",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  on_leave: {
    label: "On Leave",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  },
  resigned: {
    label: "Resigned",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    dotClass: "bg-slate-400",
  },
  terminated: {
    label: "Terminated",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
  },
};

/**
 * Computes teaching workload telemetry for an instructor based on active classes.
 */
export function getInstructorWorkload(instructorId, classes = []) {
  if (!instructorId) {
    return { assignedClasses: [], batchCount: 0, studentCount: 0 };
  }

  const assignedClasses = classes.filter(
    (c) => c.instructorId === instructorId && c.status !== "cancelled"
  );
  const batchCount = assignedClasses.length;
  const studentCount = assignedClasses.reduce(
    (sum, c) => sum + (c.studentIds || []).length,
    0
  );

  return {
    assignedClasses,
    batchCount,
    studentCount,
  };
}

/**
 * Validates whether a staff member can safely be deleted from Firestore.
 * Prevents accidental cascading corruption of classes and self-deletion.
 */
export function canDeleteStaff(staffUser, classes = [], currentUserId = null) {
  if (!staffUser) {
    return { canDelete: false, reason: "Invalid staff user." };
  }

  if (currentUserId && staffUser.id === currentUserId) {
    return {
      canDelete: false,
      reason: "You cannot delete your own administrative account while logged in.",
    };
  }

  const assignedClasses = classes.filter(
    (c) => c.instructorId === staffUser.id && c.status !== "cancelled" && c.status !== "completed"
  );

  if (assignedClasses.length > 0) {
    const classNames = assignedClasses.map((c) => c.className || "Class").join(", ");
    return {
      canDelete: false,
      reason: `Cannot delete: This instructor is currently assigned to ${assignedClasses.length} active class(es): ${classNames}. Please reassign their classes first, or mark their status as "Resigned / Inactive" instead.`,
    };
  }

  return { canDelete: true, reason: "" };
}

/**
 * Filters and sorts staff members.
 */
export function filterStaffMembers({
  users = [],
  search = "",
  roleFilter = "all",
  statusFilter = "all",
  branchFilter = "all",
}) {
  let list = users.filter((u) => u.role !== "student");

  if (roleFilter !== "all") {
    list = list.filter((u) => u.role === roleFilter);
  }

  if (statusFilter !== "all") {
    list = list.filter((u) => (u.status || "active") === statusFilter);
  }

  if (branchFilter !== "all") {
    list = list.filter(
      (u) => (u.branch || "").toLowerCase() === branchFilter.toLowerCase()
    );
  }

  const q = (search || "").trim().toLowerCase();
  if (q) {
    list = list.filter((u) => {
      const name = (u.displayName || "").toLowerCase();
      const nickname = (u.nickname || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const phone = (u.phone || "").toLowerCase();
      return (
        name.includes(q) ||
        nickname.includes(q) ||
        email.includes(q) ||
        phone.includes(q)
      );
    });
  }

  list.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  return list;
}

/**
 * Extracts unique non-empty branch names from staff users.
 */
export function getDistinctStaffBranches(users = []) {
  const set = new Set();
  users.forEach((u) => {
    if (u.role !== "student" && u.branch) {
      set.add(u.branch.trim());
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
