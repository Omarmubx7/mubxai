export interface CourseIdentifier {
  code: string;
  label?: string;
}

export interface CourseBase {
  id: string;
  code: string;
  name: string;
  credits: number;
  category: string;
  level?: number | string;
  semester?: "Fall" | "Spring" | "Summer";
  prerequisites?: any;
  corequisites?: string[];
  description?: string;
  framework?: string;
}

export type PrerequisiteInput = string | string[] | {
  type: "AND" | "OR" | "SINGLE";
  courses: string[];
  subrules?: any[];
};

export interface ParsedPrerequisite {
  type: "AND" | "OR" | "SINGLE";
  primaryCourses: string[];
  subrules?: ParsedPrerequisite[];
  rawInput: string;
}

export interface Course extends CourseBase {
  isLocked: boolean;
  isCompleted: boolean;
  progress: "not-started" | "in-progress" | "completed";
  colorOverride?: string;
}

export interface PrerequisiteEdge {
  from: string;
  to: string;
  type: "DIRECT" | "AND" | "OR";
  status: "possible" | "blocked" | "satisfied";
}

export type ValidationError = 
  | { type: "missing-ref"; message: string; courses: string[] }
  | { type: "duplicate-id"; message: string; courses: string[] }
  | { type: "circular"; message: string; cycles: string[][] }
  | { type: "malformed-rule"; message: string; input: string; courses: string[] };

export type ValidationResult = 
  | { valid: true; errors: ValidationError[]; warnings: string[] }
  | { valid: false; errors: ValidationError[]; warnings: string[] };

export interface DagreLayoutOptions {
  rankdir: "LR" | "TB";
  nodesep: number;
  ranksep: number;
  marginx: number;
  marginy: number;
}