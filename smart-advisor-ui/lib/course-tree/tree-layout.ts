import type {
    CourseGraph,
    CourseTreeNode,
    MapBandLayout,
    MapEdgeLayout,
    MapLayout,
    MapNodeLayout,
    OutlineCategoryGroup,
    OutlineYearGroup,
    TreeFilters,
} from "./types";
import { CATEGORY_ORDER, type CourseCategory } from "./types";

const CATEGORY_RANK = new Map<CourseCategory, number>(
    CATEGORY_ORDER.map((category, index) => [category, index])
);

function primaryCategory(node: CourseTreeNode): CourseCategory {
    let best: CourseCategory = node.categories[0] ?? "Department Requirements";
    let bestRank = CATEGORY_RANK.get(best) ?? CATEGORY_ORDER.length;
    for (const category of node.categories) {
        const rank = CATEGORY_RANK.get(category) ?? CATEGORY_ORDER.length;
        if (rank < bestRank) {
            best = category;
            bestRank = rank;
        }
    }
    return best;
}

function normalizeLevel(level: number | undefined): number {
    if (typeof level !== "number" || Number.isNaN(level)) return 1;
    return Math.min(5, Math.max(1, Math.round(level)));
}

function matchesQuery(node: CourseTreeNode, query: string): boolean {
    if (!query) return true;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
        node.course.name.toLowerCase().includes(needle) ||
        node.code.toLowerCase().includes(needle)
    );
}

function makeCategoryGroups(
    nodes: CourseTreeNode[],
    completedCodes: Set<string>
): OutlineCategoryGroup[] {
    const byCategory = new Map<CourseCategory, CourseTreeNode[]>();
    for (const node of nodes) {
        const category = primaryCategory(node);
        const list = byCategory.get(category) ?? [];
        list.push(node);
        byCategory.set(category, list);
    }

    return CATEGORY_ORDER.flatMap((category) => {
        const list = byCategory.get(category);
        if (!list || list.length === 0) return [];

        list.sort((a, b) => a.order - b.order);

        const totalCH = list.reduce((sum, node) => sum + (node.course.ch ?? 0), 0);
        const completedCH = list.reduce(
            (sum, node) =>
                completedCodes.has(node.code) ? sum + (node.course.ch ?? 0) : sum,
            0
        );
        const completedCourses = list.filter((node) =>
            completedCodes.has(node.code)
        ).length;

        return [{
            key: `${category}`,
            label: category,
            courses: list.map((node) => ({ node })),
            totalCourses: list.length,
            completedCourses,
            totalCH,
            completedCH,
        }];
    });
}

/**
 * Build the collapsible hierarchy used by the Outline view:
 * Year -> Requirement category -> Course.
 */
export function buildOutlineModel(
    graph: CourseGraph,
    filters: TreeFilters,
    completedCodes: Set<string>
): OutlineYearGroup[] {
    const byLevel = new Map<number, CourseTreeNode[]>();

    for (const code of graph.order) {
        const node = graph.nodes.get(code);
        if (!node) continue;
        if (!matchesQuery(node, filters.query)) continue;
        if (!filters.showCompleted && completedCodes.has(code)) continue;

        const level = normalizeLevel(node.course.level);
        const list = byLevel.get(level) ?? [];
        list.push(node);
        byLevel.set(level, list);
    }

    const levels = [...byLevel.keys()].sort((a, b) => a - b);

    return levels.map((level) => {
        const nodes = byLevel.get(level) ?? [];
        nodes.sort((a, b) => {
            const catA = CATEGORY_RANK.get(primaryCategory(a)) ?? 99;
            const catB = CATEGORY_RANK.get(primaryCategory(b)) ?? 99;
            if (catA !== catB) return catA - catB;
            return a.order - b.order;
        });

        const totalCH = nodes.reduce((sum, node) => sum + (node.course.ch ?? 0), 0);
        const completedCH = nodes.reduce(
            (sum, node) =>
                completedCodes.has(node.code) ? sum + (node.course.ch ?? 0) : sum,
            0
        );
        const completedCourses = nodes.filter((node) =>
            completedCodes.has(node.code)
        ).length;

        return {
            key: `year-${level}`,
            level,
            label: `Year ${level}`,
            courses: nodes.map((node) => ({ node })),
            totalCourses: nodes.length,
            completedCourses,
            totalCH,
            completedCH,
            categories: makeCategoryGroups(nodes, completedCodes),
        };
    });
}
interface MapLayoutOptions {
	completedCodes: Set<string>;
	isMobile?: boolean;
	filters: TreeFilters;
}

