export interface Course {
    code: string;
    name: string;
    ch: number;
    framework: "HTU" | "HNC" | "HND";
    level: 1 | 2 | 3 | 4 | 5;
    prereq?: string;
    description?: string;
    major_keys?: string[];
}

export interface CourseData {
    university_requirements: Course[];
    college_requirements: Course[];
    department_requirements: Course[];
    electives: Course[];
    university_electives: Course[];
    work_market_requirements?: Course[];
}

export interface PrerequisiteLogicRules {
    code_regex: string;
    separators?: {
        and: string[];
        or: string[];
    };
    stripping?: {
        leading_zeros_if_length?: number;
        target_length?: number;
    };
}

export interface DegreeTypeRule {
    total_credits: number;
    major_keys: string[];
    max_dept_electives?: number;
    max_uni_electives?: number;
}

export interface CurriculumRules {
    degree_types: Record<string, DegreeTypeRule>;
    logic_rules?: {
        prerequisites?: PrerequisiteLogicRules;
    };
}

export type SemesterType = "Regular" | "Summer";

export interface CompletedCourse {
    code: string;
    grade: string;
}

export interface Transcript {
    completed: CompletedCourse[]; // List of course codes with grades
    gpa?: number;
}

export interface PlannerCourse {
    id: string;
    name: string;
    code?: string;
    credits: number;
    hasMidterm: boolean;
    midtermDate?: string;
    finalDate?: string;
    professor?: string;
    location?: string;
    status: "In Progress" | "Completed" | "At Risk";
    grade?: string | null;
    midtermEventId?: string;
    finalEventId?: string;
}

export interface StudySession {
    id: string;
    courseId: string;
    date: string;
    hours: number;
    notes?: string;
}

export interface SemesterData {
    id: string;
    name?: string;
    courses: PlannerCourse[];
    studySessions: StudySession[];
}
