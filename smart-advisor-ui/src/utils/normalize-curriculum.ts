/**
 * Normalize raw curriculum data into a consistent internal format.
 * Handles various prerequisite formats and validates the structure.
 *
 * Expected raw course format:
 * {
 *   id: string,
 *   code: string,       // e.g., "CS101"
 *   name: string,
 *   credits: number,
 *   category: "university-requirement" | "college-requirement" | "major-requirement" | "major-elective" | "free-elective",
 *   level?: number | string,
 *   semester?: "Fall" | "Spring" | "Summer",
 *   prerequisites: PrerequisiteInput,  // string, string[], or rule object
 *   corequisites?: string[],
 *   description?: string,
 *   framework?: string,
 * }
 */
import type {
  CourseIdentifier,
  CourseBase,
  PrerequisiteInput,
  ParsedPrerequisite,
  Course,
  PrerequisiteEdge,
  ValidationError,
  ValidationResult,
} from "./types";

/**
 * Parse a raw prerequisite input into a standardized ParsedPrerequisite structure.
 * Handles: single code, array, "A AND B", "A OR B", nested AND/OR rules.
 */
export function parsePrerequisites(
  input: PrerequisiteInput
): ParsedPrerequisite | null {
  if (!input) return { type: "SINGLE", primaryCourses: [], rawInput: "" };

  // Single string
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return { type: "SINGLE", primaryCourses: [], rawInput: "" };

    // Check for AND
    if (trimmed.toUpperCase().includes(" AND ")) {
      const parts = trimmed.split(/ AND /i).map((p) => p.trim());
      return {
        type: "AND",
        primaryCourses: parts.filter((c) => c.length > 0),
        rawInput: trimmed,
      };
    }

    // Check for OR
    if (trimmed.toUpperCase().includes(" OR ")) {
      const parts = trimmed.split(/ OR /i).map((p) => p.trim());
      return {
        type: "OR",
        primaryCourses: parts.filter((c) => c.length > 0),
        rawInput: trimmed,
      };
    }

    // Single course code
    return {
      type: "SINGLE",
      primaryCourses: [trimmed],
      rawInput: trimmed,
    };
  }

  // Array of course codes
  if (Array.isArray(input)) {
    const codes = input.filter((c) => c && typeof c === "string").map((c) => c.trim());
    if (codes.length === 1) {
      return {
        type: "SINGLE",
        primaryCourses: [codes[0]],
        rawInput: codes.join(" AND "),
      };
    }
    return {
      type: "AND",
      primaryCourses: codes,
      rawInput: codes.join(" AND "),
    };
  }

  // Rule object (nested AND/OR)
  if (input && typeof input === "object" && "type" in input) {
    const rule = input as { type: string; courses?: string[]; subrules?: any };
    if (rule.type === "AND" || rule.type === "OR") {
      return {
        type: rule.type,
        primaryCourses: rule.courses || [],
        subrules: rule.subrules?.map(parsePrerequisites).filter(Boolean),
        rawInput: JSON.stringify(input),
      };
    }
    if (rule.type === "SINGLE") {
      return {
        type: "SINGLE",
        primaryCourses: rule.courses || [],
        rawInput: JSON.stringify(input),
      };
    }
  }

  return null;
}

/**
 * Convert a ParsedPrerequisite into an array of directed edge course codes.
 * For AND: each course in primaryCourses becomes a separate edge target.
 * For OR: same - the UI will display the OR label.
 * For SINGLE: one edge target.
 */
export function edgesFromParsed(
  parsed: ParsedPrerequisite,
  fromCourseCode: string
): string[] {
  if (!parsed) return [];
  return parsed.primaryCourses.map((code) => code).filter((c) => c.length > 0);
}

/**
 * Normalize an entire curriculum dataset.
 * Takes raw course array (as would come from JSON, API, or DB), returns
 * a normalized structure with validated graph, edges, and depth map.
 */
