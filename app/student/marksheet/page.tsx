'use client';

// This standalone quick-view marksheet page has been retired — the "Overall
// Score" dashboard card now goes straight to the full report card instead.
// Kept as a redirect (rather than deleted) since the sandbox can't remove
// files from this mount; this route should no longer be linked to anywhere.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentMarksheetRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/student/reportcard');
    }, [router]);
    return null;
}
