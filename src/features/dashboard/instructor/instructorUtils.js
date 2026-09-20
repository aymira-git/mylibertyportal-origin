/**
 * Deduplicates class batches having identical signature across schedules.
 */
export function uniqueClasses(classes = []) {
  const seen = new Set();
  return classes.filter((cls) => {
    const signature = [cls.className, cls.instructorId, cls.schedule, cls.classRoom].join("|");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}
