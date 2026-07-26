// Prepends a person's name-prefix/honorific (Mr./Mrs./Dr./Prof./etc.) wherever
// their name is shown, and resolves their display tag/title (Admin, Principal,
// Teacher, Professor, etc.) with a sensible per-role fallback.
export function formatDisplayName(name: string, prefix?: string | null): string {
    return prefix ? `${prefix} ${name}` : name;
}

export function resolveDisplayTitle(role: string, title?: string | null): string {
    if (title) return title;
    if (role === 'ADMIN') return 'Admin';
    if (role === 'TEACHER') return 'Teacher';
    if (role === 'SUB_ADMIN') return 'Subadmin';
    return role;
}
