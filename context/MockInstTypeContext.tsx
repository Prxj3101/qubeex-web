'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type InstType = 'SCHOOL' | 'COLLEGE' | 'COACHING';

const STORAGE_KEY = 'qubeex_mock_inst_type';

const MockInstTypeContext = createContext<{
    instType: InstType;
    setInstType: (t: InstType) => void;
}>({ instType: 'SCHOOL', setInstType: () => { } });

export function MockInstTypeProvider({ children }: { children: React.ReactNode }) {
    // Always start as 'SCHOOL' on both server and client so the first client
    // render matches the server-rendered HTML exactly (no hydration mismatch).
    // The persisted value (if any) is applied right after mount below.
    const [instType, setInstTypeState] = useState<InstType>('SCHOOL');

    const setInstType = (t: InstType) => {
        setInstTypeState(t);
        try { window.localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
    };

    // Guard against SSR/CSR hydration mismatch — the server always renders
    // 'SCHOOL', so re-sync from localStorage right after mount too.
    useEffect(() => {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === 'SCHOOL' || saved === 'COLLEGE' || saved === 'COACHING') {
            setInstTypeState(saved);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <MockInstTypeContext.Provider value={{ instType, setInstType }}>
            {children}
        </MockInstTypeContext.Provider>
    );
}

export function useMockInstType() {
    return useContext(MockInstTypeContext);
}