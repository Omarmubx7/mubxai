import type { PrerequisiteLogicRules } from "@/types";
import type { PrereqCourseRef, PrereqExpr, PrereqGateExpr } from "./types";

const TOKEN_PAREN_OPEN = "(";
const TOKEN_PAREN_CLOSE = ")";
const TOKEN_AND = "AND";
const TOKEN_OR = "OR";

interface ParseContext {
    gates: Map<string, PrereqGateExpr>;
    counter: number;
}

function normalizeCode(code: string, rules?: PrerequisiteLogicRules): string {
    const stripLength = rules?.stripping?.leading_zeros_if_length;
    const targetLength = rules?.stripping?.target_length;
    if (stripLength && code.length === stripLength && code.startsWith("00")) {
        if (targetLength && targetLength < code.length) {
            return code.slice(code.length - targetLength);
        }
        return code.slice(2);
    }
    return code;
}

function addGate(ctx: ParseContext, gate: PrereqGateExpr): string {
    const token = `__GATE_${ctx.counter}__`;
    ctx.counter += 1;
    ctx.gates.set(token, gate);
    return token;
}

/**
 * Pull non-course requirement text out of the raw prerequisite string so the
 * remaining expression is made only of course codes, AND/OR and parentheses.
 */
function preprocess(raw: string, ctx: ParseContext): string {
    let input = raw.trim();

    // Remove descriptive "including" clauses: (30 hrs including ...).
    input = input.replace(/\(\s*\d+\s*(?:HRS?|HOURS?|CH|CREDITS?)\s+INCLUDING[^)]*\)/gi, " ");

    // Concurrency alternatives must be detected before generic hour rules.
    input = input.replace(
        /(?:UP\s+TO\s*)?(\d+)\s*(?:HRS?|HOURS?)\s+CONCURRENT/gi,
        (_match, hours: string) => {
            const n = Number.parseInt(hours, 10);
            return addGate(ctx, {
                kind: "gate",
                gate: "concurrent",
                label: `Up to ${n} hrs concurrent`,
                requiredCH: n,
            });
        }
    );

    // Department approval and placement tests.
    input = input.replace(/\b(?:DEPT\.?|DEPARTMENT)\s+APPROVAL\b/gi, () =>
        addGate(ctx, { kind: "gate", gate: "approval", label: "Department Approval" })
    );
    input = input.replace(/\b(?:HTU\s+)?PLACEMENT(?:\s+TEST)?\b/gi, () =>
        addGate(ctx, { kind: "gate", gate: "placement", label: "HTU Placement Test" })
    );

    // Credit-hour thresholds: ">= 90 CH", ">100 Cr. Hrs.", "Passed 90 CHs", "100 hrs".
    input = input.replace(
        /(>=\s*(\d+))|(>\s*(\d+))|(PASSED\s+(\d+))|((\d+)\s*(?:CHS?|CR\.?\s*HRS?\.?|CREDITS?|HRS?|HOURS?))/gi,
        (_match, _gte, gteNum, _gt, gtNum, _passed, passedNum, _plain, plainNum) => {
            const n = Number.parseInt(gteNum || gtNum || passedNum || plainNum, 10);
            if (!Number.isFinite(n)) return " ";
            const label = gteNum
                ? `\u2265 ${n} CH`
                : gtNum
                    ? `> ${n} CH`
                    : passedNum
                        ? `Passed ${n} CH`
                        : `${n} CH`;
            return addGate(ctx, {
                kind: "gate",
                gate: "ch",
                label,
                requiredCH: n,
            });
        }
    );

    // Normalise boolean separators. Commas are implicit AND in the catalog.
    input = input
        .replaceAll("&", ` ${TOKEN_AND} `)
        .replaceAll(",", ` ${TOKEN_AND} `)
        .replace(/\bOR\b/gi, ` ${TOKEN_OR} `)
        .replace(/\bAND\b/gi, ` ${TOKEN_AND} `)
        .replaceAll("(", ` ${TOKEN_PAREN_OPEN} `)
        .replaceAll(")", ` ${TOKEN_PAREN_CLOSE} `)
        .replace(/\s+/g, " ")
        .trim();

    return input;
}

function tokenize(input: string): string[] {
    if (!input) return [];
    return input.split(" ").filter(Boolean);
}

class PrereqParser {
    private position = 0;

    constructor(
        private readonly tokens: string[],
        private readonly raw: string,
        private readonly ctx: ParseContext
    ) { }

    parse(): PrereqExpr | null {
        if (this.tokens.length === 0) return null;
        const expr = this.parseOr();
        return expr;
    }

    private peek(): string | undefined {
        return this.tokens[this.position];
    }

