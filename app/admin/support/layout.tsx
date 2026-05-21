'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { TicketIcon, Star } from 'lucide-react';

const SUPPORT_TABS = [
    { label: 'Tickets', href: '/admin/support/tickets', icon: TicketIcon },
    { label: 'Reviews & Feedback', href: '/admin/support/feedback', icon: Star },
];

export default function AdminSupportLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Tab bar */}
            <div className="shrink-0 pt-0 pb-1 px-1">
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                    {SUPPORT_TABS.map((tab) => {
                        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
                        const Icon = tab.icon;
                        return (
                            <Link key={tab.href} href={tab.href} className="relative">
                                {isActive && (
                                    <motion.div
                                        layoutId="adminSupportTab"
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