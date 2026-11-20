import { NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";
import curriculum from "@/public/data/curriculum.json";

export async function GET() {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const data = curriculum as any;

        const courseMap: Map<string, { name: string; code: string; ch: number }> = new Map();

        const processList = (list: Array<{code?: string, name?: string, ch?: number}>) => {
            if (!list) return;
            list.forEach(c => {
                if (c.code && c.name) {
                    let code = c.code.trim();
                    if (code.startsWith('00') && code.length === 10) code = code.substring(2);

                    const existing = courseMap.get(code);
                    if (!existing || c.name.length > existing.name.length) {
                        courseMap.set(code, { name: c.name.trim(), code, ch: c.ch ?? 3 });
                    }
                }
            });
        };

        // 1. Process Shared Requirements
        processList(data.shared.university_requirements);
        processList(data.shared.college_requirements);
        processList(data.shared.university_electives);

        // 2. Process All Majors
        for (const majorKey in data.majors) {
            const majorData = data.majors[majorKey];
            processList(majorData.university_requirements);
            processList(majorData.college_requirements);
            processList(majorData.university_electives);
            processList(majorData.department_requirements);
            processList(majorData.electives);
            processList(majorData.work_market_requirements);
        }

        const sortedCourses = Array.from(courseMap.values()).sort((a, b) => {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            if (a.code < b.code) return -1;
            if (a.code > b.code) return 1;
            return 0;
        });

        return NextResponse.json(sortedCourses);
    } catch (error: unknown) {
        console.error("Failed to load courses for autocomplete:", error);
        return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
    }
}
