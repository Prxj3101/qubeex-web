'use client';

import { Topbar } from '@/components/shared/Topbar';
import PencilLoader from '@/components/student/PencilLoader';
import { LayoutDashboard, Rss, ClipboardList, BookOpen, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
    { label: 'Overview', href: '/student/overview', icon: LayoutDashboard },
    { label: 'Feed', href: '/student/feed', icon: Rss },
    { label: 'Tasks', href: '/student/tasks', icon: ClipboardList },
    { label: 'Class', href: '/student/class', icon: BookOpen },
    { label: 'Profile', href: '/student/profile', icon: User },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const t = setTimeout(() => setLoading(false), 1300);
        return () => clearTimeout(t);
    }, [pathname]);

    return (
        <div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
            <Topbar navItems={NAV_ITEMS} />
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
