/***
 * CourseDetailsPanel
 * 
 * Side panel that displays detailed information about a selected course.
 * Shows prerequisites, corequisites, description, and allows status updates.
 * 
 * Props:
 * - courseCode: selected course code
 * - onClose: callback to close the panel
 * - onStatusChange: (status: CourseStatus) => void - called when user changes status
 * - showPrereqs: boolean - whether to show prerequisite chain
 * - showDependents: boolean - whether to show courses that depend on this one
 */
import React, { useState, useEffect } from "react";
import type { Course } from "../types";
import { useCourseProgress } from "../utils/use-course-progress";
import { useCurriculumLayout } from "../utils/use-curriculum-layout";

interface CourseDetailsPanelProps {
  courseCode: string;
  onClose: () => void;
  initiallyCompleted?: string[];
}

export function CourseDetailsPanel({
  courseCode,
  onClose,
  initiallyCompleted = [],
}: CourseDetailsPanelProps) {
  // Find the course in the curriculum
  // Note: In a real app, this would receive the course data from parent
  const [course, setCourse] = useState<Course | null>(null);
  const [prereqChain, setPrereqChain] = useState<string[]>([]);
  const [dependentChain, setDependentChain] = useState<string[]>([]);
  const [showPrereqs, setShowPrereqs] = useState(false);
  const [showDependents, setShowDependents] = useState(false);

  // Load course data and compute chains when courseCode changes
  useEffect(() => {
    // In a real implementation, the parent would pass course data
    // For now, simulate with a placeholder
    setCourse({
      id: courseCode,
      code: courseCode,
      name: `Course ${courseCode}`,
      credits: 3,
      category: "major-requirement",
      level: 2,
      prerequisites: ["CORE101", "MATH101"],
      corequisites: [],
      description: "Course description goes here.",
      framework: "Custom",
      isLocked: false,
      isCompleted: false,
      progress: "not-started",
    });
  }, [courseCode]);

  // Compute prerequisite chain
  useEffect(() => {
    if (!course) return;
    
    // Build the full prerequisite chain
    const chain: Set<string> = new Set();
    
    function buildChain(code: string) {
      const edges = course.prerequisites?.map((c: string) => c) || [];
      for (const prereq of edges) {
        if (!chain.has(prereq)) {
          chain.add(prereq);
          buildChain(prereq); // Recursively add prerequisites of prerequisites
        }
      }
    }
    
    buildChain(course.code);
    setPrereqChain(Array.from(chain));
  }, [course]);

  // Compute dependent chain (courses that depend on this one)
  useEffect(() => {
    if (!course) return;
    
    // In a real implementation, this would query the graph edges
    // For now, set an empty chain
    setDependentChain([]);
  }, [course]);

  // Handle status change
  const handleStatusChange = useCallback((newStatus: "not-started" | "in-progress" | "completed") => {
    // Would call parent's toggleStatus
    console.log(`Marking ${courseCode} as ${newStatus}`);
  }, [courseCode]);

  // Apply progress from hook if available
  const progress = useCourseProgress([course], initiallyCompleted);

  return (
    <div 
      className="fixed right-0 top-0 h-screen w-80 bg-white shadow-2xl transform translate-x-full transition-transform duration-300 overflow-y-auto z-50"
      style={{ x: 1 }}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-lg">
            {course?.name || `Course ${courseCode}`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close details panel"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                className="stroke-2"
                d="M6 18L18 6M6 6l12 12"
              />
            </button>
          </button>
        </div>

        {/* Course info section */}
        <div className="p-4 flex-1">
          {course && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Code</p>
                <p className="font-medium">{course.code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Credits</p>
                <p className="font-medium">{course.credits} CH</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Level</p>
                <p className="font-medium">{course.level || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Category</p>
                <p className="font-medium">{course.category}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mt-2 line-clamp-3">
              {course.description || "No description available."}
            </p>
          )}
        </div>

        {/* Prerequisite chain section */}
        {showPrereqs && course && (
          <div className="p-4 h-64 overflow-y-auto">
            <p className="text-sm font-medium mb-2">Prerequisite Chain</p>
            {prereqChain.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {prereqChain.map((code) => (
                  <li key={code} className="flex items-center">
                    <span
                      className={`px-2 py-1 rounded text-[2px] ${
                        progress.progress.has(code) && progress.progress.get(code) === "completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"}
                    >
                      {code}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No prerequisites</p>
            )}
          </div>
        )}

        {/* Dependent chain section */}
        {showDependents && course && (
          <div className="p-4 h-64 overflow-y-auto">
            <p className="text-sm font-medium mb-2">Courses That Depend on This</p>
            {dependentChain.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {dependentChain.map((code) => (
                  <li key={code} className="flex items-center">
                    <span className="px-2 py-1 rounded text-[2px] bg-blue-100 text-blue-800">
                      {code}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No dependent courses found</p>
            )}
          </div>
        )}

        {/* Status update section */}
        <div className="p-4 border-t border-gray-200">
          <p className="text-sm font-medium mb-2">Mark Progress</p>
          <div className="space-y-2">
            <button
              onClick={() => handleStatusChange("not-started")}
              className={`w-full px-3 py-2 rounded text-sm ${
                progress.progress.get(courseCode) === "not-started"
                  ? "bg-green-100 text-green-800 border border-green-400"
                  : "border-gray-300 hover:bg-gray-100"}
              }
            >
              Not Started
            </button>
            <button
              onClick={() => handleStatusChange("in-progress")}
              className={`w-full px-3 py-2 rounded text-sm ${
                progress.progress.get(courseCode) === "in-progress"
                  ? "bg-yellow-100 text-brown-800 border border-yellow-400"
                  : "border-gray-300 hover:bg-gray-100"}
              }
            >
              In Progress
            </button>
            <button
              onClick={() => handleStatusChange("completed")}
              className={`w-full px-3 py-2 rounded text-sm ${
                progress.progress.get(courseCode) === "completed"
                  ? "bg-green-100 text-green-800 border border-green-400"
                  : "border-gray-300 hover:bg-gray-100"}
              }
            >
              Completed
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <button onClick={onClose} className="text-sm text-gray-500">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}