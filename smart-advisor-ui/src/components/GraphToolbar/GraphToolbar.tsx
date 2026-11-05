/***
 * GraphToolbar
 * 
 * Toolbar with zoom, pan, fit, reset, and layout direction controls.
 * 
 * Props:
 * - layoutDirection: current direction "LR" | "TB"
 * - onLayoutChange: (dir: "LR" | "TB") => void
 * - onFit: () => void
 * - onReset: () => void
 */
import React from "react";
import { useCallback } from "react";

interface GraphToolbarProps {
  layoutDirection: "LR" | "TB";
  onLayoutChange: (dir: "LR" | "TB") => void;
  onFit: () => void;
  onReset: () => void;
}

export function GraphToolbar({
  layoutDirection,
  onLayoutChange,
  onFit,
  onReset,
}: GraphToolbarProps) {
  return (
    <div className="p-4 bg-gray-50 border-b border-gray-200 sticky top-0 z-10 background-white">
      <h3 className="font-medium text-sm mb-4">Graph Tools</h3>
      
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Fit to screen */}
        <button
          onClick={onFit}
          className="flex-1 py-2 rounded border px-3 text-sm hover:bg-gray-100"
          title="Fit to Screen"
        >
          Fit
        </button>
        
        {/* Reset view */}
        <button
          onClick={onReset}
          className="flex-1 py-2 rounded border px-3 text-sm hover:bg-gray-100"
          title="Reset View"
        >
          Reset
        </button>
      </div>

      {/* Layout direction toggle */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => onLayoutChange("LR")}
          className={`
            flex-1 py-2 rounded border px-3 text-sm ${
              layoutDirection === "LR" ? "bg-primary text-white" : "border"
            }
          `}
          title="Landscape (Left-to-Right)"
        >
          LR
        </button>
        <button
          onClick={() => onLayoutChange("TB")}
          className={`
            flex-1 py-2 rounded border px-3 text-sm ${
              layoutDirection === "TB" ? "bg-primary text-white" : "border"
            }
          `}
          title="Portrait (Top-to-Bottom)"
        >
          TB
        </button>
      </div>

      {/* Zoom controls */}
      <div className="grid grid-cols-4 gap-2">
        <button
          className="flex-1 py-1 rounded border px-2 text-[10] hover:bg-gray-100"
          title="Zoom Out"
        >
          −
        </button>
        <span className="flex-1 py-1 text-[10] border border-gray-300">
          100%
        </span>
        <button
          className="flex-1 py-1 rounded border px-2 text-[10] hover:bg-gray-100"
          title="Zoom In"
        >
          +
        </button>
      </div>
    </div>
  );
}