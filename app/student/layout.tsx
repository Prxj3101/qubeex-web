'use client';

import { Topbar } from '@/components/shared/Topbar';
import { LayoutDashboard, Rss, ClipboardList, BookOpen, User } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Overview', href: '/student/overview', icon: LayoutDashboard },
    { label: 'Feed', href: '/student/feed', icon: Rss },
    { label: 'Tasks', href: '/student/tasks', icon: ClipboardList },
    { label: 'Courses', href: '/student/courses', icon: BookOpen },
    { label: 'Profile', href: '/student/profile', icon: User },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={NAV_ITEMS} />
            <main className="flex-1 overflow-y-auto px-2">
                {children}
            </main>
        </div>
    );
}