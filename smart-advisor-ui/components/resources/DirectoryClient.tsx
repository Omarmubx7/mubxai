"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Upload, BookOpen, Loader2, ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/Toast";
import ResourceFilters from "./ResourceFilters";
import ResourceCard from "./ResourceCard";
import type { ResourceItem } from "./ResourceCard";
import EmptyState from "./EmptyState";
import UploadDialog from "./UploadDialog";
import ReportDialog from "./ReportDialog";
import UploadRulesBanner from "./UploadRulesBanner";
import { useSitePolicy } from "@/lib/use-site-policy";
import SearchSuggestions from "./SearchSuggestions";
import type { SuggestionItem } from "./SearchSuggestions";
import type { MajorGroup } from "@/app/resources/page";

interface DirectoryClientProps {
    majorGroups: MajorGroup[];
    courseToMajorLabels: Record<string, string[]>;
    initialResources?: ResourceItem[];
    prefilledCourseCode?: string | null;
}

const RECENT_KEY = "mubx-resource-recent-searches";

function normalizeSearchValue(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export default function DirectoryClient({
    majorGroups,
    courseToMajorLabels,
    initialResources,
    prefilledCourseCode,
}: Readonly<DirectoryClientProps>) {
    const { status } = useSession();
    const { toast } = useToast();
    const policy = useSitePolicy();
    const uploadsAllowed = policy.resources.enabled && policy.resources.uploadsEnabled;
    const [selectedMajor, setSelectedMajor] = useState<string>("all");
    const [selectedCourse, setSelectedCourse] = useState<string | null>(prefilledCourseCode || null);
    const [typeFilter, setTypeFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [resources, setResources] = useState<ResourceItem[]>(initialResources || []);
    const [loading, setLoading] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [reportTarget, setReportTarget] = useState<ResourceItem | null>(null);
    const [focused, setFocused] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const searchWrapRef = useRef<HTMLDivElement>(null);

    const activeMajor = useMemo(
        () => majorGroups.find((g) => g.id === selectedMajor) || majorGroups[0],
        [majorGroups, selectedMajor]
    );

    const courses = activeMajor.courses;

    const allCourses = useMemo(() => {
        const seen = new Map<string, { code: string; name: string }>();
        majorGroups.forEach((g) =>
            g.courses.forEach((c) => {
                if (!seen.has(c.code)) seen.set(c.code, { code: c.code, name: c.name });
            })
        );
        return Array.from(seen.values());
    }, [majorGroups]);

    const courseNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        majorGroups.forEach((g) => g.courses.forEach((c) => { map[c.code] = c.name; }));
        return map;
    }, [majorGroups]);

    // Reset course selection when major changes
    useEffect(() => {
        setSelectedCourse(null);
    }, [selectedMajor]);

    // Restore recent searches
    useEffect(() => {
        try {
            const raw = localStorage.getItem(RECENT_KEY);
            if (raw) setRecentSearches(JSON.parse(raw));
        } catch {
            // ignore
        }
    }, []);

    // Debounce the search input so filtering feels instant without thrashing.
    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery), 200);
        return () => clearTimeout(id);
    }, [searchQuery]);

    // Close the suggestions dropdown when clicking outside.
    useEffect(() => {
        function onDocMouseDown(e: MouseEvent) {
            if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
                setFocused(false);
            }
        }
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    const fetchResources = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedCourse) {
                params.set("course_code", selectedCourse);
            } else if (selectedMajor && selectedMajor !== "all") {
                params.set("major", selectedMajor);
            }

            const res = await fetch(`/api/directory/resources?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setResources(data.resources || []);
            }
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, [selectedCourse, selectedMajor]);

    useEffect(() => {
        fetchResources();
    }, [fetchResources]);

    // Build enriched resources with course names and major labels.
    const enrichedResources = useMemo(() => {
        return resources.map((r) => ({
            ...r,
            courseName: courseNameMap[r.course_code] || "",
            majorLabels: courseToMajorLabels[r.course_code] || [],
        }));
    }, [resources, courseNameMap, courseToMajorLabels]);

    const findMatchingCourseCodes = useCallback(
        (query: string) => {
            const normalizedQuery = normalizeSearchValue(query);
            if (!normalizedQuery) return [];

            return allCourses
                .filter((c) => {
                    const normalizedName = normalizeSearchValue(c.name);
                    const normalizedCode = normalizeSearchValue(c.code);

                    return (
                        normalizedName.includes(normalizedQuery) ||
                        normalizedCode.includes(normalizedQuery) ||
                        normalizedQuery.includes(normalizedName)
                    );
                })
                .map((c) => c.code);
        },
        [allCourses]
    );

    /**
     * Strict text search where every typed token must appear in at least one stable field.
     * This avoids broad fuzzy matches that pull in unrelated courses.
     */
    const strictTextSearch = useCallback(
        (query: string) => {
            const tokens = normalizeSearchValue(query).split(/\s+/).filter(Boolean);
            if (tokens.length === 0) return enrichedResources;

            return enrichedResources.filter((resource) => {
                const haystack = normalizeSearchValue(
                    [resource.title, resource.courseName, resource.course_code, resource.description]
                        .filter(Boolean)
                        .join(" ")
                );
                return tokens.every((token) => haystack.includes(token));
            });
        },
        [enrichedResources]
    );

    const filteredResources = useMemo(() => {
        let results = enrichedResources;

        if (selectedCourse) {
            results = results.filter((r) => r.course_code === selectedCourse);
        }

        const query = debouncedQuery.trim();
        if (query) {
            const matchedCourseCodes = findMatchingCourseCodes(query);

            // If the query points to one or more course tags, only show resources from those courses.
            if (matchedCourseCodes.length > 0) {
                results = results.filter((r) => matchedCourseCodes.includes(r.course_code));
            } else {
                results = strictTextSearch(query);
            }
        }

        if (typeFilter !== "all") {
            results = results.filter((r) => r.type === typeFilter);
        }
        return results;
    }, [enrichedResources, selectedCourse, debouncedQuery, findMatchingCourseCodes, strictTextSearch, typeFilter]);

    // Live suggestions: matching courses, matching resources, and recent searches.
    const suggestions = useMemo<SuggestionItem[]>(() => {
        const q = searchQuery.trim();
        const items: SuggestionItem[] = [];

        if (!q) {
            recentSearches.slice(0, 5).forEach((r) =>
                items.push({ key: `recent-${r}`, kind: "recent", label: r, query: r })
            );
            return items;
        }

        const normalizedQuery = normalizeSearchValue(q);
        const courseMatches = allCourses
            .filter((c) => {
                const normalizedName = normalizeSearchValue(c.name);
                const normalizedCode = normalizeSearchValue(c.code);
                return normalizedName.includes(normalizedQuery) || normalizedCode.includes(normalizedQuery);
            })
            .slice(0, 4)
            .map((c) => ({
                key: `course-${c.code}`,
                kind: "course" as const,
                label: c.name,
                sublabel: c.code,
                query: c.name,
                courseCode: c.code,
            }));

        courseMatches.forEach((c) =>
                items.push({
                    key: c.key,
                    kind: c.kind,
                    label: c.label,
                    sublabel: c.sublabel,
                    query: c.query,
                    courseCode: c.courseCode,
                })
        );

        // When the query already maps to course tags, keep suggestions focused on courses only.
        if (courseMatches.length === 0) {
            strictTextSearch(q)
                .slice(0, 5)
                .forEach((r) =>
                    items.push({
                        key: `resource-${r.id}`,
                        kind: "resource",
                        label: r.title,
                        sublabel: courseNameMap[r.course_code] || r.course_code,
                        query: r.title,
                    })
                );
        }

        return items;
    }, [searchQuery, recentSearches, allCourses, strictTextSearch, courseNameMap]);

    useEffect(() => {
        setActiveIndex(-1);
    }, [searchQuery]);

    const showSuggestions = focused && suggestions.length > 0;

    const typeCounts: Record<string, number> = {};
    enrichedResources.forEach((r) => {
        typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    });

    const selectedCourseData = courses.find((c) => c.code === selectedCourse);

    function commitRecent(value: string) {
        const v = value.trim();
        if (!v) return;
        setRecentSearches((prev) => {
            const next = [v, ...prev.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 6);
            try {
                localStorage.setItem(RECENT_KEY, JSON.stringify(next));
            } catch {
                // ignore
            }
            return next;
        });
    }

    function handleSuggestionSelect(item: SuggestionItem) {
        commitRecent(item.query);
        if (item.courseCode) {
            setSelectedCourse(item.courseCode);
        }
        setSearchQuery(item.query);
        setFocused(false);
        setActiveIndex(-1);
    }

    function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Escape") {
            setFocused(false);
            return;
        }

        if (!showSuggestions) {
            if (e.key === "Enter") commitRecent(searchQuery);
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIndex >= 0 && suggestions[activeIndex]) {
                handleSuggestionSelect(suggestions[activeIndex]);
            } else {
                commitRecent(searchQuery);
                setFocused(false);
            }
        }
    }

    function requireAuthThenUpload() {
        if (!uploadsAllowed) {
            toast("Uploads are paused right now. Please try again later.", "info");
            return;
        }
        if (status === "authenticated") {
            setUploadOpen(true);
        } else if (typeof window !== "undefined") {
            window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
    }

    async function handleShare(resource: ResourceItem) {
        const origin = typeof window !== "undefined" ? window.location.origin : "https://ai.mubx.dev";
        const shareUrl = `${origin}/resources/${resource.id}`;
        const shareMessage = `Found this on MubxAI — too useful to gatekeep.\n\n"${resource.title}" (${resource.course_code})\n${shareUrl}\n\nKnow something helpful? Upload it on MubxAI and help your classmates!`;

        try {
            if (typeof navigator !== "undefined" && navigator.share) {
                await navigator.share({
                    title: `MubxAI | ${resource.title}`,
                    text: shareMessage,
                });
            } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText(shareMessage);
                toast("Link copied to clipboard", "success");
            } else {
                toast(shareMessage, "info");
            }
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                return;
            }
            toast("Failed to share", "error");
        }
    }

    return (
        <div className="min-h-dvh bg-[#edf1f6]">
            {/* Maintenance notice is rendered site-wide by <MaintenanceBanner /> in the root layout. */}
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#dde3ec]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between gap-3 mb-1.5 sm:mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <Link
                                href="/dashboard"
                                className="flex items-center justify-center shrink-0 w-10 h-10 rounded-xl bg-[#edf1f6] hover:bg-[#dde3ec] text-[#5a6472] hover:text-[#222d32] transition-all duration-200"
                                aria-label="Back to dashboard"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="shrink-0 w-10 h-10 rounded-xl bg-[#dc4835]/10 flex items-center justify-center"
                            >
                                <BookOpen className="w-5 h-5 text-[#dc4835]" />
                            </motion.div>
                            <div className="min-w-0">
                                <motion.h1
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: 0.1 }}
                                    className="text-lg font-black text-[#222d32] tracking-tight truncate"
                                >
                                    Resources
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3, delay: 0.2 }}
                                    className="text-xs text-[#5a6472] font-semibold truncate"
                                >
                                    Course materials shared by students
                                </motion.p>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3, delay: 0.3 }}
                                    className="hidden sm:block text-[11px] text-[#dc4835] font-semibold mt-0.5 truncate"
                                >
                                    Don't gatekeep. Share what helps your classmates.
                                </motion.p>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3, delay: 0.35 }}
                                    className="sm:hidden text-[9px] text-[#dc4835] font-semibold mt-0.5 truncate"
                                >
                                    Share • Upload • Help your classmates
                                </motion.p>
                            </div>
                        </div>

                        <motion.button
                            whileHover={uploadsAllowed ? { scale: 1.03 } : undefined}
                            whileTap={uploadsAllowed ? { scale: 0.97 } : undefined}
                            onClick={requireAuthThenUpload}
                            disabled={!uploadsAllowed}
                            className={`flex items-center gap-1.5 sm:gap-2 shrink-0 px-2.5 sm:px-4 py-2 rounded-lg sm:py-2.5 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm whitespace-nowrap ${
                                uploadsAllowed
                                    ? "bg-[#dc4835] text-white hover:bg-[#c43a2a] focus:ring-[#dc4835]/30 focus:ring-offset-2"
                                    : "bg-[#dde3ec] text-[#5a6472] cursor-not-allowed"
                            }`}
                            aria-label={uploadsAllowed ? "Upload a resource" : "Uploads are paused"}
                        >
                            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">{!uploadsAllowed ? "Uploads paused" : status === "authenticated" ? "Upload" : "Sign in to Upload"}</span>
                            <span className="sm:hidden">{uploadsAllowed ? "Upload" : "Paused"}</span>
                        </motion.button>
                    </div>

                    {/* Search */}
                    <div className="relative mb-1 sm:mb-3" ref={searchWrapRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6472]" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setFocused(true)}
                            onKeyDown={handleSearchKeyDown}
                            role="combobox"
                            aria-expanded={showSuggestions}
                            aria-controls="resource-search-suggestions"
                            aria-autocomplete="list"
                            className="w-full pl-9 pr-14 py-2.5 rounded-lg bg-[#edf1f6] border border-[#dde3ec] text-sm text-[#222d32] placeholder:text-[#5a6472]/50 focus:outline-none focus:border-[#dc4835] focus:ring-2 focus:ring-[#dc4835]/10 transition-all duration-200"
                            placeholder="Search by course name or code..."
                            aria-label="Search resources"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5a6472] hover:text-[#dc4835] transition-colors"
                                aria-label="Clear search"
                            >
                                Clear
                            </button>
                        )}
                        <div id="resource-search-suggestions">
                            {showSuggestions && (
                                <SearchSuggestions
                                    items={suggestions}
                                    activeIndex={activeIndex}
                                    query={searchQuery}
                                    onHover={setActiveIndex}
                                    onSelect={handleSuggestionSelect}
                                />
                            )}
                        </div>
                    </div>

                    {/* Major dropdown */}
                    <div className="relative mb-1 sm:mb-3">
                        <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6472] pointer-events-none" />
                        <select
                            value={selectedMajor}
                            onChange={(e) => setSelectedMajor(e.target.value)}
                            className="w-full appearance-none pl-9 pr-9 py-2.5 rounded-lg bg-white border border-[#dde3ec] text-sm font-semibold text-[#222d32] focus:outline-none focus:border-[#dc4835] focus:ring-2 focus:ring-[#dc4835]/10 transition-all duration-200 cursor-pointer"
                            aria-label="Filter by major"
                        >
                            {majorGroups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6472] pointer-events-none" />
                    </div>

                    {/* Type filters */}
                    <AnimatePresence>
                        {enrichedResources.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ResourceFilters active={typeFilter} onChange={setTypeFilter} counts={typeCounts} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Content — extra bottom padding on mobile so the last card clears the bottom app tray. */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-3 pb-28 sm:py-6">
                <UploadRulesBanner onUpload={requireAuthThenUpload} />

                {debouncedQuery.trim() && !loading && (
                    <p className="text-[11px] font-semibold text-[#5a6472] mb-3" aria-live="polite">
                        {filteredResources.length} result{filteredResources.length === 1 ? "" : "s"} for &ldquo;{debouncedQuery.trim()}&rdquo;
                    </p>
                )}

                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-16 gap-3"
                        >
                            <Loader2 className="w-6 h-6 text-[#dc4835] animate-spin" />
                            <p className="text-xs text-[#5a6472] font-medium">Loading resources...</p>
                        </motion.div>
                    ) : filteredResources.length > 0 ? (
                        <motion.div
                            key="results"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid gap-4 sm:grid-cols-2"
                        >
                            {filteredResources.map((r) => (
                                <ResourceCard
                                    key={r.id}
                                    resource={r}
                                    onReport={setReportTarget}
                                    onShare={handleShare}
                                    courseNameMap={courseNameMap}
                                    majorLabels={r.majorLabels}
                                    highlightQuery={debouncedQuery}
                                />
                            ))}
                        </motion.div>
                    ) : selectedCourse ? (
                        <motion.div
                            key="no-resources"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <EmptyState
                                type="no-resources"
                                courseName={selectedCourseData?.name || selectedCourse}
                                onUpload={requireAuthThenUpload}
                            />
                        </motion.div>
                    ) : searchQuery ? (
                        <motion.div
                            key="no-results"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <EmptyState type="no-results" query={debouncedQuery} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="no-search"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <EmptyState type="no-search" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Dialogs */}
            <UploadDialog
                open={uploadOpen}
                onClose={() => setUploadOpen(false)}
                courses={courses}
                prefilledCourseCode={selectedCourse}
                onResourceCreated={fetchResources}
                courseToMajorLabels={courseToMajorLabels}
            />
            <ReportDialog resource={reportTarget} onClose={() => setReportTarget(null)} />
        </div>
    );
}
