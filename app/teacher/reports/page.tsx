'use client';

import ReportsInboxView from '@/components/shared/ReportsInboxView';
import { FlagItem } from '@/lib/flags';

export default function TeacherReportsPage() {
    return (
        <ReportsInboxView
            title="Student Reports"
            subtitle="Reports assigned to you for review, and reports you've filed."
            inboxUrl="/teacher/reports/inbox"
            submittedUrl="/teacher/reports/submitted"
            reviewUrlBase="/teacher/reports"
            studentHrefBase={(report: FlagItem) =>
                `/teacher/classes/${report.divisionId}/students/${report.studentId}/reports?name=${encodeURIComponent(report.studentName)}${report.className ? `&class=${encodeURIComponent(report.className)}` : ''}`
            }
        />
    );
}
