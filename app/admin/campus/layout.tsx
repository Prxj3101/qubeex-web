'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Rss, LayoutGrid, Lock } from 'lucide-react';
import { useMockInstType } from '@/context/MockInstTypeContext';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

export default function CampusLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { instType } = useMockInstType();
    const { user } = useAuthStore();

    // The server always renders as if instType === 'SCHOOL' (it has no way to
    // know the real value, which only lives in localStorage/the /admin/me
    // fetch). Rendering the tab label only after mount means there's nothing
    // server-rendered here to conflict with — no hydration mismatch, no stuck
    // stale text, no error overlay. By the time `mounted` flips true (next
    // tick after the first commit), instType is already correct thanks to
    // MockInstTypeContext's cached lazy init, so this doesn't reintroduce the
    // flash the caching was added to avoid.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const classesLabel = instType === 'COLLEGE' ? 'Courses' : instType === 'COACHING' ? 'Batches' : 'Classes';
    const classesHref = instType === 'COLLEGE' ? '/admin/campus/courses' : '/admin/campus/classes';

    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const permissions = user?.permissions ?? [];

    const canSeeFeed = !isSubAdmin || permissions.includes('CAMPUS_FEED');

    const onCampusRoot = pathname === '/admin/campus' || pathname === '/admin/campus/';
    const needsRedirect = !!user && isSubAdmin && !canSeeFeed && onCampusRoot;

    useEffect(() => {
        if (needsRedirect) router.replace(classesHref);
    }, [needsRedirect, router, classesHref]);

    const TABS = [
        { key: 'feed', label: 'Feed', icon: Rss, href: '/admin/campus', locked: !canSeeFeed },
        { key: 'classes', label: classesLabel, icon: LayoutGrid, href: classesHref, locked: false },
    ];

    const activeTab = (pathname.startsWith('/admin/campus/classes') || pathname.startsWith('/admin/campus/courses')) ? 'classes' : 'feed';

    // Only show the tab bar on the top-level campus pages (not inside a class detail)
    const showTabs = pathname === '/admin/campus' || pathname === '/admin/campus/classes' || pathname === '/admin/campus/courses';

    if (needsRedirect) return null;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {showTabs && mounted && (
                <div className="shrink-0 pt-0 pb-2 px-1 overflow-x-auto">
                    <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            const Icon = tab.icon;

                            if (tab.locked) {
                                return (
                                    <div
                                        key={tab.key}
                                        className="relative opacity-40 cursor-not-allowed"
                                        onClick={() => toast.error('Access restricted — contact your admin')}
                                    >
                                        <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl text-muted-foreground">
                                            <Icon size={14} />
                                            {tab.label}
                                            <Lock size={11} />
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <button key={tab.key} onClick={() => router.push(tab.href)} className="relative">
                                    {isActive && (
                                        <motion.div
                                            layoutId="campusTab"
                                            className="absolute inset-0 bg-primary rounded-4xl"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                        />
                                    )}
                                    <div
                                        className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl transition-colors ${
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
