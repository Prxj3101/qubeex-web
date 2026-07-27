'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

type InstType = 'SCHOOL' | 'COLLEGE' | 'COACHING';

const CACHE_KEY = 'qubeex:instType';

function readCachedInstType(): InstType {
    if (typeof window === 'undefined') return 'SCHOOL';
    const cached = window.localStorage.getItem(CACHE_KEY);
    return cached === 'SCHOOL' || cached === 'COLLEGE' || cached === 'COACHING' ? cached : 'SCHOOL';
}

const MockInstTypeContext = createContext<{
    instType: InstType;
}>({ instType: 'SCHOOL' });

export function MockInstTypeProvider({ children }: { children: React.ReactNode }) {
    // Seed from whatever we cached last time (localStorage) instead of always
    // starting at 'SCHOOL'. Without this, every refresh briefly painted the
    // violet school theme for a college account — the server has no way to
    // know the institution type, so it always renders 'SCHOOL' first, and the
    // real value only arrived after the `/admin/me` network round-trip
    // finished. Reading the last-known value synchronously on mount closes
    // that gap for every visit after the first. The lazy initializer only
    // runs on the client (this is a 'use client' component), so it doesn't
    // affect the server-rendered HTML — React just patches it in immediately
    // during hydration, which is why the wrapper below needs
    // suppressHydrationWarning wherever this value feeds a className.
    const [instType, setInstTypeState] = useState<InstType>(readCachedInstType);

    useEffect(() => {
        api.get('/admin/me')
            .then((r) => {
                const t = r.data?.data?.type;
                if (t === 'SCHOOL' || t === 'COLLEGE' || t === 'COACHING') {
                    setInstTypeState(t);
                    window.localStorage.setItem(CACHE_KEY, t);
                }
            })
            .catch(() => { /* not an admin / not logged in — keep default */ });
    }, []);

    return (
        <MockInstTypeContext.Provider value={{ instType }}>
            {children}
        </MockInstTypeContext.Provider>
    );
}

export function useMockInstType() {
    return useContext(MockInstTypeContext);
}