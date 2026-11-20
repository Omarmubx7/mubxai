import { CourseData, Course } from '@/types';
import curriculumData from '@/public/data/curriculum.json';

export async function getCourseData(majorKey: string = 'data_science'): Promise<CourseData> {
    try {
        const jsonData = curriculumData as any;

        // Structure is { majors: { [key]: { ... } }, shared: { ... } }
        const majorData = jsonData.majors[majorKey] || jsonData.majors['data_science'];

        return majorData as CourseData;
    } catch (error) {
        console.error("Error loading course data:", error);
        return {
            university_requirements: [],
            college_requirements: [],
            department_requirements: [],
            electives: [],
            university_electives: []
        };
    }
}

export function getAllCourses(data: CourseData): Course[] {
    return [
        ...data.university_requirements,
        ...data.college_requirements,
        ...data.department_requirements,
        ...data.electives,
        ...(data.university_electives || []),
        ...(data.work_market_requirements || [])
    ];
}
