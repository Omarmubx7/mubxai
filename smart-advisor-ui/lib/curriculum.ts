import type { Course } from "@/types";
import { MAJOR_LIST, type MajorKey } from "./majors";
import curriculumData from "@/public/data/curriculum.json";

export interface MajorCurriculum {
  key: MajorKey;
  total_credits: number;
  shared_credits: number;
  core_credits: number;
  department_requirements: Course[];
  electives: Course[];
}

interface CurriculumFile {
  majors: Record<string, MajorCurriculum>;
  shared: {
    university_requirements: Course[];
    university_electives: Course[];
    college_requirements: Course[];
  };
}

let cached: CurriculumFile | null = null;

/** Read and cache the curriculum JSON. Server components only. */
export async function loadCurriculum(): Promise<CurriculumFile> {
  if (cached) return cached;
  cached = curriculumData as unknown as CurriculumFile;
  return cached;
}

export async function getMajorCurriculum(
  key: MajorKey
): Promise<{ major: MajorCurriculum; shared: CurriculumFile["shared"] } | null> {
  const data = await loadCurriculum();
  const major = data.majors[key];
  if (!major) return null;
  return { major, shared: data.shared };
}

export async function getAllMajorCurricula(): Promise<
  Array<{ major: MajorCurriculum; shared: CurriculumFile["shared"] }>
> {
  const data = await loadCurriculum();
  return MAJOR_LIST.flatMap((entry) => {
    const major = data.majors[entry.key];
    return major ? [{ major, shared: data.shared }] : [];
  });
}

/** Unique courses across every major, de-duplicated by course code. */
export async function getAllCourses(): Promise<
  Array<Course & { majors: string[] }>
> {
  const data = await loadCurriculum();
  const map = new Map<string, Course & { majors: string[] }>();

  const add = (course: Course, majorLabel: string) => {
    if (!course?.code || !course?.name) return;
    const existing = map.get(course.code);
    if (existing) {
      if (!existing.majors.includes(majorLabel)) existing.majors.push(majorLabel);
      return;
    }
    map.set(course.code, { ...course, majors: [majorLabel] });
  };

  const sharedLists: Array<[Course[], string]> = [
    [data.shared.university_requirements, "All majors"],
    [data.shared.college_requirements, "All majors"],
    [data.shared.university_electives, "All majors"],
  ];

  for (const [list, label] of sharedLists) {
    for (const course of list ?? []) add(course, label);
  }

  for (const entry of MAJOR_LIST) {
    const major = data.majors[entry.key];
    if (!major) continue;
    for (const course of major.department_requirements ?? []) add(course, entry.label);
    for (const course of major.electives ?? []) add(course, entry.label);
  }

  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export function courseCountForMajor(major: MajorCurriculum): number {
  return (
    (major.department_requirements?.length ?? 0) + (major.electives?.length ?? 0)
  );
}
