'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';
import {
    type CachedBranding,
    isCachedBranding,
    readCachedBranding,
    writeCachedBranding,
    QUBEEX_DEFAULT_BRANDING,
} from '@/lib/brandingCache';

// Public marketing/auth routes never have a logged-in institution to derive
// branding from — a stale localStorage cache from a previous session (e.g.
// testing a white-labeled institution) must never leak onto these pages.
function isPublicRoute(pathname: string): boolean {
    return pathname === '/' || pathname.startsWith('/login');
}

const BrandingContext = createContext<CachedBranding>(QUBEEX_DEFAULT_BRANDING);

/**
 * Centralized institution branding — wraps the whole app once at the root
 * layout so any component can call useBranding() instead of every screen
 * re-implementing "is this institution white-labeled" logic itself. Backend
 * (/api/branding) is the source of truth: it already re-checks Pro-plan
 * eligibility on every call, so this provider never needs its own eligibility
 * logic — it just renders whatever the backend says.
 */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublic = isPublicRoute(pathname ?? '/');

    // Must start from the same default the server rendered — reading
    // localStorage in a lazy useState initializer runs during the client's
    // hydration render too, and the server has no localStorage to match it
    // against, which is exactly what caused the hydration mismatch on the
    // logo/name. So: render the default first, then apply the cached value
    // in an effect (after hydration, a plain client-side update is fine).
    const [branding, setBranding] = useState<CachedBranding>(QUBEEX_DEFAULT_BRANDING);

    useEffect(() => {
        // Public marketing/login pages never have an institution context —
        // a stale cache from a previously-tested white-labeled institution
        // must not leak the wrong name/favicon onto them.
        if (isPublic) {
            setBranding(QUBEEX_DEFAULT_BRANDING);
            return;
        }

        const cached = readCachedBranding();
        if (cached.enabled) setBranding(cached);

        api.get('/branding')
            .then((r) => {
                const data = r.data?.data;
                if (isCachedBranding(data)) {
                    setBranding(data);
                    writeCachedBranding(data);
                }
            })
            .catch(() => { /* not logged in yet, or request failed — keep default/cached */ });
    }, [isPublic]);

    // Reflect the resolved theme color on <html> immediately client-side —
    // covers the very first visit (no qubeex_theme cookie yet for the
    // server-rendered layout to read) and instant feedback right after the
    // admin picks a new theme, without needing a full page reload.
    useEffect(() => {
        const effective = isPublic ? QUBEEX_DEFAULT_BRANDING : branding;
        if (effective.themeColor && effective.themeColor !== 'purple') {
            document.documentElement.setAttribute('data-theme', effective.themeColor);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }, [branding, isPublic]);

    // Update the document title client-side too, for the very first paint
    // right after login (before the branding cookie exists yet, since it's
    // only written once the /branding fetch above resolves). The favicon
    // itself is intentionally NOT touched here anymore — Next's own
    // app/favicon.ico file convention used to inject a competing <link
    // rel="icon"> ahead of anything added dynamically, and browsers use
    // whichever rel="icon" link appears FIRST in the document, so any
    // client-side swap here was always a losing race. Removing that file
    // and driving the favicon purely through the root layout's
    // generateMetadata (cookie-based, same as the title) is what actually
    // works reliably — see app/layout.tsx.
    useEffect(() => {
        const effective = isPublic ? QUBEEX_DEFAULT_BRANDING : branding;
        document.title = effective.enabled ? effective.brandName : 'QubeEx';
    }, [branding, isPublic]);

    return (
        <BrandingContext.Provider value={branding}>
            {children}
        </BrandingContext.Provider>
    );
}

export function useBranding() {
    return useContext(BrandingContext);
}
