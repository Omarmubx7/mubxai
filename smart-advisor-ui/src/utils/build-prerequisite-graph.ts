/**
 * buildPrerequisiteGraph
 * 
 * Takes the normalized curriculum output from normalizeCurriculum and produces
 * a structured graph ready for Dagre layout + React Flow rendering.
 * 
 * Also assigns rank positions based on prerequisite depth.
 */
import type {
  Course,
  PrerequisiteEdge,
  NormalizedCurriculum,
  DagreLayoutOptions,
  LayoutNode,
  LayoutEdge,
} from "../types";

/**
 * Assign x,y positions using Dagre, or compute simple ranks if Dagre not available.
 * For landscape (LR): x = rank, y = position within rank
 * For portrait (TB): x = position within rank, y = rank (Dagre default)
 */
export function assignLayoutPositions(
  nodes: Map<string, LayoutNode>,
  edges: PrerequisiteEdge[],
  options: DagreLayoutOptions
): {
  positionedNodes: Map<string, { x: number; y: number; rank: number }>;
  rankAssignments: Map<string, string[]>;
} {
  // Use Dagre for automatic DAG layout
  // Import dynamically to avoid build failures if package missing
  // But we'll implement a simple rank-based assignment here

  // Build adjacency for rank assignment
  const courseToRank = new Map<string, number>(); // deeper prereqs = higher rank number
  const rankCourses = new Map<number, string[]>(); // rank number -> course codes

  // Initialize: courses with no prerequisites get rank 0
  for (const [code, node] of nodes.entries()) {
    const incomingEdges = edges.filter((e) => e.to === code);
    if (incomingEdges.length === 0) {
      courseToRank.set(code, 0);
      rankCourses.set(0, (rankCourses.get(0) ?? []).concat(code));
    }
  }

  // Compute ranks: a course's rank = max(prerequisite ranks) + 1
  // Iterate until stable
  let changed = true;
  while (changed) {
    changed = false;
    for (const [code, node] of nodes.entries()) {
      if (courseToRank.has(code)) continue; // already assigned

      const prereqEdges = edges.filter((e) => e.to === code && courseToRank.has(e.from));
      if (prereqEdges.length > 0) {
        const maxPrereqRank = Math.max(
          ...prereqEdges.map((e) => courseToRank.get(e.from)!)
        );
        const newRank = maxPrereqRank + 1;
        courseToRank.set(code, newRank);
        rankCourses.set(newRank, (rankCourses.get(newRank) ?? []).concat(code));
        changed = true;
      }
    }
  }

  // Assign any remaining (unconnected) courses to rank 0
  for (const code of courseMap.keys()) {
    if (!courseToRank.has(code)) {
      courseToRank.set(code, 0);
      rankCourses.set(0, (rankCourses.get(0) ?? []).concat(code));
    }
  }

  // Compute x (horizontal position) within each rank
  const positionedNodes = new Map<string, { x: number; y: number; rank: number }>();
  for (const [rank, codes] of rankCourses.entries()) {
    codes.forEach((code, index) => {
      positionedNodes.set(code, {
        x: index * 200, // spacing between nodes in same rank
        y: rank * 120, // vertical spacing between ranks
        rank,
      });
    });
  }

  // For TB (portrait), swap x and y
  // For LR (landscape), keep as-is (x = rank position, y = within-ranks position)

  return {
    positionedNodes,
    rankAssignments: rankCourses,
  };
}

/**
 * Convert normalized curriculum to React Flow nodes/edges format.
 * React Flow uses: nodes: { id, position, data }, edges: { id, source, target }
 */
export function normalizedToReactFlow(
  normalized: NormalizedCurriculum,
  options: DagreLayoutOptions = { rankdir: "LR", nodesep: 40, ranksep: 60, marginx: 80, marginy: 80 }
) {
  const { courses, edges, depthMap } = normalized;

  // Create React Flow nodes
  const rfNodes = courses.size > 0 ? Array.from(courses.values()).map((course) => {
    const depth = depthMap.get(course.code) ?? 0;
    const rank = depth; // used for vertical positioning in LR

    // Determine visual properties
    let color = "#64748b"; // gray default
    const catMap: Record<string, string> = {
      university-requirement: "#3b82f6",
      college-requirement: "#10b981",
      major-requirement: "#8b5cf6",
      major-elective: "#f97316",
      free-elective: "#eab308",
    };
    color = catMap[course.category] || "#64748b";

    // Adjust color if completed/locked
    const finalColor = course.isCompleted
      ? lightenColor(color, 80)
      : course.isLocked
        ? lightenColor(color, 50)
        : color;

    return {
      id: course.code,
      position: {
        x: 0, // will be set by layout
        y: 0,
      },
      data: {
        code: course.code,
        name: course.name,
        credits: course.credits,
        category: course.category,
        status: course.progress,
        isLocked: course.isLocked,
        isCompleted: course.isCompleted,
        color: finalColor,
      },
    };
  }) : [];

  // Create React Flow edges
  const rfEdges = edges.map((edge, i) => ({
    id: `edge-${edge.from}-to-${edge.to}-${i}`,
    source: edge.from,
    target: edge.to,
    type: edge.type, // "DIRECT" | "AND" | "OR"
    style: edge.type === "OR" ? "curved" : "orthogonal",
    data: edge.type === "OR" ? { label: "OR" } : undefined,
    status: edge.status,
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

/** Lighten a hex color by a percentage */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round((255 - (num >> 8)) * (percent / 100));
  const r = Math.min(255, ((num >> 16) + amt) | 0);
  const g = Math.min(255, (((num >> 8) & 0x00ff) + amt) | 0);
  const b = Math.min(255, ((num & 0x0000ff) + amt) | 0);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}