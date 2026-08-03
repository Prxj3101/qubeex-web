'use client';

import ReportsInboxView from '@/components/shared/ReportsInboxView';
import { FlagItem } from '@/lib/flags';

export default function AdminReportsPage() {
    return (
        <ReportsInboxView
            title="Student Reports"
            subtitle="All disciplinary and academic reports across the institution."
            inboxUrl="/admin/campus/reports/inbox"
            reviewUrlBase="/admin/campus/reports"
            studentHrefBase={(report: FlagItem) =>
                `/admin/campus/classes/${report.standardId}/${report.divisionId}/students/${report.studentId}/reports?name=${encodeURIComponent(report.studentName)}${report.className ? `&class=${encodeURIComponent(report.className)}` : ''}`
            }
        />
    );
}
