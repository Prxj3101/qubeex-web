export const SUBJECT_PALETTE = [
    '#7C3AED', // violet
    '#DA7756', // terracotta
    '#0891B2', // cyan
    '#059669', // emerald
    '#D97706', // amber
    '#DC2626', // red
    '#2563EB', // blue
    '#8B5CF6', // purple
    '#EA580C', // orange
    '#16A34A', // green
];

export function assignSubjectColor(index: number): string {
    return SUBJECT_PALETTE[index % SUBJECT_PALETTE.length];
}