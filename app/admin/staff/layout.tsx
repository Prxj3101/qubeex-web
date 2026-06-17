'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, MessageSquare, Shield, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const PEOPLE_TABS = [
    { label: 'Teachers',  href: '/admin/staff/teachers',  icon: Users,         permKey: 'STAFF_TEACHERS'  },
    { label: 'Subadmins', href: '/admin/staff/subadmins', icon: Shield,        permKey: 'STAFF_SUBADMINS' },
    { label: 'Staffroom', href: '/admin/staff/staffroom', icon: MessageSquare, permKey: 'STAFF_STAFFROOM' },
];

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuthStore();

    const isSubAdmin = user?.role === 'SUB_ADMIN';
    const permissions = user?.permissions ?? [];

    function isTabLocked(permKey: string): boolean {
        if (!isSubAdmin) return false;
        return !permissions.includes(permKey);
    }

    // Redirect if landing on a locked sub-tab directly
    useEffect(() => {
        if (!isSubAdmin) return;
        const current = PEOPLE_TABS.find(t => pathname === t.href || pathname.startsWith(t.href + '/'));
        if (current && isTabLocked(current.permKey)) {
            const first = PEOPLE_TABS.find(t => !isTabLocked(t.permKey));
            router.replace(first ? first.href : '/admin/overview');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, isSubAdmin]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Tab bar */}
            <div className="shrink-0 pt-0 pb-2 px-1">
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                    {PEOPLE_TABS.map((tab) => {
                        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
                        const locked = isTabLocked(tab.permKey);
                        const Icon = tab.icon;

                        if (locked) {
                            return (
                                <div
                                    key={tab.href}
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
                            <Link key={tab.href} href={tab.href} className="relative">
                                {isActive && (
                                    <motion.div
                                        layoutId="peopleTab"
                                        className="absolute inset-0 bg-primary rounded-4xl"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                    />
                                )}
                                <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl
                                    ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                    <Icon size={14} />
                                    {tab.label}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-1">
                {children}
            </div>
        </div>
    );
}
