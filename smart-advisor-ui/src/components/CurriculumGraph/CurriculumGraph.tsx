/***
 * CurriculumGraph
 * 
 * Main component that renders the Course-Prerequisite Network using React Flow.
 * Uses Dagre for automatic DAG layout.
 * Supports landscape (LR) and portrait (TB) layouts.
 * Handles zooming, panning, fitting, and course selection.
 * 
 * Props:
 * - nodes: React Flow node elements
 * - edges: React Flow edge elements
 * - onNodeSelect: (courseCode: string) => void - click handler
 * - onEdgeHover: (edgeInfo: { from: string; to: string; type: string }) => void
 * - layoutDirection: "LR" | "TB"
 * - showLegend: boolean
 * - className: string
 */
import React from "react";
import {
  Flow,
  Node,
  Edge,
  MiniMap,
  Controls,
  Ruler,
  Grid,
  Background,
} from "@xyflow/react";
import {
  ArrowDefault,
  ArrowDefaultCenter,
  ArrowDiamond,
  ArrowNone,
} from "@xyflow/react";
import { useMemo } from "react";
import type { Course } from "../types";
import { useCourseProgress } from "../utils/use-course-progress";
import { useCurriculumLayout } from "../utils/use-curriculum-layout";

interface CurriculumGraphProps {
  /** Raw course data for the selected major */
  rawCourses: CourseBase[];
  /** Key of the currently selected major */
  majorKey: string;
  /** Current layout direction */
  layoutDirection: "LR" | "TB";
  /** Filters state */
  filters?: {
    searchQuery?: string;
    level?: number | string;
    category?: string;
    minCredits?: number;
    maxCredits?: number;
    framework?: string;
  };
  /** Initially completed course codes */
  initiallyCompleted?: string[];
  /** Callback when a course node is clicked */
  onNodeSelect: (courseCode: string) => void;
  /** Callback when edge is hovered */
  onEdgeHover?: (from: string; to: string; type: string) => void;
  /** Show legend */
  showLegend?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function CurriculumGraph({
  rawCourses,
  majorKey,
  layoutDirection = "LR",
  filters,
  initiallyCompleted = [],
  onNodeSelect,
  onEdgeHover,
  showLegend = true,
  className,
}: CurriculumGraphProps) {
  // Use the layout hook to normalize and compute positions
  const layoutResult = useCurriculumLayout({
    rawCourses,
    majorKey,
    layoutDirection,
    filters,
    initiallyCompleted,
  });

  // Use course progress hook
  const progressResult = useCourseProgress(rawCourses, initiallyCompleted);

  // Extract derived state
  const { nodes, edges, validationErrors, isValid, layoutOptions } = layoutResult;
  const {
    progress,
    completedCodes,
    inProgressCodes,
    availableCourses,
    lockedCourses,
    toggleStatus,
    markCompleted,
    markInProgress,
    markNotStarted,
  } = progressResult;

  // Filter nodes and edges based on current filters
  const filteredNodes = useMemo(() => {
    if (!nodes) return [];
    
    return nodes.filter((node) => {
      const data = node.data;
      if (!data) return true;
      
      const matchesSearch = 
        filters?.searchQuery && 
        !data.code.toLowerCase().includes(filters.searchQuery.toLowerCase()) &&
        !data.name.toLowerCase().includes(filters.searchQuery.toLowerCase());
      
      if (matchesSearch) return false;
      
      const matchesLevel = 
        filters?.level !== undefined && 
        data.level !== undefined && 
        data.level !== filters.level;
      
      if (matchesLevel) return false;
      
      const matchesCategory = 
        filters?.category && 
        data.category !== filters.category;
      
      if (matchesCategory) return false;
      
      const matchesCredits = 
        filters?.minCredits !== undefined && 
        data.credits < filters.minCredits;
      
      if (matchesCredits) return false;
      
      const matchesMaxCredits = 
        filters?.maxCredits !== undefined && 
        data.credits > filters.maxCredits;
      
      if (matchesMaxCredits) return false;
      
      const matchesFramework = 
        filters?.framework && 
        data.framework !== filters.framework;
      
      if (matchesFramework) return false;
      
      return true;
    });
  }, [nodes, filters]);

  // Apply progress-based styling to nodes
  const styledNodes = useMemo(() => {
    if (!filteredNodes) return [];
    
    return filteredNodes.map((node) => {
      const data = node.data;
      if (!data) return node;
      
      const code = data.code;
      const status = progress.code ? progress.progress.get(code) : undefined;
      const isCompleted = completedCodes.has(code);
      const isInProgress = inProgressCodes.has(code);
      const isLocked = !availableCourses.includes(code) && !isCompleted && !isInProgress;
      
      // Determine opacity and style based on status
      let opacity = 1;
      let strokeWidth = 2;
      let dashArray: string | undefined;
      
      if (isLocked) {
        opacity = 0.5;
        strokeWidth = 1;
        dashArray = "5, 5";
      }
      
      if (isCompleted && !isLocked) {
        opacity = 0.8;
      }
      
      if (isInProgress && !isCompleted) {
        opacity = 0.9;
      }
      
      // Check if course is available (all prereqs met)
      const isAvailable = availableCourses.includes(code);
      
      return {
        ...node,
        data: {
          ...data,
          status,
          isCompleted,
          isInProgress,
          isLocked,
          isAvailable,
          opacity,
          strokeWidth,
          dashArray,
        },
      };
    });
  }, [filteredNodes, progress, completedCodes, inProgressCodes, availableCourses]);

  // Apply progress-based styling to edges
  const styledEdges = useMemo(() => {
    if (!edges) return [];
    
    return edges.map((edge) => {
      const isRelatedToCompleted = Array.from(completedCodes).some(
        (code) => code === edge.source || code === edge.target
      );
      
      let opacity = isRelatedToCompleted ? 1 : 0.3;
      let strokeWidth = isRelatedToCompleted ? 2 : 1;
      let style = "orthogonal";
      
      if (edge.type === "OR") {
        style = "curved";
      }
      
      return {
        ...edge,
        data: {
          ...edge.data,
          opacity,
          strokeWidth,
          style,
        },
        // Apply the style directly
        style: {
          strokeWidth,
          opacity,
          ...(edge.type === "OR" ? { strokeDasharray: [4, 2] } : {}),
        },
      };
    });
  }, [edges, completedCodes, availableCourses]);

  // Handle node click - open details panel
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const course = nodes?.find((n) => n.id === nodeId);
      if (course && course.data) {
        onNodeSelect(course.data.code);
      }
    },
    [nodes, onNodeSelect]
  );

  // Handle status toggle (completed/in-progress/not-started)
  const handleStatusToggle = useCallback(
    (courseCode: string) => {
      toggleStatus(courseCode);
    },
    [toggleStatus]
  );

  // Fit to screen
  const fit = useCallback(() => {
    // React Flow fit logic
    // In a real implementation, would interact with the ref
    console.log("Fit to screen");
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    console.log("Reset view");
  }, []);

  return (
    <div className={`relative h-[600px] w-full ${className}`}>
      {/* Layout direction toggle buttons */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => layoutOptions.rankdir === "LR" ? null : null}
          className={`
            px-3 py-1 rounded border ${layoutDirection === "LR" ? "bg-primary text-white" : "border"}
          `}
          title="Landscape (Left-to-Right)"
        >
          LR
        </button>
        <button
          onClick={() => {}}
          className={`
            px-3 py-1 rounded border ${layoutDirection === "TB" ? "bg-primary text-white" : "border"}
          `}
          title="Portrait (Top-to-Bottom)"
        >
          TB
        </button>
      </div>

      {/* React Flow canvas */}
      <Flow
        ref={(ref) => {
          // Store ref for fit/reset operations
          // @ts-ignore
          window.flowRef = ref;
        }}
        nodes={nodes || []}
        edges={edges || []}
        onNodeClick={(e) => {
          const nodeId = e.node.id;
          handleNodeClick(nodeId);
        }}
        onEdgeClick={(e) => {
          const edgeId = e.edge.id;
          console.log("Edge clicked:", edgeId);
        }}
        onNodeHover={(e) => {
          if (e.node) {
            const nodeId = e.node.id;
            // Find the edge info for highlighting
            onEdgeHover?.(nodeId, nodeId, "DIRECT");
          }
        }}
        zoom={1}
        pan={0}
        tooltip={true}
        collapse={false}
        connect={false}
        disconnect={false}
        drag={true}
        thisCanAccept = {(e) => true}
        thatCanAccept = {(e) => true}
        selectNodesOnClick={true}
        activateOnDrag={true}
        attachTo = "box"
        panDelta = {10}
        panBoundary = {20}
        accessibilityLayer={true}
        style={{ height: "calc(80vh - 80px)", width: "100%" }}
      >
        {/* Mini map for navigation */}
        <MiniMap
          width={150}
          height={100}
          style={{ margin: "1rem" }}
          miniatura={{ width: 300, height: 200 }}
        />
        
        {/* Navigation controls */}
        <Controls
          className="flex items-center gap-2"
          style={{ margin: "1rem" }}
        />
        
        {/* Ruler for measurement */}
        <Ruler
          className=""
          style={{ margin: "1rem" }}
        />
        
        {/* Grid background */}
        <Grid
          size={40}
          style={{ opacity: 0.1 }}
          margin={40}
        />
        
        {/* Background with gradient */}
        <Background
          color="#f8fafc"
          style={{ padding: "20px" }}
        />
        
        {/* Course nodes */}
        {styledNodes.map((node) => (
          <Node
            key={node.id}
            id={node.id}
            position={node.position}
            data={node.data}
            style={{
              width: 320,
              height: 140,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "12px",
              borderRadius: "8px",
              cursor: "pointer",
              userSelect: "none",
              transition: "all 0.2s ease",
              boxSizing: "border-box",
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleNodeClick(node.id);
            }}
            onMouseEnter={(e) => {
              // Highlight this node's connections
              const code = node.data?.code;
              if (code && onEdgeHover) {
                // Highlight direct prerequisites
                const prereqEdges = edges?.filter((e) => e.target === code) || [];
                onEdgeHover(code, code, "prereq-highlight");
                
                // Highlight dependents
                const depEdges = edges?.filter((e) => e.source === code) || [];
                depEdges.forEach((e) => onEdgeHover(e.source, e.target, e.type));
              }
            }}
            onMouseLeave={() => {
              onEdgeHover?.("", "", "clear");
            }}
          >
            <div className="flex items-start gap-2">
              {/* Course code badge */}
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded ${node.data?.isLocked 
                  ? "bg-gray-200 text-gray-600"
                  : node.data?.isCompleted 
                    ? "bg-green-100 text-green-800"
                    : node.data?.isInProgress 
                      ? "bg-yellow-100 text-brown-800"
                      : "bg-blue-100 text-blue-800"}`
              }>
                {node.data.code}
              </span>
              
              {/* Course name */}
              <span className="flex-1 truncate text-sm line-clamp-2">
                {node.data.name}
              </span>
            </div>
            
            {/* Bottom row: credits, status */}
            <div className="flex items-center gap-2 text-xs pt-1">
              <span className="text-gray-500">{node.data.credits ?? 3} CH</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[2px] ${
                  node.data.isCompleted ? "bg-green-100 text-green-800" :
                  node.data.isInProgress ? "bg-yellow-100 text-brown-800" :
                  node.data.isLocked ? "bg-gray-200 text-gray-500" :
                  "bg-blue-100 text-blue-800"
                }`}
              >
                {node.data.status ?? "not-started"}
              </span>
            </div>
          </Node>
        ))}

        {/* Edges */}
        {styledEdges.map((edge) => (
          <Edge
            key={edge.id}
            id={edge.id}
            source={edge.source}
            target={edge.target}
            type={edge.type || "bezier"}
            style={{
              strokeWidth: edge.data?.strokeWidth || 1,
              opacity: edge.data?.opacity ?? 1,
              strokeDasharray: edge.data?.dashArray,
              ...(edge.data?.style === "curved" ? { strokeDasharray: [4, 2] } : {}),
            }}
            targetArrow={edge.type === "OR" ? "arrow" : undefined}
            className="transition-opacity"
          />
        ))}
      </Flow>

      {/* Legend (when showLegend is true) */}
      {showLegend && (
        <div 
          className="absolute right-4 top-4 bg-white/90 p-4 rounded-xl shadow-xl max-w-xs"
        >
          <h3 className="font-medium mb-3 text-sm">Legend</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ background: "#3b82f6" }} />
                <span>University requirements</span>
              </div>
              <span className="block">Blue nodes</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ background: "#10b981" }} />
                <span>College requirements</span>
              </div>
              <span className="block">Green nodes</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ background: "#8b5cf6" }} />
                <span>Major requirements</span>
              </div>
              <span className="block">Purple nodes</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ background: "#f97316" }} />
                <span>Major electives</span>
              </div>
              <span className="block">Orange nodes</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ background: "#eab308" }} />
                <span>Free electives</span>
              </div>
              <span className="block">Yellow nodes</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded" style={{ background: "#64748b" }} />
              <span>Not started</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-green-100" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded bg-yellow-100" />
              <span>In progress</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded opacity-50" style={{ background: "#64748b" }} />
              <span>Locked</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}