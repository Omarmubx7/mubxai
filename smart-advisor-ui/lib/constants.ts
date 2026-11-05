export const SEMESTERS = [
    { name: "Winter", startMonth: 10, endMonth: 2, label: "October - February" },
    { name: "Spring", startMonth: 3, endMonth: 6, label: "March - June" },
    { name: "Summer", startMonth: 7, endMonth: 9, label: "July - September" },
];

export const APP_NAME = "MUBXAI";

/**
 * Course codes that exist only so the resources directory can categorise
 * uploads. They must never appear in the Course Tracker (or count toward
 * degree progress), but they stay in curriculum.json for resource search.
 */
export const RESOURCE_ONLY_COURSE_CODES = new Set(["30301125"]);

export function isTrackerVisibleCourse(course: { code?: string }): boolean {
    return !course?.code || !RESOURCE_ONLY_COURSE_CODES.has(course.code);
}
