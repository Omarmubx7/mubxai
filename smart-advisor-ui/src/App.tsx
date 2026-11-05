/***
 * App - Main application component
 * 
 * Glue together all the pieces:
 * - MajorSelector for choosing which major to display
 * - CurriculumGraph for the interactive DAG
 * - CurriculumFilters for filtering
 * - CourseDetailsPanel for course details
 * - CurriculumLegend for the legend
 * - GraphToolbar for controls
 */
import React, { useState } from "react";
import type { CourseBase } from "./types";
import { MajorSelector } from "./components/MajorSelector/MajorSelector";
import { CurriculumGraph } from "./components/CurriculumGraph/CurriculumGraph";
import { CurriculumFilters } from "./components/CurriculumFilters/CurriculumFilters";
import { CurriculumLegend } from "./components/CurriculumLegend/CurriculumLegend";
import { GraphToolbar } from "./components/GraphToolbar/GraphToolbar";
import { 
  computerScienceCourses, 
  mechanicalEngineeringCourses 
} from "./data/sample/computer-science";
import { useCourseProgress } from "./utils/use-course-progress";

interface AppState {
  selectedMajor: string;
  layoutDirection: "LR" | "TB";
  filters: {
    searchQuery: string;
    level: number | string | undefined;
    category: string | undefined;
    minCredits: number;
    maxCredits: number;
    framework: string | undefined;
  };
  initiallyCompleted: string[];
}

export function App() {
  // State
  const [state, setState] = useState<AppState>({
    selectedMajor: "computer-science",
    layoutDirection: "LR",
    filters: {
      searchQuery: "",
      level: undefined,
      category: undefined,
      minCredits: 0,
      maxCredits: 100,
      framework: undefined,
    },
    initiallyCompleted: [],
  });

  // Available majors
  const majors = {
    "computer-science": {
      key: "computer-science",
      name: "Computer Science",
      courses: computerScienceCourses,
    },
    "mechanical-engineering": {
      key: "mechanical-engineering",
      name: "Mechanical Engineering",
      courses: mechanicalEngineeringCourses,
    },
  };

  // Handle major change
  const handleMajorChange = useCallback((majorKey: string) => {
    setState((prev) => ({ ...prev, selectedMajor: majorKey }));
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((filters: {
    searchQuery: string;
    level: number | string | undefined;
    category: string | undefined;
    minCredits: number;
    maxCredits: number;
    framework: string | undefined;
  }) => {
    setState((prev) => ({ ...prev, filters }));
  }, []);

  // Handle layout direction change
  const handleLayoutChange = useCallback((dir: "LR" | "TB") => {
    setState((prev) => ({ ...prev, layoutDirection: dir }));
  }, []);

  // Handle fit to screen
  const handleFit = useCallback(() => {
    console.log("Fit to screen");
  }, []);

  // Handle reset view
  const handleReset = useCallback(() => {
    console.log("Reset view");
  }, []);

  // Course selection handler
  const handleNodeSelect = useCallback((courseCode: string) => {
    console.log(`Selected course: ${courseCode}`);
  }, []);

  // Course status toggle
  const { toggleStatus } = useCourseProgress(
    Object.values(majors[state.selectedMajor].courses),
    state.initiallyCompleted
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="p-4 border-b border-gray-200 bg-white shadow-sm">
        <h1 className="text-2xl font-bold">
          Curriculum Prerequisite Explorer
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-600">
            {majors[state.selectedMajor]?.name || "Select a Major"}
          </span>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex h-screen">
        {/* Left sidebar - filters and legend */}
        <aside className="w-64 bg-white shadow-md flex flex-col">
          <CurriculumFilters
            initialFilters={state.filters}
            onFilterChange={handleFilterChange}
            availableLevels={[
              ...new Set(
                majors[state.selectedMajor].courses.map((c) => c.level as number).filter((n): n is number => n !== undefined)
              ),
            ]}
            availableCategories={[
              "university-requirement",
              "college-requirement",
              "major-requirement",
              "major-elective",
              "free-elective",
            ] as const}
          />
          
          <CurriculumLegend
            categoryColors={{
              "university-requirement": "#3b82f6",
              "college-requirement": "#10b981",
              "major-requirement": "#8b5cf6",
              "major-elective": "#f97316",
              "free-elective": "#eab308",
            }}
          />
        </aside>

        {/* Right main area - graph and details */}
        <div className="flex-1 flex flex-col">
          <GraphToolbar
            layoutDirection={state.layoutDirection}
            onLayoutChange={handleLayoutChange}
            onFit={handleFit}
            onReset={handleReset}
          />
          
          <CurriculumGraph
            rawCourses={majors[state.selectedMajor].courses}
            majorKey={state.selectedMajor}
            layoutDirection={state.layoutDirection}
            filters={state.filters}
            initiallyCompleted={state.initiallyCompleted}
            onNodeSelect={handleNodeSelect}
            onEdgeHover={(from, to, type) => console.log(`Hover: ${from} -> ${to} (${type})`)}
            showLegend={false} {/* Legend already shown in sidebar */}
          />

          {/* Course Details Panel - appears when a course is selected */}
          <CourseDetailsPanel
            courseCode="--select-course--"
            onClose={() => console.log("Close details")}
            initiallyCompleted={state.initiallyCompleted}
          />
        </div>
      </main>
    </div>
  );
}