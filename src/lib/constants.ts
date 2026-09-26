export const BRANCHES = [
  "CSE",
  "CSE(AI/ML)",
  "EEE",
  "3D&AG",
  "ME",
  "CE",
] as const;

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const RESOURCE_TYPES = [
  "Notes",
  "PYQ",
  "Assignment",
  "Lab Manual",
  "E-book",
  "Reference Material",
  "Syllabus",
] as const;

export const ADMISSION_YEARS = [2024, 2025, 2026] as const;

export const DEFAULT_SUBJECTS = [
  "Engineering Mathematics-I",
  "Engineering Physics",
  "Introduction to Al",
  "Computer Fundamentals & Emerging Technologies",
  "Universal Human Values",
  "Engineering Mathematics",
  "Essence of Indian Constitution",
  "Basics of Electrical & Electronics Engineering",
  "Engineering Chemistry",
  "TEngineering Mathematics-II",
  "Communicative English",
  "Python Programming",
  "Engineering Graphics and Design",
  "Introduction to Web Design",
  "Programming For Problem Solving",
  "Elements of Mechanical Engineering",
];

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MIME: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "text/plain": [".txt", ".md"],
  "text/csv": [".csv"],
  "application/zip": [".zip"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

export const SEM_LABEL = (n?: number | null) =>
  n ? `${["1st", "2nd", "3rd", "4th"][n - 1] ?? n} Sem` : "";

export function timeAgo(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w}w ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 100000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
}
