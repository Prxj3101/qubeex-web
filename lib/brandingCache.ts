// Shared read/write/clear for cached institution branding — mirrors
// instTypeCache.ts's exact approach to the same problem: the server has no
// way to know a visitor's institution branding on the very first byte of a
// hard refresh (branding lives behind a JWT-authenticated endpoint), so
// without a cache the QubeEx logo/name would flash before the real branding
// arrives. Caching the last-known value in both localStorage (fast client
// re-paint) and a cookie (readable by the root Server Component for the
// <title>) closes that gap for every visit after the first.

export type CachedBranding = {
    enabled: boolean;
    brandName: string;
    logoUrl: string;
    faviconUrl: string;
};

const CACHE_KEY = 'qubeex:branding';
const COOKIE_KEY = 'qubeex_branding';

export const QUBEEX_DEFAULT_BRANDING: CachedBranding = {
    enabled: false,
    brandName: 'QubeEx',
    logoUrl: '/QubeEx_darkmode_DA7756.png',
    // The old /favicon.ico rendered with a solid black background in the
    // browser tab — this PNG (already used as the logo everywhere else) is
    // transparent and matches the actual brand mark.
    faviconUrl: '/QubeEx_darkmode_DA7756.png',
};

export function isCachedBranding(v: unknown): v is CachedBranding {
    if (!v || typeof v !== 'object') return false;
    const b = v as Record<string, unknown>;
    return typeof b.enabled === 'boolean' && typeof b.brandName === 'string'
        && typeof b.logoUrl === 'string' && typeof b.faviconUrl === 'string';
}

export function readCachedBranding(): CachedBranding {
    if (typeof window === 'undefined') return QUBEEX_DEFAULT_BRANDING;
    try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return isCachedBranding(parsed) ? parsed : QUBEEX_DEFAULT_BRANDING;
    } catch {
        return QUBEEX_DEFAULT_BRANDING;
    }
}

export function writeCachedBranding(b: CachedBranding) {
    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(b));
        // Cookie carries what the server-rendered <title>/favicon <link> use.
        // Client-side DOM tricks for swapping the favicon after the page has
        // already loaded turned out to be unreliable across browsers — Chrome
        // in particular mostly only picks up a favicon it finds during the
        // actual (server-rendered or App Router client-navigation) metadata
        // resolution, not one spliced into <head> after the fact. So the
        // cookie now carries the favicon URL too, and the root layout's
        // generateMetadata renders it server-side — same pattern as the
        // title, which already worked reliably this way.
        const payload = b.enabled ? JSON.stringify({ n: b.brandName, f: b.faviconUrl }) : '';
        document.cookie = `${COOKIE_KEY}=${encodeURIComponent(payload)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch { /* ignore */ }
}

export function clearCachedBranding() {
    try {
        window.localStorage.removeItem(CACHE_KEY);
        document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
    } catch { /* ignore */ }
}
