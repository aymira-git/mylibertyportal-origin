/**
 * admissionsUtils.js
 * Plain JavaScript utility helpers for Student Applications & Admissions.
 */

import { normalizeWhatsAppNumber } from "../finance/receiptMessages";

export function isPending(app) {
  return (app?.status || "pending") === "pending";
}

export function getPhoneKey(phone) {
  if (!phone) return "";
  const normalized = normalizeWhatsAppNumber(phone);
  if (!normalized || normalized.length < 9) return "";
  return normalized;
}

export function getNameKey(name) {
  if (!name) return "";
  const cleaned = name.toLowerCase().replace(/[^\p{L}\s]/gu, " ");
  const words = cleaned.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return words.sort().join(" ");
}

export function getDobKey(dob) {
  if (!dob) return "";
  const groups = String(dob).match(/\d+/g);
  if (!groups || groups.length < 3) return "";
  const nums = groups.slice(0, 3).map(g => parseInt(g, 10));
  nums.sort((a, b) => a - b);
  return nums.join("-");
}

export function findDuplicates(app, students = [], applications = []) {
  const result = { students: [], pendingTwins: [] };
  if (!app) return result;

  const appPhoneKey = getPhoneKey(app.phone);
  const appNameKey = getNameKey(app.displayName);
  const appDobKey = getDobKey(app.dob);

  // 1. Compare against existing registered students
  for (const s of students) {
    if (s.role !== "student") continue;

    const sPhoneKey = getPhoneKey(s.phone);
    const sNameKey = getNameKey(s.displayName);
    const sDobKey = getDobKey(s.dob);

    const phoneMatch = Boolean(appPhoneKey && sPhoneKey && appPhoneKey === sPhoneKey);
    const nameDobMatch = Boolean(
      appNameKey && sNameKey && appDobKey && sDobKey && appNameKey === sNameKey && appDobKey === sDobKey
    );
    const nameMatchOnly = Boolean(appNameKey && sNameKey && appNameKey === sNameKey);

    if (phoneMatch || nameDobMatch) {
      result.students.push({
        student: s,
        strength: "strong",
        reason: phoneMatch
          ? "Phone number matches existing student"
          : "Name and date of birth match existing student",
      });
    } else if (nameMatchOnly) {
      result.students.push({
        student: s,
        strength: "possible",
        reason: "Name matches existing student",
      });
    }
  }

  // 2. Compare against other pending applications
  for (const other of applications) {
    if (!isPending(other) || other.id === app.id) continue;

    const oPhoneKey = getPhoneKey(other.phone);
    const oNameKey = getNameKey(other.displayName);
    const oDobKey = getDobKey(other.dob);

    const phoneMatch = Boolean(appPhoneKey && oPhoneKey && appPhoneKey === oPhoneKey);
    const nameDobMatch = Boolean(
      appNameKey && oNameKey && appDobKey && oDobKey && appNameKey === oNameKey && appDobKey === oDobKey
    );
    const nameMatchOnly = Boolean(appNameKey && oNameKey && appNameKey === oNameKey);

    if (phoneMatch || nameDobMatch) {
      result.pendingTwins.push({
        app: other,
        strength: "strong",
        reason: phoneMatch
          ? "Same phone number as another pending application"
          : "Same name and date of birth as another pending application",
      });
    } else if (nameMatchOnly) {
      result.pendingTwins.push({
        app: other,
        strength: "possible",
        reason: "Same name as another pending application",
      });
    }
  }

  return result;
}

export function buildApplicantWhatsAppUrl({ target, app }) {
  if (!app) return null;
  const rawNumber = target === "parent" ? (app.fatherPhone || app.motherPhone || "") : (app.phone || "");
  const normalized = normalizeWhatsAppNumber(rawNumber);
  if (!normalized || normalized.length < 9) return null;

  const name = (app.displayName || "").trim();
  const program = (app.program || "General Program").trim();

  const message = target === "parent"
    ? `Halo Bapak/Ibu, orang tua dari ${name}! Terima kasih telah mendaftarkan ${name} di My Liberty English Academy (${program}). Kami dari tim Admissions ingin mengonfirmasi jadwal placement test dan informasi kelas. Apakah saat ini waktu yang tepat untuk berdiskusi?`
    : `Halo Kak ${name}! Terima kasih telah mendaftar di My Liberty English Academy (${program}). Kami dari tim Admissions ingin mengonfirmasi jadwal placement test dan informasi kelas Anda. Apakah saat ini waktu yang tepat untuk berdiskusi?`;

  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function filterApplications({ apps = [], view = "pending", search = "", branch = "all", program = "all" }) {
  let list = apps.filter(app => {
    if (view === "pending") {
      return isPending(app);
    }
    if (view === "approved") {
      return app.status === "approved";
    }
    if (view === "rejected") {
      return app.status === "rejected";
    }
    return true;
  });

  if (branch && branch !== "all") {
    list = list.filter(a => (a.branch || "").toLowerCase() === branch.toLowerCase());
  }

  if (program && program !== "all") {
    list = list.filter(a => (a.program || "").toLowerCase() === program.toLowerCase());
  }

  const q = (search || "").trim().toLowerCase();
  if (q) {
    list = list.filter(a => {
      const name = (a.displayName || "").toLowerCase();
      const phone = (a.phone || "").toLowerCase();
      const fPhone = (a.fatherPhone || "").toLowerCase();
      const mPhone = (a.motherPhone || "").toLowerCase();
      const school = (a.schoolOrJob || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || fPhone.includes(q) || mPhone.includes(q) || school.includes(q);
    });
  }

  list.sort((a, b) => {
    if (view === "approved") {
      const dateA = new Date(a.approvedAt || a.submittedAt || 0).getTime();
      const dateB = new Date(b.approvedAt || b.submittedAt || 0).getTime();
      return dateB - dateA;
    }
    if (view === "rejected") {
      const dateA = new Date(a.rejectedAt || a.submittedAt || 0).getTime();
      const dateB = new Date(b.rejectedAt || b.submittedAt || 0).getTime();
      return dateB - dateA;
    }
    const dateA = new Date(a.submittedAt || 0).getTime();
    const dateB = new Date(b.submittedAt || 0).getTime();
    return dateB - dateA;
  });

  return list;
}

export function getDistinctValues(apps = [], field) {
  const set = new Set();
  for (const a of apps) {
    const val = (a[field] || "").toString().trim();
    if (val) set.add(val);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
