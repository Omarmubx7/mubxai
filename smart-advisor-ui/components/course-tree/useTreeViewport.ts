"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TreeViewport {
    x: number;
    y: number;
    scale: number;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 1.8;

interface ViewportOptions {
    /** Smallest scale the initial fit will pick. */
    minFitScale?: number;
    /** Space kept clear around the fitted content. */
    fitPadding?: number;
}

/**
 * Pan/zoom state for the dependency map. Plain wheel scrolling is left to the
 * page; Ctrl/Cmd + wheel zooms, matching the gesture used by trackpads.
 */
export function useTreeViewport(
    contentWidth: number,
    contentHeight: number,
    options: ViewportOptions = {}
) {
    const minFitScale = options.minFitScale ?? 0.56;
    const fitPadding = options.fitPadding ?? 28;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [view, setView] = useState<TreeViewport>({ x: 0, y: 0, scale: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const lastDragEndRef = useRef(0);

    const fit = useCallback(() => {
        const element = containerRef.current;
        if (!element || contentWidth <= 0 || contentHeight <= 0) return;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const padding = fitPadding;
        // Prefer filling the available width so labels stay legible. Height
        // rarely fits a full degree map, and shrinking to fit it would make
        // every course name unreadable; users pan vertically instead.
        const fitWidth = (rect.width - padding * 2) / contentWidth;
        const scale = Math.min(1, Math.max(minFitScale, fitWidth));
        const scaledWidth = contentWidth * scale;
        const scaledHeight = contentHeight * scale;

        setView({
            scale,
            x: Math.max(padding, (rect.width - scaledWidth) / 2),
            y: scaledHeight <= rect.height - padding * 2
                ? (rect.height - scaledHeight) / 2
                : padding,
        });
    }, [contentWidth, contentHeight, minFitScale, fitPadding]);

    useEffect(() => {
        const frame = requestAnimationFrame(fit);
        return () => cancelAnimationFrame(frame);
    }, [fit]);

    const zoomAt = useCallback((factor: number, centerX?: number, centerY?: number) => {
        const element = containerRef.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const x = centerX ?? rect.width / 2;
        const y = centerY ?? rect.height / 2;

        setView((previous) => {
            const scale = Math.min(
                MAX_SCALE,
                Math.max(MIN_SCALE, previous.scale * factor)
            );
            const ratio = scale / previous.scale;
            return {
                scale,
                x: x - (x - previous.x) * ratio,
                y: y - (y - previous.y) * ratio,
            };
        });
    }, []);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const handleWheel = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            const rect = element.getBoundingClientRect();
            const factor = Math.exp(-event.deltaY * 0.002);
            zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
        };

        element.addEventListener("wheel", handleWheel, { passive: false });
        return () => element.removeEventListener("wheel", handleWheel);
    }, [zoomAt]);

    const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        // Controls and the focus panel opt out of dragging.
        if ((event.target as HTMLElement).closest("[data-map-no-pan]")) return;

        const startX = event.clientX;
        const startY = event.clientY;
        const originX = view.x;
        const originY = view.y;
        let moved = false;

        setIsPanning(true);

        // Listen on window instead of capturing the pointer: pointer capture
        // retargets the click to the container, which would break tapping a
        // course card to toggle it. A real drag then suppresses the click.
        const handleMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== event.pointerId) return;
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            if (!moved && Math.hypot(dx, dy) > 4) moved = true;
            if (!moved) return;
            setView((previous) => ({ ...previous, x: originX + dx, y: originY + dy }));
        };

        const handleEnd = (endEvent: PointerEvent) => {
            if (endEvent.pointerId !== event.pointerId) return;
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleEnd);
            window.removeEventListener("pointercancel", handleEnd);
            setIsPanning(false);
            if (moved) lastDragEndRef.current = Date.now();
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleEnd);
        window.addEventListener("pointercancel", handleEnd);
    }, [view.x, view.y]);

    /** Swallow the click that ends a drag so panning never toggles a course. */
    const onClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (Date.now() - lastDragEndRef.current < 250) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, []);

    return {
        containerRef,
        view,
        fit,
        zoomIn: () => zoomAt(1.2),
        zoomOut: () => zoomAt(1 / 1.2),
        onPointerDown,
        onClickCapture,
        isPanning,
    };
}
