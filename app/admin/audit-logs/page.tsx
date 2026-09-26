'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Audit Logs moved under Insights (/admin/insights/audit-logs). This old
// route just forwards there so any saved link or bookmark keeps working.
export default function AuditLogsRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace('/admin/insights/audit-logs'); }, [router]);
    return null;
}
