'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import {
    Bell, X, CheckCheck, TicketIcon, Star, MessageSquare,
    Building2, CreditCard, UserCheck, Megaphone, ChevronRight,
    BookOpen, AlertTriangle, IndianRupee, Calendar, Users,
    ClipboardList, GraduationCap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
    | 'NEW_TICKET' | 'NEW_REVIEW' | 'TICKET_REPLY' | 'NEW_INSTITUTION'
    | 'PLAN_EXPIRING' | 'ADMIN_STATUS' | 'BROADCAST_SENT'
    | 'SYSTEM_UPDATE' | 'STUDENT_ENROLLED' | 'TEST_PUBLISHED' | 'PLAN_EXPIRY_ADMIN'
    | 'ASSIGNMENT_SUBMITTED' | 'TEST_SCHEDULED' | 'STUDENT_FLAGGED'
    | 'EXAM_REMINDER' | 'RESULT_PUBLISHED' | 'ATTENDANCE_WARNING' | 'FEE_DUE' | 'ANNOUNCEMENT';

interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    subtitle: string;
    time: string;
    read: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SUPERADMIN_NOTIFICATIONS: Notification[] = [
    { id: 'sa1', type: 'NEW_TICKET', read: false, title: 'New ticket from Delhi Public School', subtitle: 'Bug: Test submissions not saving correctly', time: '2 min ago' },
    { id: 'sa2', type: 'NEW_REVIEW', read: false, title: 'New review from Fergusson College', subtitle: '⭐⭐⭐⭐⭐ — Best assessment platform we have used', time: '18 min ago' },
    { id: 'sa3', type: 'NEW_INSTITUTION', read: false, title: 'New institution registered', subtitle: 'Ryan International School has been onboarded', time: '1 hr ago' },
    { id: 'sa4', type: 'TICKET_REPLY', read: false, title: 'Ticket reply from Aakash Coaching', subtitle: 'Re: Request for bulk student import via CSV', time: '2 hr ago' },
    { id: 'sa5', type: 'PLAN_EXPIRING', read: true, title: 'Plan expiring soon', subtitle: 'Sunrise Academy Pro plan expires in 5 days', time: '3 hr ago' },
    { id: 'sa6', type: 'ADMIN_STATUS', read: true, title: 'Admin activated', subtitle: 'rohit.sharma@dps.edu.in is now active', time: '1 day ago' },
    { id: 'sa7', type: 'BROADCAST_SENT', read: true, title: 'Broadcast delivered', subtitle: 'Maintenance notification sent to 48 admins', time: '2 days ago' },
];

const ADMIN_NOTIFICATIONS: Notification[] = [
    { id: 'ad1', type: 'SYSTEM_UPDATE', read: false, title: 'Platform update available', subtitle: 'QubeEx v2.1 — New AI grading features added', time: '10 min ago' },
    { id: 'ad2', type: 'STUDENT_ENROLLED', read: false, title: '12 new students enrolled', subtitle: 'Class 10-A now has 36 students', time: '1 hr ago' },
    { id: 'ad3', type: 'TEST_PUBLISHED', read: false, title: 'Test results published', subtitle: 'Maths Unit Test — Class 9 results are ready', time: '2 hr ago' },
    { id: 'ad4', type: 'PLAN_EXPIRY_ADMIN', read: false, title: 'Your plan expires in 7 days', subtitle: 'Renew your Pro plan to avoid service interruption', time: '3 hr ago' },
    { id: 'ad5', type: 'BROADCAST_SENT', read: true, title: 'System maintenance tonight', subtitle: 'QubeEx will be down from 2AM to 4AM IST', time: '5 hr ago' },
    { id: 'ad6', type: 'STUDENT_ENROLLED', read: true, title: '5 new students enrolled', subtitle: 'Class 9-B now has 28 students', time: '1 day ago' },
];

