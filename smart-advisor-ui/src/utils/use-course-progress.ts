/**
 * useCourseProgress
 * 
 * Hook for managing user progress through the curriculum.
 * Persists course status (not-started, in-progress, completed) to localStorage.
 * Also tracks which courses become available/unlocked based on completed prerequisites.
 */
import { useState, useEffect, useCallback } from "react";
import type {
  Course,
  CourseStatus,
  PrerequisiteEdge,
} from "../types";

interface ProgressState {
  /** Map of course code -> user progress status */
  progress: Map<string, CourseStatus>;
  /** Set of completed course codes */
  completedCodes: Set<string>;
  /** Set of in-progress course codes */
  inProgressCodes: Set<string>;
}

/**
 * Load progress from localStorage or return default state.
 */
function loadProgressFromStorage(): Map<string, CourseStatus> {
  try {
    const stored = localStorage.getItem("curriculum_progress");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert string keys back to Map
      return new Map(Object.entries(parsed) as [string, CourseStatus][]);
    }
  } catch (e) {
    console.warn("Could not load progress from localStorage", e);
  }
  return new Map();
}

/**
 * Save progress to localStorage.
 */
function saveProgressToStorage(progress: Map<string, CourseStatus>): void {
  try {
    const serialized = Object.fromEntries(progress);
    localStorage.setItem("curriculum_progress", JSON.stringify(serialized));
  } catch (e) {
    console.warn("Could not save progress to localStorage", e);
  }
}

/**
 * Hook for course progress management.
 */
export function useCourseProgress(
  initialCourses: Course[],
  initiallyCompleted?: string[]
) {
  const [progress, setProgress] = useState<Map<string, CourseStatus>>(
    () => {
      const loaded = loadProgressFromStorage();
      // Apply initially completed courses
      if (initiallyCompleted && initiallyCompleted.length > 0) {
        initiallyCompleted.forEach((code) => {
          if (loaded.has(code)) {
            loaded.set(code, "completed");
          } else {
            // Add new entry as completed
            loaded.set(code, "completed");
          }
        });
      }
      return loaded;
    }
  );

  const completedCodes = new Set(
    progress.entries().filter(([_, status]) => status === "completed").map(([code]) => code)
  );
  const inProgressCodes = new Set(
    progress.entries().filter(([_, status]) => status === "in-progress").map(([code]) => code)
  );

  // Mark a course as completed
  const markCompleted = useCallback((courseCode: string) => {
    setProgress((prev) => {
      const newProgress = new Map(prev);
      newProgress.set(courseCode, "completed");
      saveProgressToStorage(newProgress);
      return newProgress;
    });
    // Also update the set for immediate reactivity
    completedCodes.add(courseCode);
    inProgressCodes.delete(courseCode);
  });

  // Mark a course as in-progress
  const markInProgress = useCallback((courseCode: string) => {
    setProgress((prev) => {
      const newProgress = new Map(prev);
      newProgress.set(courseCode, "in-progress");
      saveProgressToStorage(newProgress);
      return newProgress;
    });
    inProgressCodes.add(courseCode);
    completedCodes.delete(courseCode);
  });

  // Mark a course as not-started
  const markNotStarted = useCallback((courseCode: string) => {
    setProgress((prev) => {
      const newProgress = new Map(prev);
      newProgress.set(courseCode, "not-started");
      saveProgressToStorage(newProgress);
      return newProgress;
    });
    completedCodes.delete(courseCode);
    inProgressCodes.delete(courseCode);
  });

  // Toggle course status
  const toggleStatus = useCallback((courseCode: string) => {
    setProgress((prev) => {
      const newProgress = new Map(prev);
      const current = newProgress.get(courseCode) ?? "not-started";
      let nextStatus: CourseStatus;
      if (current === "not-started") nextStatus = "in-progress";
      else if (current === "in-progress") nextStatus = "completed";
      else nextStatus = "not-started";
      newProgress.set(courseCode, nextStatus);
      saveProgressToStorage(newProgress);
      return newProgress;
    });
  }, []);

  // Get available courses: courses whose all prerequisites are completed
  const getAvailableCourses = useCallback(
    (allEdges: PrerequisiteEdge[]): string[] => {
      const available: string[] = [];
      for (const [code, status] of progress.entries()) {
        if (status !== "not-started") continue; // only courses not started yet
        
        // Check all prerequisites for this course
        const prereqEdges = allEdges.filter((e) => e.to === code);
        const allPrereqsMet = prereqEdges.every((e) => 
          completedCodes.has(e.from)
        );
        
        if (allPrereqsMet) {
          available.push(code);
        }
      }
      return available;
    },
    [completedCodes]
  );

  // Get locked courses: courses that have unmet prerequisites
  const getLockedCourses = useCallback(
    (allEdges: PrerequisiteEdge[]): string[] => {
      const locked: string[] = [];
      for (const [code, status] of progress.entries()) {
        if (status === "not-started") {
          const prereqEdges = allEdges.filter((e) => e.to === code);
          const unmetPrereqs = prereqEdges.filter((e) => !completedCodes.has(e.from));
          if (unmetPrereqs.length > 0) {
            locked.push(code);
          }
        }
      }
      return locked;
    },
    [completedCodes]
  );

  // Initialize from localStorage + initiallyCompleted
  useEffect(() => {
    if (initiallyCompleted && initiallyCompleted.length > 0) {
      initiallyCompleted.forEach((code) => markCompleted(code));
    }
  }, [initiallyCompleted, markCompleted]);

  return {
    // State
    progress,
    completedCodes,
    inProgressCodes,
    isCourseCompleted: (code: string) => completedCodes.has(code),
    isCourseInProgress: (code: string) => inProgressCodes.has(code),
    isCourseNotStarted: (code: string) => !completedCodes.has(code) && !inProgressCodes.has(code),

    // Actions
    markCompleted,
    markInProgress,
    markNotStarted,
    toggleStatus,

    // Derived
    availableCourses: getAvailableCourses,
    lockedCourses: getLockedCourses,
    totalCompleted: completedCodes.size,
    totalInProgress: inProgressCodes.size,
  };
}