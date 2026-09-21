/**
 * staffUtils.js
 * Plain JavaScript utility helpers for Staff Directory, workload calculations,
 * and deletion guardrails.
 */

import { BRANCHES, normalizeBranch, matchesBranchFilter } from "../../constants/branches.js";

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

export const TRACKED_STAFF_ROLES = ["instructor", "frontoffice", "marketing", "officeboy"];

export const STAFF_STATUS_OPTIONS = Object.entries(STAFF_STATUS_MAP).map(([value, conf]) => ({
  value,
  label: conf.label,
}));

export const STANDARD_BRANCHES = BRANCHES;

/**
 * Checks whether a class is currently active (not cancelled, not completed).
 * Aligns with available batches and attendance lifecycle rules.
 */
export function isActiveClass(c) {
  if (!c) return false;
  const s = c.status || "open";
  return s !== "cancelled" && s !== "completed";
}

/**
 * Computes teaching workload telemetry for an instructor based on active classes.
 * Unique student count prevents duplicate headcount if a student is in multiple classes.
 */
export function getInstructorWorkload(instructorId, classes = []) {
  if (!instructorId) {
    return { assignedClasses: [], batchCount: 0, studentCount: 0 };
  }

  const assignedClasses = classes.filter(
    (c) => c.instructorId === instructorId && isActiveClass(c)
  );
  const batchCount = assignedClasses.length;

  const uniqueStudentIds = new Set();
  assignedClasses.forEach((c) => {
    (c.studentIds || []).forEach((id) => uniqueStudentIds.add(id));
  });
  const studentCount = uniqueStudentIds.size;

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
    (c) => c.instructorId === staffUser.id && isActiveClass(c)
  );

  if (assignedClasses.length > 0) {
    const classNames = assignedClasses.map((c) => c.className || "Class").join(", ");
    return {
      canDelete: false,
      reason: `Cannot delete: This instructor is currently assigned to ${assignedClasses.length} active class(es): ${classNames}. Please reassign their classes first, or mark their status as "Resigned" instead.`,
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
    list = list.filter((u) => matchesBranchFilter(u.branch, branchFilter));
  }

  const q = (search || "").trim().toLowerCase();
  if (q) {
    list = list.filter((u) => {
      const name = (u.displayName || "").toLowerCase();
      const nickname = (u.nickname || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const phone = (u.phone || "").toLowerCase();
      return name.includes(q) || nickname.includes(q) || email.includes(q) || phone.includes(q);
    });
  }

  list.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  return list;
}

/**
 * Extracts unique non-empty branch names from staff users.
 */
export function getDistinctStaffBranches(users = []) {
  const set = new Set(STANDARD_BRANCHES);
  users.forEach((u) => {
    if (u.role !== "student" && u.branch) {
      set.add(normalizeBranch(u.branch));
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
