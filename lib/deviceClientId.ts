// A random id generated once per browser/app-install and persisted in
// localStorage — NOT tied to the logged-in user account. Used only for the
// test-taking single-device lock (see backend student/tasks.controller.ts
// startTest/heartbeatAttempt/listTests): it's how the backend tells two
// different devices logged into the same student account apart, so a live
// test can't be attempted simultaneously on two screens.
const STORAGE_KEY = 'qubeexDeviceClientId';

export function getDeviceClientId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        let id = localStorage.getItem(STORAGE_KEY);
        if (!id) {
            id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            localStorage.setItem(STORAGE_KEY, id);
        }
        return id;
    } catch {
        // localStorage unavailable (private browsing, storage disabled) —
        // the lock feature just degrades gracefully to "no enforcement" for
        // this session, same as an old cached frontend that never sends one.
        return null;
    }
}
