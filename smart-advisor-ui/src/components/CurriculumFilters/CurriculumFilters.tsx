/***
 * CurriculumFilters
 * 
 * Filter controls for the curriculum graph.
 * Includes search, level, category, credits, and framework filters.
 * 
 * Props:
 * - initialFilters: initial filter values
 * - onFilterChange: (filters: Filters) => void
 * - availableLevels: number[] - levels available in this major
 * - availableCategories: CourseCategory[] - categories available
 * - onSearch: (query: string) => void
 * - onLevelChange: (level: number | string | undefined) => void
 * - onCategoryChange: (category: string | undefined) => void
 * - onCreditsChange: (min: number, max: number) => void
 * - onFrameworkChange: (framework: string | undefined) => void
 */
import React, { useState } from "react";
import type { CourseBase, CourseCategory } from "../types";

interface FilterState {
  searchQuery: string;
  level: number | string | undefined;
  category: string | undefined;
  minCredits: number;
  maxCredits: number;
  framework: string | undefined;
}

interface CurriculumFiltersProps {
  initialFilters?: Partial<FilterState>;
  onFilterChange: (filters: FilterState) => void;
  availableLevels?: number[];
  availableCategories?: CourseCategory[];
}

export function CurriculumFilters({
  initialFilters = {
    searchQuery: "",
    level: undefined,
    category: undefined,
    minCredits: 0,
    maxCredits: 100,
    framework: undefined,
  },
  onFilterChange,
  availableLevels,
  availableCategories,
}: CurriculumFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, searchQuery: e.target.value }));
    onFilterChange({
      searchQuery: e.target.value,
      level: prev.level,
      category: prev.category,
      minCredits: prev.minCredits,
      maxCredits: prev.maxCredits,
      framework: prev.framework,
    });
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    setFilters((prev) => ({ ...prev, level: value }));
    onFilterChange({
      searchQuery: prev.searchQuery,
      level: value,
      category: prev.category,
      minCredits: prev.minCredits,
      maxCredits: prev.maxCredits,
      framework: prev.framework,
    });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    setFilters((prev) => ({ ...prev, category: value }));
    onFilterChange({
      searchQuery: prev.searchQuery,
      level: prev.level,
      category: value,
      minCredits: prev.minCredits,
      maxCredits: prev.maxCredits,
      framework: prev.framework,
    });
  };

  const handleMinCreditsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setFilters((prev) => ({ ...prev, minCredits: value }));
    onFilterChange({
      searchQuery: prev.searchQuery,
      level: prev.level,
      category: prev.category,
      minCredits: value,
      maxCredits: prev.maxCredits,
      framework: prev.framework,
    });
  };

  const handleMaxCreditsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 100;
    setFilters((prev) => ({ ...prev, maxCredits: value }));
    onFilterChange({
      searchQuery: prev.searchQuery,
      level: prev.level,
      category: prev.category,
      minCredits: prev.minCredits,
      maxCredits: value,
      framework: prev.framework,
    });
  };

  const handleFrameworkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    setFilters((prev) => ({ ...prev, framework: value }));
    onFilterChange({
      searchQuery: prev.searchQuery,
      level: prev.level,
      category: prev.category,
      minCredits: prev.minCredits,
      maxCredits: prev.maxCredits,
      framework: value,
    });
  };

  return (
    <div className="p-4 bg-gray-50 border-b border-gray-200 sticky top-0 z-10 background-white">
      <h3 className="font-medium text-sm mb-4">Filters</h3>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Search box */}
        <div>
          <label className="block text-xs font-medium mb-1">Search</label>
          <input
            type="text"
            value={filters.searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by course code or name..."
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Level filter */}
        <div>
          <label className="block text-xs font-medium mb-1">Level</label>
          <select
            value={filters.level !== undefined ? String(filters.level) : ""}
            onChange={handleLevelChange}
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Levels</option>
            {availableLevels?.map((level) => (
              <option key={level} value={level}>
                Year {level}
              </option>
            ))}
          </select>
        </div>

        {/* Category filter */}
        <div>
          <label className="block text-xs font-medium mb-1">Category</label>
          <select
            value={filters.category || ""}
            onChange={handleCategoryChange}
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Categories</option>
            {availableCategories?.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {/* Credits range */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Credits ({minCredits}-{maxCredits})
          </label>
          <input
            type="number"
            value={filters.minCredits}
            onChange={handleMinCreditsChange}
            min="0"
            max="50"
            step="1"
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Framework filter */}
        <div>
          <label className="block text-xs font-medium mb-1">Framework</label>
          <select
            value={filters.framework || ""}
            onChange={handleFrameworkChange}
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Frameworks</option>
            <option value="canvas">Canvas</option>
            <option value="blackboard">Blackboard</option>
            <option value="custom">Custom</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Apply / Clear buttons */}
      <div className="flex gap-2 pt-3">
        <button
          onClick={() => {
            setFilters({
              searchQuery: "",
              level: undefined,
              category: undefined,
              minCredits: 0,
              maxCredits: 100,
              framework: undefined,
            });
            onFilterChange({
              searchQuery: "",
              level: undefined,
              category: undefined,
              minCredits: 0,
              maxCredits: 100,
              framework: undefined,
            });
          }}
          className="flex-1 py-2 rounded border px-3 text-sm hover:bg-gray-100"
        >
          Clear All
        </button>
        <button
          onClick={() => {}}
          className="flex-1 py-2 rounded border px-3 text-sm bg-primary text-white hover:bg-primary/90"
        >
          Apply
        </button>
      </div>
    </div>
  );
}