/***
 * MajorSelector
 * 
 * Dropdown selector for choosing which major's curriculum to display.
 * Loads major data lazily or from a predefined data map.
 * 
 * Props:
 * - majors: Record<string, { key: string; name: string; courses: CourseBase[] }>
 * - onMajorChange: (majorKey: string) => void
 * - initialMajor?: string
 * - showSearch?: boolean
 */
import { useState, useCallback } from "react";
import type { CourseBase } from "../types";

interface MajorOption {
  key: string;
  name: string;
  courseCount: number;
}

interface MajorSelectorProps {
  majors: Record<string, { key: string; name: string; courses: CourseBase[] }>;
  onMajorChange: (majorKey: string) => void;
  initialMajor?: string;
}

export function MajorSelector({
  majors,
  onMajorChange,
  initialMajor = Object.keys(majors)[0] || "",
}: MajorSelectorProps) {
  const [selectedMajorKey, setSelectedMajorKey] = useState<string>(
    initialMajor || ""
  );

  const handleKeyChange = useCallback(
    (key: string) => {
      setSelectedMajorKey(key);
      onMajorChange(key);
    },
    [onMajorChange]
  );

  const majorOptions: MajorOption[] = Object.entries(majors).map(
    ([key, majorData]) => ({
      key,
      name: majorData.name,
      courseCount: majorData.courses?.length ?? 0,
    })
  );

  return null; // Will be rendered by parent with custom styling
  // TODO: Implement dropdown UI or use native <select>
}