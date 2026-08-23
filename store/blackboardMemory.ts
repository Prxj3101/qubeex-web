import { useEffect, useRef, useState } from 'react';

// Cross-navigation AND cross-refresh memory for the teacher Blackboard page —
// whatever's currently loaded/drawn/open (document, zoom, drawing, which AI
// panel is open and its own progress) must survive both navigating away to
// another page and back, and a plain browser refresh while still on the
// page. Only an explicit logout should reset it.
//
// Backed by localStorage (not just an in-memory object) so it survives a
// full reload, not only client-side route changes. Lives in its own tiny
// module (not inside the Blackboard page file) so authStore can call
// clearBlackboardMemory() on logout without pulling the entire Blackboard
// page (react-pdf, lottie, etc.) into every bundle.
const STORAGE_PREFIX = 'bb_';

function readAllFromStorage(): Record<string, unknown> {
    if (typeof window === 'undefined') return {};
    const out: Record<string, unknown> = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
            try {
                out[k.slice(STORAGE_PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
            } catch {}
        }
    } catch {}
    return out;
}

// In-memory mirror, hydrated once from localStorage on module load —
// localStorage itself is only touched again on writes, not on every read.
export const blackboardMemory: Record<string, unknown> = readAllFromStorage();

function persistToStorage(key: string, value: unknown) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
        // Quota exceeded (e.g. an unusually large canvas snapshot) — drop
        // just that key rather than losing the rest of the session's state.
    }
}

/** For writes made outside a component's own render state (e.g. imperative canvas snapshots, plain flags) — updates both the in-memory mirror and localStorage. */
export function setBlackboardValue(key: string, value: unknown) {
    blackboardMemory[key] = value;
    persistToStorage(key, value);
}

export function clearBlackboardMemory() {
    for (const k of Object.keys(blackboardMemory)) delete blackboardMemory[k];
    if (typeof window !== 'undefined') {
        try {
            const toRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
            }
            toRemove.forEach(k => localStorage.removeItem(k));
        } catch {}
    }
    clearBlackboardFile();
}

/**
 * Drop-in replacement for useState whose value survives the Blackboard
 * page's unmount/remount AND a page refresh.
 *
 * The initial render always starts from `initialValue` — the same thing the
 * server rendered — even if a persisted value already exists in
 * localStorage. Reading localStorage during the state initializer would make
 * the very first client render disagree with the server-rendered HTML
 * (e.g. "Load a document to begin" on the server vs the actual doc name on
 * the client), which React flags as a hydration mismatch and reacts to by
 * throwing away and rebuilding the whole tree. Instead, the persisted value
 * (if any) is applied a moment later in an effect, which only runs on the
 * client after hydration has already succeeded — so there's a normal,
 * mismatch-free re-render instead of an error.
 */
export function usePersisted<T>(key: string, initialValue: T | (() => T)): [T, (updater: T | ((prev: T) => T)) => void] {
    const [state, setState] = useState<T>(() =>
        typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
    );
    const hydrated = useRef(false);

    useEffect(() => {
        if (hydrated.current) return;
        hydrated.current = true;
        if (key in blackboardMemory) setState(blackboardMemory[key] as T);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setPersisted = (updater: T | ((prev: T) => T)) => {
        setState(prev => {
            const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
            blackboardMemory[key] = next;
            persistToStorage(key, next);
            return next;
        });
    };
    return [state, setPersisted];
}

// ── Locally-uploaded file storage (IndexedDB) ────────────────────────────────
// A document loaded "From Computer" only exists as an in-memory File behind a
// blob: URL — that URL (and the file data itself) is gone the instant the tab
// does a real reload, unlike a "From Storage" doc which is a real hosted URL.
// Stashing the actual File in IndexedDB lets a fresh blob URL be minted after
// reload so the same document reappears instead of vanishing.
const DB_NAME = 'blackboard-db';
const STORE_NAME = 'files';
const FILE_KEY = 'currentFile';

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveBlackboardFile(file: File): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(file, FILE_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {}
}

export async function loadBlackboardFile(): Promise<File | null> {
    if (typeof window === 'undefined' || !window.indexedDB) return null;
    try {
        const db = await openDb();
        return await new Promise<File | null>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(FILE_KEY);
            req.onsuccess = () => resolve((req.result as File) ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

export function clearBlackboardFile(): void {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    openDb().then(db => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(FILE_KEY);
    }).catch(() => {});
}
