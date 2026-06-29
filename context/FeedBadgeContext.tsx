'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type FeedBadgeContextType = {
    feedHasNew: boolean;
    setFeedHasNew: (val: boolean) => void;
    clearFeedBadge: () => void;
};

const FeedBadgeContext = createContext<FeedBadgeContextType>({
    feedHasNew: false,
    setFeedHasNew: () => {},
    clearFeedBadge: () => {},
});

export function FeedBadgeProvider({ children }: { children: React.ReactNode }) {
    const [feedHasNew, setFeedHasNew] = useState(false);
    const clearFeedBadge = useCallback(() => setFeedHasNew(false), []);
    return (
        <FeedBadgeContext.Provider value={{ feedHasNew, setFeedHasNew, clearFeedBadge }}>
            {children}
        </FeedBadgeContext.Provider>
    );
}

export function useFeedBadge() {
    return useContext(FeedBadgeContext);
}
