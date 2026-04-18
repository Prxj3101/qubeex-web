'use client';

import type { InstitutionType } from '@/types';
import { getInstitutionAccent } from '@/lib/getInstitutionAccent';
import { useEffect, useState } from 'react';

interface OverviewHeroProps {
    adminName: string;
    institutionName: string;
    institutionType: InstitutionType;
}

export function OverviewHero({ adminName, institutionName, institutionType }: OverviewHeroProps) {
    const accent = getInstitutionAccent(institutionType);
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('dark'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div
            className="-mx-4 relative overflow-hidden rounded-b-[65px] px-13 py-10 flex items-center justify-between"
            style={{ background: isDark ? accent.bgDark : accent.bg }}
        >
            <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
            <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />

            <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
            <div className="absolute w-1 h-1 rounded-full bg-white/70 top-27 left-36 animate-pulse delay-300" />
            <div className="absolute w-1 h-1 rounded-full bg-white/70 top-22 left-5 animate-pulse delay-600" />
            <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-4 left-52 animate-pulse delay-700" />

            <div className="space-y-1 z-10">
                <p className="text-white/70 text-base">{greeting} {accent.emoji}, {adminName}</p>
                <p className="text-white text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                    {institutionName}
                </p>
                <p className="text-white/60 text-sm">Here&apos;s what&apos;s happening at your {accent.label.toLowerCase()} today.</p>
                <p className="text-white/50 text-xs mt-2">{dateStr}</p>
            </div>

            <div className="z-10 opacity-90 hidden sm:block">
                <svg width="140" height="120" viewBox="0 0 140 120" fill="none">
                    <rect x="10" y="20" width="120" height="85" rx="10" fill="white" fillOpacity="0.12" />
                    <rect x="18" y="28" width="50" height="30" rx="6" fill="white" fillOpacity="0.15" />
                    <rect x="76" y="28" width="46" height="30" rx="6" fill="white" fillOpacity="0.15" />
                    <rect x="18" y="64" width="104" height="6" rx="3" fill="white" fillOpacity="0.1" />
                    <rect x="18" y="74" width="80" height="6" rx="3" fill="white" fillOpacity="0.1" />
                    <rect x="18" y="84" width="60" height="6" rx="3" fill="white" fillOpacity="0.1" />
                    <rect x="24" y="46" width="6" height="8" rx="2" fill="white" fillOpacity="0.5" />
                    <rect x="33" y="40" width="6" height="14" rx="2" fill="white" fillOpacity="0.5" />
                    <rect x="42" y="44" width="6" height="10" rx="2" fill="white" fillOpacity="0.5" />
                    <rect x="51" y="36" width="6" height="18" rx="2" fill="white" fillOpacity="0.7" />
                    <circle cx="99" cy="43" r="10" stroke="white" strokeOpacity="0.3" strokeWidth="3" />
                    <circle cx="99" cy="43" r="10" stroke="white" strokeOpacity="0.8" strokeWidth="3"
                        strokeDasharray="40 23" strokeLinecap="round" />
                </svg>
            </div>
        </div>
    );
}
