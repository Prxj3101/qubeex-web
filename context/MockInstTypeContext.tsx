'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

type InstType = 'SCHOOL' | 'COLLEGE' | 'COACHING';

const MockInstTypeContext = createContext<{
    instType: InstType;
    setInstType: (t: InstType) => void;
}>({ instType: 'SCHOOL', setInstType: () => { } });

export function MockInstTypeProvider({ children }: { children: React.ReactNode }) {
    // Start as 'SCHOOL' on both server and client so the first render matches the
    // server-rendered HTML (no hydration mismatch); the real institution type is
    // fetched right after mount so the UI (theme + terminology) reflects whether
    // the logged-in institution is a school, college, or coaching institute.
    const [instType, setInstTypeState] = useState<InstType>('SCHOOL');

    const setInstType = (t: InstType) => setInstTypeState(t);

    useEffect(() => {
        api.get('/admin/me')
            .then((r) => {
                const t = r.data?.data?.type;
                if (t === 'SCHOOL' || t === 'COLLEGE' || t === 'COACHING') {
                    setInstTypeState(t);
                }
            })
            .catch(() => { /* not an admin / not logged in — keep default */ });
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