const TEACHER_NOTIFICATIONS: Notification[] = [
    { id: 'tc1', type: 'ASSIGNMENT_SUBMITTED', read: false, title: '24 assignments submitted', subtitle: 'DS Unit 3 Assignment — Class 10-A', time: '5 min ago' },
    { id: 'tc2', type: 'TEST_SCHEDULED', read: false, title: 'New test scheduled', subtitle: 'DBMS Mid-term on 25 Apr 2026', time: '30 min ago' },
    { id: 'tc3', type: 'STUDENT_FLAGGED', read: false, title: 'Student flagged', subtitle: 'Rahul Sharma — Tab switch during online test', time: '2 hr ago' },
    { id: 'tc4', type: 'RESULT_PUBLISHED', read: true, title: 'Results published', subtitle: 'OS Quiz 2 results are now visible to students', time: '4 hr ago' },
    { id: 'tc5', type: 'SYSTEM_UPDATE', read: true, title: 'Platform maintenance tonight', subtitle: 'QubeEx will be down from 2AM to 4AM IST', time: '6 hr ago' },
];

const STUDENT_NOTIFICATIONS: Notification[] = [
    { id: 'st1', type: 'EXAM_REMINDER', read: false, title: 'Exam in 2 days', subtitle: 'DBMS Mid-term on 25 Apr 2026 at 10:00 AM', time: '1 hr ago' },
    { id: 'st2', type: 'RESULT_PUBLISHED', read: false, title: 'Result published', subtitle: 'OS Quiz 2 — Your score: 85/100', time: '2 hr ago' },
    { id: 'st3', type: 'ATTENDANCE_WARNING', read: false, title: 'Attendance warning', subtitle: 'CN theory attendance below 75% — 63%', time: '3 hr ago' },
    { id: 'st4', type: 'FEE_DUE', read: false, title: 'Fee payment due', subtitle: 'Year 3 pending — ₹30,000 due by 30 Jun 2025', time: '5 hr ago' },
    { id: 'st5', type: 'ANNOUNCEMENT', read: true, title: 'New announcement', subtitle: 'Exam schedule updated — Check calendar', time: '1 day ago' },
    { id: 'st6', type: 'RESULT_PUBLISHED', read: true, title: 'Result published', subtitle: 'DS Assignment 3 — Your score: 18/20', time: '2 days ago' },
];

// ─── Icon Config ──────────────────────────────────────────────────────────────

