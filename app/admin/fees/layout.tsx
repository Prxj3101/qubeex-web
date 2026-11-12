'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { HandCoins, BookOpenText, BellRing, Settings2 } from 'lucide-react';

// Fees desk: the school's fee counter. Same tab bar as Payroll, with the
// gear button for Fee Setup (each class's fee card).
const FEES_TABS = [
    { label: 'Collect', href: '/admin/fees/collect', icon: HandCoins },
    { label: 'Day Book', href: '/admin/fees/today', icon: BookOpenText },
    { label: 'Dues', href: '/admin/fees/dues', icon: BellRing },
];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/');

export default function FeesLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const inSetup = under(pathname, '/admin/fees/setup');
    return (
        <div className="flex flex-col h-full overflow-visible">
            <div className="shrink-0 pt-0 pb-1 px-1 flex items-center gap-2 overflow-x-auto sm:overflow-visible">
                <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit shrink-0">
                    {FEES_TABS.map((tab) => {
                        const isActive = under(pathname, tab.href);
                        const Icon = tab.icon;
                        return (
                            <Link key={tab.href} href={tab.href} className="relative">
                                {isActive && (
                                    <motion.div layoutId="feesTab" className="absolute inset-0 bg-primary rounded-4xl"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
                                )}
                                <div className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl whitespace-nowrap
                                    ${isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                    <Icon size={14} />
                                    {tab.label}
                                </div>
                            </Link>
                        );
                    })}
                </div>
                <div className="relative group shrink-0">
                    <Link href="/admin/fees/setup" aria-label="Fee Setup" aria-current={inSetup ? 'page' : undefined}
                        className={`relative flex items-center justify-center w-[41px] h-[41px] rounded-full border border-border/50 transition-colors ${inSetup ? 'text-white' : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                        {inSetup && <motion.div layoutId="feesTab" className="absolute inset-0 bg-primary rounded-full" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
                        <Settings2 size={16} className="relative z-10" />
                    </Link>
                    <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 z-50 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Fee Setup</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-1 pb-6">
                {children}
            </div>
        </div>
    );
}