export function normalizeCurriculum(
  rawCourses: CourseBase[],
  majorKey?: string
): {
  courses: Map<string, Course>;
  edges: PrerequisiteEdge[];
  categoryColors: Map<string, string>;
  validation: ValidationResult;
  depthMap: Map<string, number>;
} {
  // Step 1: Deduplicate by code, keep first occurrence
  const seen = new Map<string, CourseBase>();
  const dedupWarnings: string[] = [];

  for (const raw of rawCourses) {
    if (!raw.code) {
      dedupWarnings.push("Course missing code");
      continue;
    }
    if (seen.has(raw.code)) {
      dedupWarnings.push(`Duplicate course code: ${raw.code}`);
      continue;
    }
    seen.set(raw.code, raw);
  }

  // Step 2: Convert each course to internal format, parse prerequisites
  const courseMap = new Map<string, Course>();
  const allCodes = Array.from(seen.keys());
  const edges: PrerequisiteEdge[] = [];
  const validationErrors: ValidationError[] = [];

  // Category → color mapping (configurable per major)
  const categoryColors = new Map<string, string>([
    ["university-requirement", "#3b82f6"], // blue
    ["college-requirement", "#10b981"],    // green
    ["major-requirement", "#8b5cf6"],      // purple
    ["major-elective", "#f97316"],         // orange
    ["free-elective", "#eab308"],          // yellow
  ]);

  for (const [code, raw] of seen.entries()) {
    // Build internal course
    const course: Course = {
      id: raw.id || code,
      code,
      name: raw.name || `${code} Course`,
      credits: raw.credits ?? 3,
      category: raw.category ?? "major-requirement",
      level: raw.level,
      semester: raw.semester,
      prerequisites: raw.prerequisites,
      corequisites: raw.corequisites,
      description: raw.description,
      framework: raw.framework,
      isLocked: false,
      isCompleted: false,
      progress: "not-started",
    };

    // Parse prerequisites into edges
    if (raw.prerequisites) {
      const parsed = parsePrerequisites(raw.prerequisites);
      if (!parsed) {
        validationErrors.push({
          type: "malformed-rule",
          message: `Could not parse prerequisites for ${code}`,
          input: String(raw.prerequisites),
          courses: [code],
        });
      } else {
        const courseEdges = edgesFromParsed(parsed, code);
        for (const toCode of courseEdges) {
          // Don't create self-edges
          if (toCode !== code) {
            // Check if target course exists
            const targetCourse = courseMap.get(toCode) || courseMap.get(toCode.toUpperCase());
            edges.push({
              from: code,
              to: toCode,
              type: parsed.type,
              status: targetCourse ? "possible" : "missing-ref",
            });

            // If target doesn't exist, record missing ref
            if (!targetCourse && !courseMap.has(toCode)) {
              validationErrors.push({
                type: "missing-ref",
                message: `Prerequisite reference "${toCode}" not found in curriculum`,
                courses: [code],
              });
            }
          }
        }
      }
    }

    courseMap.set(code, course);
  }

  // Step 3: Cycle detection using DFS
  const cycles = detectCycles(courseMap, edges);
  if (cycles.length > 0) {
    validationErrors.push({
      type: "circular",
      message: `Circular prerequisite detected involving ${cycles.length} cycle(s)`,
      cycles,
    });
  }

  // Step 4: Compute prerequisite depth for each course
  const depthMap = computeDepth(courseMap, edges);

  // Step 5: Build validation result
  const hasErrors = validationErrors.some((e) => e.type !== "missing-ref" || e.type === "circular");
  const validation: ValidationResult = {
    valid: validationErrors.length === 0 && cycles.length === 0,
    errors: validationErrors,
    warnings: dedupWarnings,
  };

  return {
    courses: courseMap,
    edges,
    categoryColors,
    validation,
    depthMap,
  };
}

/**
 * Detect cycles in the prerequisite graph using DFS coloring.
 * Returns array of cycles, each cycle as an array of course codes.
 */
function detectCycles(
  courseMap: Map<string, Course>,
  edges: PrerequisiteEdge[]
): string[][] {
  // Build adjacency list (course -> its prerequisites)
  const adj = new Map<string, string[]>();
  for (const course of courseMap.values()) {
    adj.set(course.code, []);
  }
  for (const edge of edges) {
    if (adj.has(edge.from)) {
      adj.get(edge.from)!.push(edge.to);
    }
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const code of courseMap.keys()) {
    color.set(code, WHITE);
  }

  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    color.set(node, GRAY);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      const c = color.get(neighbor) ?? WHITE;
      if (c === GRAY) {
        // Found a cycle - extract the cycle portion
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart));
        }
      } else if (c === WHITE) {
        dfs(neighbor, path);
      }
    }

    path.pop();
    color.set(node, BLACK);
  }

  for (const code of courseMap.keys()) {
    if (color.get(code) === WHITE) {
      dfs(code, []);
    }
  }

  // Deduplicate cycles (normalized form)
  const uniqueCycles = new Set<string>();
  for (const cycle of cycles) {
    // Normalize: rotate so smallest code comes first, then stringify
    const minCode = cycle.reduce((a, b) => (a < b ? a : b));
    const startIdx = cycle.indexOf(minCode);
    const normalized = cycle.slice(startIdx).concat(cycle.slice(0, startIdx));
    uniqueCycles.add(normalized.join(" -> "));
  }

  return Array.from(uniqueCycles).map((s) => s.split(" -> "));
}

/**
 * Compute prerequisite depth for each course using the DAG.
 * Depth = length of longest path from any root (no prerequisites).
 * Roots have depth 0.
 */
function computeDepth(
  courseMap: Map<string, Course>,
  edges: PrerequisiteEdge[]
): Map<string, number> {
  // Build in-degree map and adjacency for topological sort
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // who depends on me
  const prerequisitesOf = new Map<string, string[]>(); // what I need

  for (const code of courseMap.keys()) {
    inDegree.set(code, 0);
    dependents.set(code, []);
    prerequisitesOf.set(code, []);
  }

  for (const edge of edges) {
    if (courseMap.has(edge.from) && courseMap.has(edge.to)) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      dependents.get(edge.from)!.push(edge.to);
      prerequisitesOf.get(edge.to)!.push(edge.from);
    }
  }

  // BFS/Kahn's algorithm - nodes with inDegree 0 are roots
  const queue: string[] = [];
  for (const [code, deg] of inDegree) {
    if (deg === 0) queue.push(code);
  }

  const depth = new Map<string, number>();
  // Initialize depths for roots
  for (const code of courseMap.keys()) {
    depth.set(code, 0);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepDepth = depth.get(current) ?? 0;

    for (const dependent of dependents.get(current)!) {
      // depth of dependent = max(current depth + 1, existing depth)
      const newDepth = Math.max(currentDepDepth + 1, depth.get(dependent) ?? 0);
      depth.set(dependent, newDepth);

      inDegree.set(dependent, (inDegree.get(dependent) ?? 0) - 1);
      if (inDegree.get(dependent) === 0) {
        queue.push(dependent);
      }
    }
  }

  // For any nodes not reached (isolated or error), set depth to 0
  for (const code of courseMap.keys()) {
    if (!depth.has(code)) {
      depth.set(code, 0);
    }
  }

  return depth;
}