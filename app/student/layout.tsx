'use client';

import { Topbar } from '@/components/shared/Topbar';
import PencilLoader from '@/components/student/PencilLoader';
import { FeedBadgeProvider, useFeedBadge } from '@/context/FeedBadgeContext';
import { useStudentStore } from '@/store/studentStore';
import { LayoutDashboard, Rss, ClipboardList, BookOpen, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

function StudentLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const { feedHasNew, clearFeedBadge } = useFeedBadge();
    const { fetchProfile, studentId } = useStudentStore();

    // Populate store once so division name etc. are available on all student pages
    useEffect(() => {
        if (!studentId) fetchProfile();
    }, []);

    useEffect(() => {
        setLoading(true);
        const t = setTimeout(() => setLoading(false), 1300);
        return () => clearTimeout(t);
    }, [pathname]);

    // Clear badge when user navigates to the feed page
    useEffect(() => {
        if (pathname === '/student/feed') clearFeedBadge();
    }, [pathname, clearFeedBadge]);

    const navItems = [
        { label: 'Overview', href: '/student/overview', icon: LayoutDashboard },
        { label: 'Feed', href: '/student/feed', icon: Rss, badge: feedHasNew },
        { label: 'Tasks', href: '/student/tasks', icon: ClipboardList },
        { label: 'Class', href: '/student/class', icon: BookOpen },
        {
            label: 'Profile', href: '/student/profile', icon: User,
            activePath: ['/student/detail', '/student/attendance', '/student/reportcard', '/student/flags', '/student/fees'],
        },
    ];

    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={navItems} />
            <main className="flex-1 overflow-y-auto px-2">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <PencilLoader size={72} />
                    </div>
                ) : (
                    children
                )}
            </main>
        </div>
    );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    return (
        <FeedBadgeProvider>
            <StudentLayoutInner>{children}</StudentLayoutInner>
        </FeedBadgeProvider>
    );
}
