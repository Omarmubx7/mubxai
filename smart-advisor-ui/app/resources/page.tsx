import type { Metadata } from "next";
import DirectoryClient from "@/components/resources/DirectoryClient";
import curriculum from "@/public/data/curriculum.json";

export const metadata: Metadata = {
    title: "HTU Student Resources & Course Materials",
    description: "Course materials, PDFs, videos and links shared by Al Hussein Technical University (HTU) students, organised by major and course.",
    alternates: {
        canonical: "https://ai.mubx.dev/resources",
    },
    openGraph: {
        title: "HTU Student Resources — MUBXAI",
        description: "Course materials shared by Al Hussein Technical University (HTU) students.",
        url: "https://ai.mubx.dev/resources",
    },
};

interface Course {
    name: string;
    code: string;
    ch: number;
}

export interface MajorGroup {
    id: string;
    label: string;
    courses: Course[];
}

const MAJOR_LABELS: Record<string, string> = {
    computer_science: "Computer Science",
    cybersecurity: "Cybersecurity",
    data_science: "Data Science",
    game_design: "Game Design",
    electrical_engineering: "Electrical Engineering",
    energy_engineering: "Energy Engineering",
    industrial_engineering: "Industrial Engineering",
    mechanical_engineering: "Mechanical Engineering",
};

function sortCourses(courses: Course[]): Course[] {
    return courses.sort((a, b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        if (a.code < b.code) return -1;
        if (a.code > b.code) return 1;
        return 0;
    });
}

async function getMajorGroups(): Promise<{
    majorGroups: MajorGroup[];
    courseToMajorLabels: Record<string, string[]>;
}> {
    try {
        const data = curriculum as any;

        const processList = (list: Array<{ code?: string; name?: string; ch?: number }>, map: Map<string, Course>) => {
            if (!list) return;
            list.forEach((c) => {
                if (c.code && c.name) {
                    let code = c.code.trim();
                    if (code.startsWith("00") && code.length === 10) code = code.substring(2);
                    const existing = map.get(code);
                    if (!existing || c.name.length > existing.name.length) {
                        map.set(code, { name: c.name.trim(), code, ch: c.ch ?? 3 });
                    }
                }
            });
        };

        // Shared courses (university + college requirements + electives)
        const sharedMap = new Map<string, Course>();
        processList(data.shared.university_requirements, sharedMap);
        processList(data.shared.college_requirements, sharedMap);
        processList(data.shared.university_electives, sharedMap);
        const sharedCourses = sortCourses(Array.from(sharedMap.values()));

        // Per-major groups
        const groups: MajorGroup[] = [];
        const courseToMajors = new Map<string, Set<string>>();

        for (const majorKey of Object.keys(data.majors)) {
            const majorData = data.majors[majorKey];
            const majorMap = new Map<string, Course>();

            // Start with shared courses
            sharedCourses.forEach((c) => majorMap.set(c.code, c));

            // Add major-specific overrides/additions
            processList(majorData.university_requirements, majorMap);
            processList(majorData.college_requirements, majorMap);
            processList(majorData.university_electives, majorMap);
            processList(majorData.department_requirements, majorMap);
            processList(majorData.electives, majorMap);
            processList(majorData.work_market_requirements, majorMap);

            // Track which majors each course belongs to
            const label = MAJOR_LABELS[majorKey] || majorKey;
            majorMap.forEach((_, code) => {
                if (!courseToMajors.has(code)) courseToMajors.set(code, new Set());
                courseToMajors.get(code)!.add(label);
            });

            groups.push({
                id: majorKey,
                label,
                courses: sortCourses(Array.from(majorMap.values())),
            });
        }

        // "All" group: every unique course across all majors
        const allMap = new Map<string, Course>();
        groups.forEach((g) => g.courses.forEach((c) => allMap.set(c.code, c)));
        groups.unshift({
            id: "all",
            label: "All Majors",
            courses: sortCourses(Array.from(allMap.values())),
        });

        // Convert to serializable record
        const courseToMajorLabels: Record<string, string[]> = {};
        courseToMajors.forEach((majors, code) => {
            courseToMajorLabels[code] = Array.from(majors).sort();
        });

        return { majorGroups: groups, courseToMajorLabels };
    } catch {
        return {
            majorGroups: [{ id: "all", label: "All Majors", courses: [] }],
            courseToMajorLabels: {},
        };
    }
}

export default async function ResourcesPage() {
    const { majorGroups, courseToMajorLabels } = await getMajorGroups();

    return (
        <main className="min-h-dvh">
            <DirectoryClient majorGroups={majorGroups} courseToMajorLabels={courseToMajorLabels} />
        </main>
    );
}
