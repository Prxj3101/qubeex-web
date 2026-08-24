'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';
import {
    type CachedBranding,
    isCachedBranding,
    readCachedBranding,
    writeCachedBranding,
    QUBEEX_DEFAULT_BRANDING,
} from '@/lib/brandingCache';

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
    // Seed from the last-known value so a hard refresh doesn't flash QubeEx
    // branding before the network round-trip finishes — same reasoning as
    // MockInstTypeProvider's lazy initializer.
    const [branding, setBranding] = useState<CachedBranding>(readCachedBranding);

    useEffect(() => {
        api.get('/branding')
            .then((r) => {
                const data = r.data?.data;
                if (isCachedBranding(data)) {
                    setBranding(data);
                    writeCachedBranding(data);
                }
            })
            .catch(() => { /* not logged in yet, or request failed — keep default/cached */ });
    }, []);

    // Update the document title + favicon client-side whenever branding
    // changes. True per-request SSR favicon swapping isn't feasible here
    // (Next's favicon.ico convention is static, and the app has no
    // subdomain-per-institution routing to key off pre-auth) — this is a
    // deliberate flash-then-swap tradeoff, same as the title before the root
    // layout's cookie mirror catches up on the next request.
    useEffect(() => {
        document.title = branding.enabled ? branding.brandName : 'QubeEx';
        const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (link) link.href = branding.enabled ? branding.faviconUrl : '/favicon.ico';
    }, [branding]);

    return (
        <BrandingContext.Provider value={branding}>
            {children}
        </BrandingContext.Provider>
    );
}

export function useBranding() {
    return useContext(BrandingContext);
}
