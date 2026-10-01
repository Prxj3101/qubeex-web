// Teacher audit-log action labels + badge colours, shared by the Audit Logs page
// and Settings -> My Activity.
// ─── Action Config — only actions this teacher's own actions can actually
// produce (mirrors what the backend's logAudit calls emit for actorRole
// TEACHER: students, attendance, results, remarks, feed posts, and their
// own login/security events). ──────────────────────────────────────────────────
export const ACTION_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
    // Students
    STUDENT_ADDED: { label: 'Student Added', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400', dot: 'bg-violet-500' },
    STUDENT_UPDATED: { label: 'Student Updated', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400', dot: 'bg-blue-500' },
    STUDENT_DEACTIVATED: { label: 'Student Deactivated', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    STUDENT_ACTIVATED: { label: 'Student Activated', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-500' },
    STUDENT_REPORTED: { label: 'Student Reported', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400', dot: 'bg-rose-500' },
    STUDENT_REPORT_DELETED: { label: 'Report Deleted', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    // Attendance
    ATTENDANCE_MARKED: { label: 'Attendance Marked', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400', dot: 'bg-sky-500' },
    // Results
    RESULT_UPLOADED: { label: 'Results Published', cls: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400', dot: 'bg-pink-500' },
    // Feed
    ANNOUNCEMENT_POSTED: { label: 'Announcement Posted', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400', dot: 'bg-orange-500' },
    POST_DELETED: { label: 'Post Deleted', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', dot: 'bg-red-500' },
    // Security
    LOGIN_SUCCESS: { label: 'Login', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
    LOGIN_FAILED: { label: 'Login Failed', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400', dot: 'bg-rose-500' },
    PASSWORD_CHANGED: { label: 'Password Changed', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', dot: 'bg-amber-500' },
};