const TYPE_CFG: Record<NotificationType, { icon: React.ElementType; iconBg: string; iconColor: string }> = {
    NEW_TICKET: { icon: TicketIcon, iconBg: 'bg-red-100 dark:bg-red-950/50', iconColor: 'text-red-500' },
    NEW_REVIEW: { icon: Star, iconBg: 'bg-amber-100 dark:bg-amber-950/50', iconColor: 'text-amber-500' },
    TICKET_REPLY: { icon: MessageSquare, iconBg: 'bg-blue-100 dark:bg-blue-950/50', iconColor: 'text-blue-500' },
    NEW_INSTITUTION: { icon: Building2, iconBg: 'bg-violet-100 dark:bg-[#7C3AED]/20', iconColor: 'text-violet-600 dark:text-violet-400' },
    PLAN_EXPIRING: { icon: CreditCard, iconBg: 'bg-orange-100 dark:bg-orange-950/50', iconColor: 'text-orange-500' },
    ADMIN_STATUS: { icon: UserCheck, iconBg: 'bg-emerald-100 dark:bg-emerald-950/50', iconColor: 'text-emerald-500' },
    BROADCAST_SENT: { icon: Megaphone, iconBg: 'bg-sky-100 dark:bg-sky-950/50', iconColor: 'text-sky-500' },
    SYSTEM_UPDATE: { icon: Bell, iconBg: 'bg-sky-100 dark:bg-sky-950/50', iconColor: 'text-sky-500' },
    STUDENT_ENROLLED: { icon: GraduationCap, iconBg: 'bg-emerald-100 dark:bg-emerald-950/50', iconColor: 'text-emerald-500' },
    TEST_PUBLISHED: { icon: BookOpen, iconBg: 'bg-violet-100 dark:bg-[#7C3AED]/20', iconColor: 'text-violet-600 dark:text-violet-400' },
    PLAN_EXPIRY_ADMIN: { icon: CreditCard, iconBg: 'bg-orange-100 dark:bg-orange-950/50', iconColor: 'text-orange-500' },
    ASSIGNMENT_SUBMITTED: { icon: ClipboardList, iconBg: 'bg-violet-100 dark:bg-[#7C3AED]/20', iconColor: 'text-violet-600 dark:text-violet-400' },
    TEST_SCHEDULED: { icon: Calendar, iconBg: 'bg-blue-100 dark:bg-blue-950/50', iconColor: 'text-blue-500' },
    STUDENT_FLAGGED: { icon: AlertTriangle, iconBg: 'bg-red-100 dark:bg-red-950/50', iconColor: 'text-red-500' },
    EXAM_REMINDER: { icon: Calendar, iconBg: 'bg-red-100 dark:bg-red-950/50', iconColor: 'text-red-500' },
    RESULT_PUBLISHED: { icon: BookOpen, iconBg: 'bg-emerald-100 dark:bg-emerald-950/50', iconColor: 'text-emerald-500' },
    ATTENDANCE_WARNING: { icon: AlertTriangle, iconBg: 'bg-amber-100 dark:bg-amber-950/50', iconColor: 'text-amber-500' },
    FEE_DUE: { icon: IndianRupee, iconBg: 'bg-orange-100 dark:bg-orange-950/50', iconColor: 'text-orange-500' },
    ANNOUNCEMENT: { icon: Megaphone, iconBg: 'bg-sky-100 dark:bg-sky-950/50', iconColor: 'text-sky-500' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationsBell() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const role =
        pathname.startsWith('/superadmin') ? 'SUPER_ADMIN' :
            pathname.startsWith('/admin') ? 'ADMIN' :
                pathname.startsWith('/teacher') ? 'TEACHER' :
                    'STUDENT';

    const initialNotifs =
        role === 'SUPER_ADMIN' ? SUPERADMIN_NOTIFICATIONS :
            role === 'ADMIN' ? ADMIN_NOTIFICATIONS :
                role === 'TEACHER' ? TEACHER_NOTIFICATIONS :
                    STUDENT_NOTIFICATIONS;

    const [notifs, setNotifs] = useState<Notification[]>(initialNotifs);

    const unreadCount = notifs.filter((n: Notification) => !n.read).length;

    const markAllRead = () => setNotifs(prev => prev.map((n: Notification) => ({ ...n, read: true })));
    const markRead = (id: string) => setNotifs(prev => prev.map((n: Notification) => n.id === id ? { ...n, read: true } : n));

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setOpen(o => !o)}
                className="relative h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted/50 transition-colors"
            >
                <Bell size={18} className="text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Backdrop */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Dropdown */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="absolute right-0 top-11 z-50 w-[380px] bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">Notifications</p>
                                {unreadCount > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">
                                        {unreadCount} new
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button onClick={markAllRead}
                                        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                                        <CheckCheck size={13} />
                                        Mark all read
                                    </button>
                                )}
                                <button onClick={() => setOpen(false)}
                                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
                                    <X size={13} className="text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="max-h-[420px] overflow-y-auto divide-y divide-border/30">
                            {notifs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Bell size={28} className="text-muted-foreground mb-2" />
                                    <p className="text-sm font-medium text-muted-foreground">No notifications</p>
                                </div>
                            ) : (
                                notifs.map((notif: Notification) => {
                                    const cfg = TYPE_CFG[notif.type];
                                    const Icon = cfg.icon;
                                    return (
                                        <motion.button
                                            key={notif.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            onClick={() => markRead(notif.id)}
                                            className={`w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                                        >
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.iconBg}`}>
                                                <Icon size={14} className={cfg.iconColor} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs leading-snug ${!notif.read ? 'font-semibold' : 'font-medium'}`}>
                                                    {notif.title}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                                    {notif.subtitle}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground/70 mt-1">{notif.time}</p>
                                            </div>
                                            {!notif.read && (
                                                <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                                            )}
                                        </motion.button>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-border/50 px-4 py-3">
                            <button className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                                View all notifications
                                <ChevronRight size={13} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}