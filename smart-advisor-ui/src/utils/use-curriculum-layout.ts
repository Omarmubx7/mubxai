/**
 * useCurriculumLayout
 * 
 * React hook that manages the curriculum graph state and layout computation.
 * Recalculates whenever:
 * - selected major changes
 * - filters change
 * - layout direction changes
 * - course data updates
 */
import { useState, useEffect, useCallback } from "react";
import type {
  CourseBase,
  NormalizedCurriculum,
  ValidationResult,
  DagreLayoutOptions,
  Course,
  PrerequisiteEdge,
} from "../types";
import { normalizeCurriculum } from "./normalize-curriculum";
import { normalizedToReactFlow } from "./build-prerequisite-graph";
import { detectCycles } from "./normalize-curriculum";

/**
 * Options for the hook configuration
 */
interface UseCurriculumLayoutOptions {
  /** Raw course data for the selected major */
  rawCourses: CourseBase[];
  /** Key identifier for the current major */
  majorKey: string;
  /** Current layout direction */
  layoutDirection: "LR" | "TB";
  /** Current filters object */
  filters?: {
    searchQuery?: string;
    level?: number | string;
    category?: string;
    minCredits?: number;
    maxCredits?: number;
    framework?: string;
  };
}

/**
 * Returns the normalized curriculum state and React Flow ready nodes/edges.
 */
export function useCurriculumLayout(
  options: UseCurriculumLayoutOptions
) {
  const [normalized, setNormalized] = useState<NormalizedCurriculum | null>(null);
  const [rfResult, setRfResult] = useState<{
    nodes: Array<{ id: string; position: { x: number; y: number }; data: any }>;
    edges: Array<{ id: string; source: string; target: string; type: string; style?: string; data?: any }>;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValid, setIsValid] = useState(true);
  const [layoutOptions, setLayoutOptions] = useState<DagreLayoutOptions>({
    rankdir: "LR",
    nodesep: 40,
    ranksep: 60,
    marginx: 80,
    marginy: 80,
  });

  // Recalculate when rawCourses, majorKey, layoutDirection, or filters change
  useEffect(() => {
    // Normalize the curriculum
    const result = normalizeCurriculum(options.rawCourses, options.majorKey);
    setNormalized(result);
    setValidationErrors(result.validation.errors);
    setIsValid(result.validation.valid);

    // Convert to React Flow format
    const flowResult = normalizedToReactFlow(result, layoutOptions);
    setRfResult(flowResult);

    // If there are circular prerequisites, warn but don't block
    if (!result.validation.valid) {
      console.warn("Curriculum validation failed:", result.validation.errors);
    }
  }, [
    options.rawCourses,
    options.majorKey,
    layoutOptions.rankdir,
    options.filters,
  ]);

  // Re-assign positions when layout direction changes
  useEffect(() => {
    if (!normalized || !rfResult) return;

    const result = assignLayoutPositions(
      new Map(normalized.courses!.map((c) => [c.code, {
        id: c.code,
        label: c.name,
        width: 300,
        height: 200,
      }] as { id: string; label: string; width: number; height: number })),
      normalized.edges,
      layoutOptions
    );

    // Update node positions
    const positionedNodes = rfResult.nodes.map((node) => {
      const pos = result.positionedNodes.get(node.id) || { x: 0, y: 0 };
      return {
        ...node,
        position: { x: pos.x, y: pos.y },
      };
    });

    setRfResult({
      ...rfResult,
      nodes: positionedNodes,
    });
  }, [layoutOptions.rankdir, normalized, rfResult]);

  return {
    // State
    normalized,
    rfResult,
    validationErrors,
    isValid,
    layoutOptions,

    // Actions
    refresh: () => {
      // Trigger recalculation by setting state
      // (handled by the dependency array above)
    },
    setLayoutDirection: (dir: "LR" | "TB") => {
      setLayoutOptions((prev) => ({ ...prev, rankdir: dir }));
    },
    setLayoutOptions: (opts: Partial<DagreLayoutOptions>) => {
      setLayoutOptions((prev) => ({ ...prev, ...opts }));
    },
  };
}