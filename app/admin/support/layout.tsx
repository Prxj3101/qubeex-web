'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { TicketIcon, Star, Headset } from 'lucide-react';

const SUPPORT_TABS = [
    { label: 'Tickets', href: '/admin/support/tickets', icon: TicketIcon },
    { label: 'Reviews & Feedback', href: '/admin/support/feedback', icon: Star },
];

export default function AdminSupportLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col" style={{ height: '100%' }}>
            <div className="sticky top-0 z-20 bg-background space-y-3 pb-3">
                <div className="flex items-center justify-between pt-1 px-1">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Headset size={21} />
                            Support
                        </h1>
                        <p className="text-muted-foreground text-[13px]">Raise tickets and share feedback</p>
                    </div>
                </div>
                <div className="h-px bg-border/60" />

                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit mt-3">
                    {SUPPORT_TABS.map(tab => {
                        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
                        return (
                            <Link key={tab.href} href={tab.href} className="relative">
                                {isActive && (
                                    <motion.div layoutId="adminSupportTab"
                                        className="absolute inset-0 bg-primary rounded-4xl"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                                )}
                                <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl
                                    ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                    <tab.icon size={14} />
                                    {tab.label}
                                </div>
                            </Link>
                        );
                    })}
                </div>
                <div className="h-px bg-border/60" />
            </div>
            <div className="flex-1 overflow-y-auto pb-6">
                {children}
            </div>
        </div>
    );
}