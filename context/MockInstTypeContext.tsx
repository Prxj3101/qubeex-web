'use client';

import { createContext, useContext, useState } from 'react';

type InstType = 'SCHOOL' | 'COLLEGE' | 'COACHING';

const MockInstTypeContext = createContext<{
    instType: InstType;
    setInstType: (t: InstType) => void;
}>({ instType: 'SCHOOL', setInstType: () => { } });

export function MockInstTypeProvider({ children }: { children: React.ReactNode }) {
    const [instType, setInstType] = useState<InstType>('SCHOOL');
    return (
        <MockInstTypeContext.Provider value={{ instType, setInstType }}>
            {children}
        </MockInstTypeContext.Provider>
    );
}

export function useMockInstType() {
    return useContext(MockInstTypeContext);
}