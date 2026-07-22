// Canonical subject color sequence — every subject tile/badge/chip across the
// platform (admin, teacher, student, mobile) should draw from this exact
// sequence so the same subject renders the same color everywhere.
export const SUBJECT_PALETTE = [
    '#DA7756', // terracotta
    '#EC4899', // pink
    '#0891B2', // cyan
    '#7C3AED', // violet
    '#059669', // green
    '#2563EB', // blue
    '#4F46E5', // indigo
    '#D97706', // amber
    '#166534', // dark green
    '#E11D48', // rose
    '#0284C7', // sky
    '#C026D3', // fuchsia
    '#EA580C', // orange
    '#0D9488', // teal
];

export function assignSubjectColor(index: number): string {
    return SUBJECT_PALETTE[index % SUBJECT_PALETTE.length];
}

// Deterministic hash of a subject's own id — used only as a last-resort
// fallback when the backend hasn't assigned a color (it always does now).
// Unlike indexing by array position, this never changes when a sibling
// subject is deleted, since it depends only on the subject's own id.
function hashToIndex(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
    return h;
}

export function colorForSubject(sub: { id: string; color?: string | null }): string {
    return sub.color ?? assignSubjectColor(hashToIndex(sub.id));
}