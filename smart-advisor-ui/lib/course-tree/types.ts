import type { Course } from "@/types";

/** Requirement buckets used by the tracker. */
export type CourseCategory =
    | "University Requirements"
    | "University Elective"
    | "College Requirements"
    | "Department Requirements"
    | "Department Elective";

export const CATEGORY_ORDER: CourseCategory[] = [
    "University Requirements",
    "University Elective",
    "College Requirements",
    "Department Requirements",
    "Department Elective",
];

export type PrereqGateKind = "ch" | "approval" | "placement" | "concurrent" | "text";

export interface PrereqCourseExpr {
    kind: "course";
    code: string;
}

export interface PrereqGateExpr {
    kind: "gate";
    gate: PrereqGateKind;
    label: string;
    requiredCH?: number;
}

export interface PrereqGroupExpr {
    kind: "and" | "or";
    children: PrereqExpr[];
    raw: string;
}

export type PrereqExpr = PrereqCourseExpr | PrereqGateExpr | PrereqGroupExpr;

export interface PrereqCourseRef {
    code: string;
    /** True when this code sits under an OR branch. */
    or: boolean;
}

export interface CourseTreeEntry {
    course: Course;
    categories: CourseCategory[];
    order: number;
}

export interface CourseTreeNode extends CourseTreeEntry {
    code: string;
    prereqExpr: PrereqExpr | null;
    prereqCodes: string[];
    externalPrereqCodes: string[];
    gates: PrereqGateExpr[];
    dependents: string[];
}

export interface CourseGraphEdge {
    from: string;
    to: string;
    or: boolean;
}

export interface CourseGraph {
    nodes: Map<string, CourseTreeNode>;
    order: string[];
    edges: CourseGraphEdge[];
    roots: string[];
    /** Longest prerequisite chain depth for each course. */
    depths: Map<string, number>;
    cycles: string[][];
    /** Prerequisite codes referenced but absent from this major's catalog. */
    externalCodes: string[];
}

export interface CourseVisualState {
    isCompleted: boolean;
    isInProgress: boolean;
    isLocked: boolean;
    hasPrereqWarning: boolean;
    lockReason?: string;
    missingPrereqs: string[];
    isSandboxSelected: boolean;
    isDimmed: boolean;
}

export interface OutlineCourse {
    node: CourseTreeNode;
}

export interface OutlineCategoryGroup {
    key: string;
    label: CourseCategory;
    courses: OutlineCourse[];
    totalCourses: number;
    completedCourses: number;
    totalCH: number;
    completedCH: number;
}

export interface OutlineYearGroup {
    key: string;
    level: number;
    label: string;
    courses: OutlineCourse[];
    totalCourses: number;
    completedCourses: number;
    totalCH: number;
    completedCH: number;
    categories: OutlineCategoryGroup[];
}

export interface MapNodeLayout {
    code: string;
    level: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MapEdgeLayout {
    from: string;
    to: string;
    path: string;
    or: boolean;
}

export interface MapBandLayout {
    level: number;
    x: number;
    y: number;
    width: number;
    height: number;
    /** How many wrapped card rows this year band contains. */
    rows: number;
}

export interface MapLayout {
    nodes: MapNodeLayout[];
    edges: MapEdgeLayout[];
    bands: MapBandLayout[];
    levels: number[];
    width: number;
    height: number;
    nodeWidth: number;
    nodeHeight: number;
}

export interface TreeFilters {
    query: string;
    showCompleted: boolean;
}

export interface MapFilters extends TreeFilters {
    showExternal: boolean;
}
