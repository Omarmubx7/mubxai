"use client";

/**
 * MindMapNode.tsx
 * Custom React Flow node renderer for the NotebookLM-style mind map.
 *
 * Visual anatomy:
 *  - Root node: large pill, brand gradient, white bold label
 *  - Branch node (depth 1): medium pill with colored left border + accent dot
 *  - Leaf node (depth 2+): small rounded chip with muted fill
 *
 * Clicking a node with children toggles its expansion.
 */

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { motion, type Variants } from "framer-motion";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { MindMapNodeData } from "./mind-map-layout";

// ─── Animation variants ────────────────────────────────────────────────────

const nodeVariants: Variants = {
    hidden: { opacity: 0, scale: 0.72, y: 6 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { type: "spring", stiffness: 340, damping: 28 },
    },
    exit: {
        opacity: 0,
        scale: 0.72,
        y: 4,
        transition: { duration: 0.14 },
    },
};

// ─── Component ─────────────────────────────────────────────────────────────

export const MindMapNode = memo(function MindMapNode({
    id,
    data,
}: Readonly<NodeProps<Node<MindMapNodeData>>>) {
    const {
        label,
        depth,
        hasChildren,
        isExpanded,
        isRoot,
        color,
        childCount,
        onToggleExpand,
    } = data;

    const handleClick = () => {
        if (hasChildren) {
            onToggleExpand(id);
        }
    };

    // ── Root node ──────────────────────────────────────────────────────────
    if (isRoot) {
        return (
            <motion.div
                variants={nodeVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative flex select-none items-center justify-center rounded-2xl px-5 py-3 text-white shadow-xl"
                style={{
                    background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
                    minWidth: 160,
                    minHeight: 48,
                    boxShadow: `0 6px 24px ${color}44`,
                    cursor: hasChildren ? "pointer" : "default",
                }}
                onClick={handleClick}
            >
                {/* React Flow connection handle — invisible, right edge */}
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!h-0 !w-0 !border-0 !bg-transparent !opacity-0"
                />
                <span className="text-sm font-black leading-tight tracking-tight text-center">
                    {label}
                </span>
                {hasChildren && (
                    <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                        {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <ChevronRight className="h-3 w-3" />
                        )}
                    </span>
                )}
            </motion.div>
        );
    }

    // ── Depth-1 branch node (primary topic) ───────────────────────────────
    if (depth === 1) {
        return (
            <motion.div
                variants={nodeVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="group relative flex select-none items-center gap-2 rounded-xl border border-l-4 bg-white py-2 pl-3 pr-3 shadow-sm transition-all duration-150"
                style={{
                    borderLeftColor: color,
                    borderColor: `${color}30`,
                    minWidth: 140,
                    minHeight: 40,
                    cursor: hasChildren ? "pointer" : "default",
                    boxShadow: `0 2px 10px ${color}18`,
                }}
                whileHover={
                    hasChildren
                        ? { y: -1, boxShadow: `0 4px 16px ${color}30` }
                        : {}
                }
                onClick={handleClick}
            >
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!h-0 !w-0 !border-0 !bg-transparent !opacity-0"
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!h-0 !w-0 !border-0 !bg-transparent !opacity-0"
                />

                {/* Colored accent dot */}
                <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: color }}
                />

                <span
                    className="flex-1 text-xs font-bold leading-tight text-[#222d32]"
                    style={{ maxWidth: 130 }}
                >
                    {label}
                </span>

                {/* Expand/collapse chevron + child count badge */}
                {hasChildren && (
                    <span
                        className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-black"
                        style={{
                            background: `${color}18`,
                            color,
                        }}
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <>
                                <ChevronRight className="h-3 w-3" />
                                <span>{childCount}</span>
                            </>
                        )}
                    </span>
                )}
            </motion.div>
        );
    }

    // ── Depth 2+ leaf / sub-topic node ────────────────────────────────────
    return (
        <motion.div
            variants={nodeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="group relative flex select-none items-center gap-2 rounded-lg border bg-[#f8fafc] py-1.5 pl-2.5 pr-2.5 shadow-xs transition-all duration-150"
            style={{
                borderColor: `${color}30`,
                minWidth: 120,
                minHeight: 36,
                cursor: hasChildren ? "pointer" : "default",
            }}
            whileHover={
                hasChildren
                    ? { backgroundColor: `${color}08`, borderColor: `${color}60` }
                    : {}
            }
            onClick={handleClick}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="!h-0 !w-0 !border-0 !bg-transparent !opacity-0"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!h-0 !w-0 !border-0 !bg-transparent !opacity-0"
            />

            {/* Tiny accent line instead of dot at deep levels */}
            <span
                className="h-3 w-0.5 shrink-0 rounded-full opacity-70"
                style={{ background: color }}
            />

            <span className="flex-1 text-[11px] font-semibold leading-tight text-[#374151]">
                {label}
            </span>

            {hasChildren && (
                <span style={{ color }} className="shrink-0">
                    {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                    ) : (
                        <ChevronRight className="h-3 w-3" />
                    )}
                </span>
            )}
        </motion.div>
    );
});