/**
 * Horizontal layered DAG layout (left → right).
 *
 * Study years are vertical column bands placed side-by-side left to right.
 * Inside each column the courses stack top-to-bottom. Prerequisite edges flow
 * left → right as smooth cubic bezier curves from the right edge of the
 * prerequisite node to the left edge of the dependent node.
 */
export function layoutDependencyMap(
	graph: CourseGraph,
	options: MapLayoutOptions
): MapLayout {
	const isMobile = options.isMobile ?? false;

	const NODE_W  = isMobile ? 148 : 168;
	const NODE_H  = isMobile ?  72 :  84;
	const V_GAP   = isMobile ?  10 :  14;
	const COL_GAP = isMobile ?  48 :  72;
	const BAND_TOP    = isMobile ? 28 :  36;
	const BAND_BOTTOM = isMobile ? 10 :  14;
	const BAND_PAD_Y  = isMobile ?  8 :  12;
	const PAD         = isMobile ? 14 :  22;

	const visible = new Set<string>();
	for (const code of graph.order) {
		const node = graph.nodes.get(code);
		if (!node) continue;
		if (!matchesQuery(node, options.filters.query)) continue;
		if (!options.filters.showCompleted && options.completedCodes.has(code)) continue;
		visible.add(code);
	}

	const byLevel = new Map<number, CourseTreeNode[]>();
	for (const code of graph.order) {
		if (!visible.has(code)) continue;
		const node = graph.nodes.get(code);
		if (!node) continue;
		const level = normalizeLevel(node.course.level);
		const list = byLevel.get(level) ?? [];
		list.push(node);
		byLevel.set(level, list);
	}

	const levels = [...byLevel.keys()].sort((a, b) => a - b);
	if (levels.length === 0) {
		return {
			nodes: [], edges: [], bands: [], levels: [],
			width: PAD * 2, height: PAD * 2,
			nodeWidth: NODE_W, nodeHeight: NODE_H,
		};
	}

	const rootDistance = (code: string, memo = new Map<string, number>()): number => {
		if (memo.has(code)) return memo.get(code)!;
		const node = graph.nodes.get(code);
		if (!node) { memo.set(code, 0); return 0; }
		const parents = node.prereqCodes.filter((p) => visible.has(p));
		if (parents.length === 0) { memo.set(code, 0); return 0; }
		const value = 1 + Math.max(...parents.map((p) => rootDistance(p, memo)));
		memo.set(code, value);
		return value;
	};

	const rootFamily = (code: string, memo = new Map<string, string>()): string => {
		if (memo.has(code)) return memo.get(code)!;
		const node = graph.nodes.get(code);
		if (!node) { memo.set(code, code); return code; }
		const visParents = node.prereqCodes.filter((p) => visible.has(p));
		if (visParents.length === 0) { memo.set(code, code); return code; }
		const parentRoot = visParents
			.map((p) => rootFamily(p, memo))
			.sort((a, b) => a.localeCompare(b))[0];
		memo.set(code, parentRoot);
		return parentRoot;
	};

	const familyRank = new Map<string, number>();
	const familyOrder = [...new Set([...visible].map((c) => rootFamily(c)))].sort((a, b) => {
		const aD = Math.max(0, ...[...visible].filter((c) => rootFamily(c) === a).map((c) => rootDistance(c)));
		const bD = Math.max(0, ...[...visible].filter((c) => rootFamily(c) === b).map((c) => rootDistance(c)));
		if (aD !== bD) return aD - bD;
		return a.localeCompare(b);
	});
	familyOrder.forEach((family, idx) => familyRank.set(family, idx));

	const indexByCode = new Map<string, number>();
	for (const level of levels) {
		const list = byLevel.get(level) ?? [];
		list.sort((a, b) => {
			const famA = rootFamily(a.code);
			const famB = rootFamily(b.code);
			if (famA !== famB) return (familyRank.get(famA) ?? 0) - (familyRank.get(famB) ?? 0);
			const dA = rootDistance(a.code);
			const dB = rootDistance(b.code);
			if (dA !== dB) return dA - dB;
			const catA = CATEGORY_RANK.get(primaryCategory(a)) ?? 99;
			const catB = CATEGORY_RANK.get(primaryCategory(b)) ?? 99;
			if (catA !== catB) return catA - catB;
			return a.order - b.order;
		});
		list.forEach((node, idx) => indexByCode.set(node.code, idx));
		byLevel.set(level, list);
	}

	const maxCount = Math.max(...levels.map((l) => byLevel.get(l)?.length ?? 0), 1);
	const totalHeight =
		PAD + BAND_TOP + maxCount * NODE_H + (maxCount - 1) * V_GAP + BAND_BOTTOM + PAD;

	const nodes: MapNodeLayout[] = [];
	const bands: MapBandLayout[] = [];
	const positionByCode = new Map<string, MapNodeLayout>();
	const bandByLevel = new Map<number, MapBandLayout>();

	let cursorX = PAD;

	for (const level of levels) {
		const list = byLevel.get(level) ?? [];
		const bandHeight = totalHeight - PAD * 2;
		const bandWidth = NODE_W + BAND_PAD_Y * 2;

		const band: MapBandLayout = {
			level,
			x: cursorX,
			y: PAD,
			width: bandWidth,
			height: bandHeight,
			rows: list.length,
		};
		bands.push(band);
		bandByLevel.set(level, band);

		const totalNodesH = list.length * NODE_H + (list.length - 1) * V_GAP;
		const nodeStartY = PAD + BAND_TOP + Math.max(0, (bandHeight - BAND_TOP - BAND_BOTTOM - totalNodesH) / 2);

		list.forEach((node, idx) => {
			const entry: MapNodeLayout = {
				code: node.code,
				level,
				x: cursorX + BAND_PAD_Y,
				y: nodeStartY + idx * (NODE_H + V_GAP),
				width: NODE_W,
				height: NODE_H,
			};
			nodes.push(entry);
			positionByCode.set(node.code, entry);
		});

		cursorX += bandWidth + COL_GAP;
	}

	const totalWidth = cursorX - COL_GAP + PAD;

	const edges: MapEdgeLayout[] = [];
	graph.edges.forEach((edge, edgeIdx) => {
		const from = positionByCode.get(edge.from);
		const to   = positionByCode.get(edge.to);
		if (!from || !to) return;

		const startX = from.x + from.width;
		const startY = from.y + from.height / 2;
		const endX   = to.x;
		const endY   = to.y + to.height / 2;

		const fromDepth = graph.depths.get(edge.from) ?? 0;
		const toDepth   = graph.depths.get(edge.to)   ?? 0;

		let path: string;

		if (endX > startX + 4) {
			const ctrl = (endX - startX) * 0.45;
			path = `M ${startX} ${startY} C ${startX + ctrl} ${startY}, ${endX - ctrl} ${endY}, ${endX} ${endY}`;
		} else {
			const laneBase = familyRank.get(rootFamily(edge.from)) ?? 0;
			const lift = PAD - 10 - laneBase * 10 - ((fromDepth + toDepth + edgeIdx) % 3) * 6;
			const midX = (startX + endX) / 2;
			path = `M ${startX} ${startY} C ${startX + 32} ${startY}, ${midX} ${lift}, ${midX} ${lift} S ${endX - 32} ${endY}, ${endX} ${endY}`;
		}

		edges.push({ from: edge.from, to: edge.to, path, or: edge.or });
	});

	return {
		nodes,
		edges,
		bands,
		levels,
		width: totalWidth,
		height: totalHeight,
		nodeWidth: NODE_W,
		nodeHeight: NODE_H,
	};
}
