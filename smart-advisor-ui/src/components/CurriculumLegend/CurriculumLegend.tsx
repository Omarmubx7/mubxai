/***
 * CurriculumLegend
 * 
 * Legend component that explains node colors, edge types, and status indicators.
 * 
 * Props:
 * - categoryColors?: Record<CourseCategory, string> - custom color mapping
 * - showStatus: boolean - whether to show completed/in-progress/locked indicators
 */
import React from "react";
import type { CourseCategory } from "../types";

interface CurriculumLegendProps {
  categoryColors?: Record<CourseCategory, string>;
  showStatus?: boolean;
}

export function CurriculumLegend({
  categoryColors,
  showStatus = true,
}: CurriculumLegendProps) {
  // Default color mapping
  const colors = categoryColors || {
    "university-requirement": "#3b82f6",
    "college-requirement": "#10b981",
    "major-requirement": "#8b5cf6",
    "major-elective": "#f97316",
    "free-elective": "#eab308",
  };

  return (
    <div className="p-4 bg-gray-50 border-l-4 border-blue-500 rounded-tl-xl shadow-md max-w-xs">
      <h3 className="font-medium text-sm mb-3">Legend</h3>
      
      {/* Category colors */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        {Object.entries(colors).map(([category, color]) => (
          <div key={category} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded" 
              style={{ background: color }}
            />
            <span>{category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
          </div>
        ))}
      </div>

      {/* Status indicators */}
      {showStatus && (
        <div>
          <p className="text-xs mb-2 block">Course Status</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-200" />
              <span>Not Started</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-100" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-100" />
              <span>In Progress</span>
            </div>
          </div>
        </div>
      )}

      {/* Edge type indicators */}
      <div>
        <p className="text-xs mb-2 block mt-4">Edge Types</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded" 
              style={{ background: "#64748b", strokeWidth: 2, border: "1px solid #64748b" }}
            />
            <span>Direct</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded" 
              style={{ background: "#8b5cf6", strokeWidth: 2 }}
            />
            <span>AND</span>
          </div>
          <div className="flex items-center gap-2">
            <svg
              width="4"
              height="4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 3l7 7-7 7" />
              <span>OR</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}