    private next(): string | undefined {
        const token = this.tokens[this.position];
        this.position += 1;
        return token;
    }

    private parseOr(): PrereqExpr {
        const children: PrereqExpr[] = [this.parseAnd()];
        while (this.peek() === TOKEN_OR) {
            this.next();
            children.push(this.parseAnd());
        }
        if (children.length === 1) return children[0];
        return { kind: "or", children, raw: this.raw };
    }

    private parseAnd(): PrereqExpr {
        const children: PrereqExpr[] = [this.parseAtom()];
        while (this.peek() === TOKEN_AND) {
            this.next();
            children.push(this.parseAtom());
        }
        if (children.length === 1) return children[0];
        return { kind: "and", children, raw: this.raw };
    }

    private parseAtom(): PrereqExpr {
        const token = this.next();

        if (token === TOKEN_PAREN_OPEN) {
            const inner = this.parseOr();
            if (this.peek() === TOKEN_PAREN_CLOSE) this.next();
            return inner;
        }

        if (token === TOKEN_PAREN_CLOSE || token === undefined) {
            return { kind: "gate", gate: "text", label: "" };
        }

        const gate = this.ctx.gates.get(token);
        if (gate) return gate;

        if (/^\d{6,10}$/.test(token)) {
            return { kind: "course", code: normalizeCode(token) };
        }

        // Anything unrecognised is a free-text requirement. Consume the rest of
        // the phrase until the next boolean operator or parenthesis.
        const words = [token];
        while (
            this.peek() &&
            this.peek() !== TOKEN_AND &&
            this.peek() !== TOKEN_OR &&
            this.peek() !== TOKEN_PAREN_OPEN &&
            this.peek() !== TOKEN_PAREN_CLOSE
        ) {
            words.push(this.next() as string);
        }

        return {
            kind: "gate",
            gate: "text",
            label: words.join(" ").trim(),
        };
    }
}

/**
 * Parse a raw catalog prerequisite string into an expression tree.
 * Supports AND/&/commas, OR, parentheses, credit-hour rules, department
 * approval, placement tests and concurrent-study alternatives.
 */
export function parsePrerequisite(
    raw: string | undefined | null,
    rules?: PrerequisiteLogicRules
): PrereqExpr | null {
    if (!raw || !raw.trim()) return null;

    const ctx: ParseContext = { gates: new Map(), counter: 0 };
    const input = preprocess(raw, ctx);
    const tokens = tokenize(input);
    if (tokens.length === 0) return null;

    const parser = new PrereqParser(tokens, raw.trim(), ctx);
    const expr = parser.parse();

    // Apply code normalisation rules to every course leaf.
    return expr ? mapCourses(expr, (code) => normalizeCode(code, rules)) : null;
}

function mapCourses(expr: PrereqExpr, fn: (code: string) => string): PrereqExpr {
    if (expr.kind === "course") {
        const code = fn(expr.code);
        if (code === expr.code) return expr;
        return { kind: "course", code };
    }
    if (expr.kind === "gate") return expr;
    return {
        ...expr,
        children: expr.children.map((child) => mapCourses(child, fn)),
    };
}

/** Collect every course code referenced by an expression. */
export function flattenPrereqCodes(expr: PrereqExpr | null | undefined): string[] {
    if (!expr) return [];
    if (expr.kind === "course") return [expr.code];
    if (expr.kind === "gate") return [];
    return expr.children.flatMap((child) => flattenPrereqCodes(child));
}

/** Collect course references together with their OR/AND context. */
export function collectPrereqRefs(
    expr: PrereqExpr | null | undefined,
    inOr = false
): PrereqCourseRef[] {
    if (!expr) return [];
    if (expr.kind === "course") return [{ code: expr.code, or: inOr }];
    if (expr.kind === "gate") return [];
    return expr.children.flatMap((child) =>
        collectPrereqRefs(child, inOr || expr.kind === "or")
    );
}

/** Collect non-course gates (CH thresholds, approval, placement, text). */
export function collectPrereqGates(
    expr: PrereqExpr | null | undefined
): PrereqGateExpr[] {
    if (!expr) return [];
    if (expr.kind === "gate") return expr.label ? [expr] : [];
    if (expr.kind === "course") return [];
    return expr.children.flatMap((child) => collectPrereqGates(child));
}

/** Human-readable rendering of an expression, useful for detail panels. */
export function describePrereq(expr: PrereqExpr | null | undefined): string {
    if (!expr) return "";
    if (expr.kind === "course") return expr.code;
    if (expr.kind === "gate") return expr.label;
    const joiner = expr.kind === "or" ? " OR " : " AND ";
    return expr.children.map((child) => describePrereq(child)).join(joiner);
}
