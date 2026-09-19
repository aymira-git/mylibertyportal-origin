function clean(value) {
  return (value || "").toString().trim();
}

/**
 * Builds the canonical shape of a student's document in the `users`
 * collection. Previously this same field list was hand-typed in two
 * separate places (the admin Add/Edit Student form, and the application
 * approval flow) with no shared definition — a field added in one place
 * had no way of reaching the other. Now there's one definition; both
 * call sites just supply the raw values they have on hand.
 *
 * `joinedDate` is intentionally left to the caller rather than computed
 * here — the admin form lets staff pick an arbitrary join date, while
 * approving an application always uses "today". That's a per-flow
 * decision, not part of what a student record fundamentally looks like.
 */
export function buildStudentRecord(fields = {}) {
  const fatherName = clean(fields.fatherName);
  const motherName = clean(fields.motherName);
  const fatherPhone = clean(fields.fatherPhone);
  const motherPhone = clean(fields.motherPhone);

  return {
    displayName: clean(fields.displayName),
    nickname: clean(fields.nickname),
    gender: fields.gender || "",
    phone: clean(fields.phone),
    dob: fields.dob || "",
    placeOfBirth: clean(fields.placeOfBirth),
    religion: clean(fields.religion),
    address: clean(fields.address),
    branch: clean(fields.branch),
    program: clean(fields.program),
    classType: clean(fields.classType),
    schoolOrJob: clean(fields.schoolOrJob),
    classOrSemester: clean(fields.classOrSemester),
    joinedDate: fields.joinedDate || "",
    fatherName,
    fatherJob: clean(fields.fatherJob),
    fatherPhone,
    motherName,
    motherJob: clean(fields.motherJob),
    motherPhone,
    parentName: fatherName || motherName || clean(fields.parentName),
    parentPhone: fatherPhone || motherPhone || clean(fields.parentPhone),
    photoURL: clean(fields.photoURL),
    referralSource: clean(fields.referralSource),
    currentLevel: clean(fields.currentLevel) || "warrior",
    rating: fields.rating || "1",
    paymentPlan: clean(fields.paymentPlan) || "monthly",
    ...(fields.paidUntil ? { paidUntil: clean(fields.paidUntil) } : {}),
    status: clean(fields.status) || "active",
    notes: clean(fields.notes),
    role: "student",
  };
}
