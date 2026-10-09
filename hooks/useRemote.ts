import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fetch data whenever `key` changes (pass null to skip). State is only set from promise callbacks.
 *  - `loading`: true while the data on screen belongs to a different key (e.g. another class was selected).
 *  - `reload()`: refetch for the same key without flashing a spinner (use after a mutation).
 */
export function useRemote<T>(key: string | null, fetcher: () => Promise<T>, onError?: (e: unknown) => void) {
    const [state, setState] = useState<{ key: string | null; data: T | null }>({ key: null, data: null });
    const [nonce, setNonce] = useState(0);
    const fetchRef = useRef(fetcher);
    const errRef = useRef(onError);
    // Keep the latest callbacks without re-fetching when their identity changes. Declared before the
    // fetch effect so it always runs first.
    useEffect(() => {
        fetchRef.current = fetcher;
        errRef.current = onError;
    });

    useEffect(() => {
        if (key === null) return;
        let cancelled = false;
        fetchRef.current()
            .then(data => { if (!cancelled) setState({ key, data }); })
            .catch(e => {
                if (cancelled) return;
                setState({ key, data: null });
                errRef.current?.(e);
            });
        return () => { cancelled = true; };
    }, [key, nonce]);

    const reload = useCallback(() => setNonce(n => n + 1), []);
    const current = state.key === key;
    return { data: current ? state.data : null, loading: key !== null && !current, reload };
}
