export interface PrerequisiteEdge {
  from: string; // prerequisite course code
  to: string; // dependent course code
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

export interface LayoutNode {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: "curved" | "orthogonal" | "straight";
}