"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { ExplorerNodeData } from "@/lib/course-tree/explorer-layout";
import { ROADMAP_STATUS_THEME } from "./visuals";

export const PrerequisiteExplorerNode = memo(function PrerequisiteExplorerNode({
    data,
}: Readonly<NodeProps<Node<ExplorerNodeData>>>) {
    const theme = ROADMAP_STATUS_THEME[data.status];
    const isTB = data.direction === "TB";

    return (
        <div
            role="button"
            tabIndex={0}
            data-testid="explorer-node"
            data-code={data.code}
            data-status={data.status}
            onClick={() => data.onSelect(data.code)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    data.onSelect(data.code);
                }
            }}
            title={`${data.name} — ${data.status}`}
            aria-label={`${data.name} (${data.code}), ${data.status}. Focus this course.`}
            className={`flex cursor-pointer flex-col justify-between rounded-xl border-2 bg-white p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dc4835] ${
                data.isRoot
                    ? "border-[#dc4835] bg-[#dc4835]/[0.04] shadow-md ring-2 ring-[#dc4835]/25"
                    : theme.card
            }`}
            style={{ width: isTB ? 164 : 200, minHeight: isTB ? 70 : 80 }}
        >
            <Handle
                type="target"
                position={isTB ? Position.Top : Position.Left}
                className="!h-2 !w-2 !border-0 !bg-[#94a3b8]"
            />

            <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[9.5px] font-black tracking-[0.12em] text-[#92604c]">
                    {data.code}
                </span>
                <span
                    className="flex items-center gap-1 rounded-full border px-1.5 py-px text-[7.5px] font-black uppercase tracking-[0.1em]"
                    style={{ color: theme.text, borderColor: `${theme.dot}55`, background: `${theme.dot}14` }}
                >
                    <span className="h-1 w-1 rounded-full" style={{ background: theme.dot }} />
                    {data.status}
                </span>
            </div>

            <p className="mt-1 line-clamp-2 text-[11px] font-black leading-[1.2] text-[#222d32]">
                {data.name}
            </p>

            <div className="mt-1 flex items-center justify-between text-[8.5px] font-bold text-[#5a6472]">
                <span className="text-[#92604c]">{data.ch} CH</span>
                <span>Year {data.level}</span>
            </div>

            {data.missingPrereqs.length > 0 && (
                <p className="mt-0.5 truncate text-[8px] font-bold text-[#dc4835]/80" title={data.missingPrereqs.join(", ")}>
                    Missing {data.missingPrereqs.join(", ")}
                </p>
            )}

            <Handle
                type="source"
                position={isTB ? Position.Bottom : Position.Right}
                className="!h-2 !w-2 !border-0 !bg-[#94a3b8]"
            />
        </div>
    );
});

export default PrerequisiteExplorerNode;
