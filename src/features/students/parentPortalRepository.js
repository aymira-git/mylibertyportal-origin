import { db } from "../../firebase";
import { collection, query, where, getDocs, limit, doc, getDoc, orderBy } from "firebase/firestore";
import { branchToId } from "../../constants/branches.js";

/**
 * Normalizes phone string to clean digit format for matching.
 */
export function normalizePhoneDigits(phoneStr = "") {
  if (!phoneStr) return "";
  let digits = String(phoneStr).replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  }
  return digits;
}

/**
 * Builds the tuition summary shown on the authenticated Parent Portal from the
 * denormalized payment fields on the student document (written by the
 * finance flow in paymentsRepository.recordPayment). The payments
 * collection itself is staff-only in Firestore rules, so parent views
 * read this summary directly from the linked student document.
 */
export function buildPaymentSummary(student) {
  if (!student || typeof student !== "object") return null;
  const hasRecords = Boolean(student.lastPaymentPeriod || student.lastPaymentDate || student.paidUntil);
  return {
    status: student.paymentStatus === "pending" ? "pending" : hasRecords ? "paid" : "none",
    lastPaymentPeriod: student.lastPaymentPeriod || null,
    lastPaymentDate: student.lastPaymentDate || null,
    lastPaymentAmount: typeof student.lastPaymentAmount === "number" ? student.lastPaymentAmount : null,
    lastPaymentMethod: student.lastPaymentMethod || null,
    paidUntil: student.paidUntil || null,
  };
}

/**
 * Loads authenticated parent user doc and all linked student profile documents.
 * Query 1 & 2 from Parent+Student Roster Model v2 Section 27.
 *
 * @param {string} parentUid
 * @returns {Promise<{ parent: any, children: any[] }>}
 */
export async function getAuthenticatedParentBundle(parentUid) {
  if (!parentUid) return { parent: null, children: [] };

  const parentDoc = await getDoc(doc(db, "users", parentUid));
  if (!parentDoc.exists()) {
    return { parent: null, children: [] };
  }
  /** @type {any} */
  const parent = { id: parentDoc.id, ...parentDoc.data() };
  const childStudentIds = Array.isArray(parent.childStudentIds) ? parent.childStudentIds : [];

  const children = [];
  for (const childId of childStudentIds) {
    const childDoc = await getDoc(doc(db, "users", childId));
    if (childDoc.exists()) {
      const child = childDoc.data();
      if (child.role === "student" && (!child.status || child.status === "active")) {
        children.push({ id: childDoc.id, ...child });
      }
    }
  }

  return { parent, children };
}

/**
 * Loads enrolled classes and attendance history for a linked child.
 * Query 3 & 5 from Parent+Student Roster Model v2 Section 27.
 *
 * @param {string} childId
 * @returns {Promise<{ classes: any[], attendance: any[] }>}
 */
export async function getChildAttendanceAndClasses(childId, childBranch) {
  if (!childId) return { classes: [], attendance: [] };

  const qClasses = query(
    collection(db, "classes"),
    where("studentIds", "array-contains", childId),
    where("status", "==", "open"),
    where("branchId", "==", branchToId(childBranch)),
    limit(20)
  );
  const qAtt = query(
    collection(db, "classAttendance"),
    where("studentId", "==", childId),
    orderBy("attendanceDate", "desc"),
    limit(30)
  );
  const [snapClasses, snapAtt] = await Promise.all([getDocs(qClasses), getDocs(qAtt)]);

  return {
    classes: snapClasses.docs.map((d) => ({ id: d.id, ...d.data() })),
    attendance: snapAtt.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}
