/**
 * Pure business logic for resolving student class attendance context.
 * Resolves which class a student belongs to today and verifies enrollment,
 * safely supporting both modern `studentIds` and legacy `enrollments`.
 */

/**
 * Checks if a student is enrolled in a class.
 * Follows the project's duality rule: checks studentIds first, then enrollments fallback.
 *
 * @param {any} classItem
 * @param {string} studentId
 * @returns {boolean}
 */
export function isStudentEnrolledInClass(classItem, studentId) {
  if (!classItem || !studentId) return false;

  if (Array.isArray(classItem.studentIds) && classItem.studentIds.length > 0) {
    return classItem.studentIds.includes(studentId);
  }

  if (Array.isArray(classItem.enrollments) && classItem.enrollments.length > 0) {
    return classItem.enrollments.some((e) => (typeof e === "string" ? e === studentId : e?.studentId === studentId));
  }

  return false;
}

/**
 * Resolves the class context for student attendance.
 *
 * Preferred resolution order (per integration spec §8):
 * A. Instructor-selected class context (primary)
 * B. Fallback when no class is selected:
 *    - 1 enrolled match -> resolved
 *    - >1 enrolled matches -> AMBIGUOUS_CLASSES
 *    - 0 enrolled matches -> NO_ENROLLED_CLASS_TODAY
 *
 * @param {object} params
 * @param {string} params.studentId
 * @param {Array<any>} params.todayClasses
 * @param {string} [params.selectedClassId]
 * @returns {{ resolved: boolean, classItem?: any, reason?: string, candidateClasses?: any[] }}
 */
export function resolveStudentClass({ studentId, todayClasses = [], selectedClassId = null }) {
  if (!studentId) {
    return { resolved: false, reason: "MISSING_STUDENT_ID" };
  }

  if (selectedClassId) {
    const selectedClass = todayClasses.find((cls) => cls.id === selectedClassId);
    if (!selectedClass) {
      return { resolved: false, reason: "CLASS_NOT_FOUND" };
    }

    if (isStudentEnrolledInClass(selectedClass, studentId)) {
      return { resolved: true, classItem: selectedClass };
    }

    return {
      resolved: false,
      reason: "NOT_ENROLLED_IN_SELECTED_CLASS",
      classItem: selectedClass,
    };
  }

  // Fallback: check all today's active classes
  const matchingClasses = todayClasses.filter((cls) => isStudentEnrolledInClass(cls, studentId));

  if (matchingClasses.length === 1) {
    return { resolved: true, classItem: matchingClasses[0] };
  }

  if (matchingClasses.length > 1) {
    return {
      resolved: false,
      reason: "AMBIGUOUS_CLASSES",
      candidateClasses: matchingClasses,
    };
  }

  return { resolved: false, reason: "NO_ENROLLED_CLASS_TODAY" };
}
