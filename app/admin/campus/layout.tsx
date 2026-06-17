'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Rss, LayoutGrid } from 'lucide-react';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { useAuthStore } from '@/store/authStore';

export default function CampusLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { instType } = useMockInstType();
    const { user } = useAuthStore();

    const classesLabel = instType === 'COLLEGE' ? 'Departments' : instType === 'COACHING' ? 'Batches' : 'Classes';

    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const permissions = user?.permissions ?? [];

    // Whether the subadmin has any campus permission that allows feed access
    const canSeeFeed = !isSubAdmin ||
        permissions.includes('CAMPUS_VIEW') ||
        permissions.includes('CAMPUS_MANAGE');

    const onCampusRoot = pathname === '/admin/campus' || pathname === '/admin/campus/';
    const needsRedirect = !!user && isSubAdmin && !canSeeFeed && onCampusRoot;

    useEffect(() => {
        if (needsRedirect) router.replace('/admin/campus/classes');
    }, [needsRedirect, router]);

    const TABS = [
        ...(canSeeFeed ? [{ key: 'feed', label: 'Feed', icon: Rss, href: '/admin/campus' }] : []),
        { key: 'classes', label: classesLabel, icon: LayoutGrid, href: '/admin/campus/classes' },
    ];

    const activeTab = pathname.startsWith('/admin/campus/classes') ? 'classes' : 'feed';

    // Only show the tab bar on the top-level campus pages (not inside a class detail)
    const showTabs = pathname === '/admin/campus' || pathname === '/admin/campus/classes';

    if (needsRedirect) return null;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {showTabs && TABS.length > 1 && (
                <div className="shrink-0 pt-0 pb-2 px-1">
                    <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            const Icon = tab.icon;
                            return (
                                <button key={tab.key} onClick={() => router.push(tab.href)} className="relative">
                                    {isActive && (
                                        <motion.div
                                            layoutId="campusTab"
                                            className="absolute inset-0 bg-primary rounded-4xl"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                        />
                                    )}
                                    <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl transition-colors ${
                                        isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                                    }`}>
                                        <Icon size={14} />
                                        {tab.label}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
