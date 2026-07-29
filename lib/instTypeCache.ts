// Shared read/write/clear for the cached institution type — used by both
// MockInstTypeContext (reads it on mount, refreshes it from /admin/me) and
// authStore (writes it immediately at login, clears it at logout).
//
// Login/logout is where the last flash showed up: switching from a College
// account to a School account (or back) left the OLD account's cookie/
// localStorage value sitting around until the NEW session's /admin/me fetch
// finally overwrote it — so the first paint after login briefly showed the
// PREVIOUS account's color. Login already gets `institutionType` back on the
// user object (see store/authStore.ts's setAuth), so writing it into the
// cache right there — instead of waiting on a second network round-trip —
// closes that gap. Logout clears it outright so a fresh login never
// inherits a stale value even for that first render.

export type InstType = 'SCHOOL' | 'COLLEGE' | 'COACHING';

const CACHE_KEY = 'qubeex:instType';
const COOKIE_KEY = 'qubeex_inst_type';
const BY_INST_KEY = 'qubeex:instTypeByInstId';

// The backend currently does NOT return institution type on any
// teacher-accessible response (/auth/login, /teacher/me, /teacher/overview
// all checked — none of them include it, only /admin/me does, which a
// teacher token can't call). So a teacher login alone can never determine
// its own theme. As a workaround until the backend adds this field
// somewhere teacher-reachable, remember institution type per-institutionId
// whenever we DO learn it (e.g. from an admin login/session for that same
// institution) — a teacher login for an institution we've already seen an
// admin resolve can reuse that remembered value instead of falling back to
// School by default.
function readInstTypeMap(): Record<string, InstType> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(BY_INST_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
}

export function rememberInstTypeForInstitution(institutionId: string | null | undefined, t: InstType) {
    if (!institutionId || typeof window === 'undefined') return;
    try {
        const map = readInstTypeMap();
        map[institutionId] = t;
        window.localStorage.setItem(BY_INST_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
}

export function lookupInstTypeForInstitution(institutionId: string | null | undefined): InstType | null {
    if (!institutionId || typeof window === 'undefined') return null;
    const map = readInstTypeMap();
    const v = map[institutionId];
    return isInstType(v) ? v : null;
}

export function isInstType(v: unknown): v is InstType {
    // Case-insensitive on purpose — different backend endpoints/mobile
    // clients have been observed sending this as lowercase ('college')
    // instead of the uppercase enum this app standardizes on. Failing this
    // check silently falls back to the School theme, so it's safer to
    // normalize here than to trust every caller upstream got the casing right.
    const normalized = typeof v === 'string' ? v.toUpperCase() : v;
    return normalized === 'SCHOOL' || normalized === 'COLLEGE' || normalized === 'COACHING';
}

export function readCachedInstType(): InstType {
    if (typeof window === 'undefined') return 'SCHOOL';
    const cached = window.localStorage.getItem(CACHE_KEY);
    // Normalize to uppercase on the way out too — app/layout.tsx's cookie
    // check and the .theme-college CSS selector both expect the exact
    // uppercase enum values, so a lowercase value written before this
    // normalization landed (or by some other caller) must not leak through.
    return isInstType(cached) ? (cached.toUpperCase() as InstType) : 'SCHOOL';
}

export function writeCachedInstType(t: InstType) {
    try {
        const normalized = typeof t === 'string' ? (t.toUpperCase() as InstType) : t;
        window.localStorage.setItem(CACHE_KEY, normalized);
        document.cookie = `${COOKIE_KEY}=${normalized}; path=/; max-age=31536000; SameSite=Lax`;
    } catch { /* ignore */ }
}

export function clearCachedInstType() {
    try {
        window.localStorage.removeItem(CACHE_KEY);
        // Expire it immediately rather than just setting an empty value, so
        // the server-side cookie read in app/layout.tsx sees "no cookie" (→
        // 'SCHOOL' default) rather than a lingering empty-string cookie.
        document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
    } catch { /* ignore */ }
}
