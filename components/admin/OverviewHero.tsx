'use client';

import type { InstitutionType } from '@/types';
import { getInstitutionAccent } from '@/lib/getInstitutionAccent';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isTodayBirthday, FORCE_SHOW_ROLES } from '@/components/shared/BirthdayBanner';
import { SillyStringOverlay } from '@/components/shared/SillyStringOverlay';

const CHARACTERS = [
    '/images/admin1.png',
    '/images/admin2.png',
    '/images/admin3.png',
    '/images/admin4.png',
    '/images/admin5.png',
    '/images/admin6.png',
];

interface OverviewHeroProps {
    adminName: string;
    institutionName: string;
    institutionType: InstitutionType;
    adminDob?: string;
    institutionEstablishedOn?: string;
}

export function OverviewHero({ adminName, institutionName, institutionType, adminDob, institutionEstablishedOn }: OverviewHeroProps) {
    const accent = getInstitutionAccent(institutionType);
    const [isDark, setIsDark] = useState(false);
    const [currentChar, setCurrentChar] = useState(0);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('dark'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const iv = setInterval(() => setCurrentChar(p => (p + 1) % CHARACTERS.length), 7000);
        return () => clearInterval(iv);
    }, []);

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    const isAdminBday = isTodayBirthday(adminDob ?? '') || FORCE_SHOW_ROLES.includes('admin');
    const isInstAnniversary = isTodayBirthday(institutionEstablishedOn ?? '') || FORCE_SHOW_ROLES.includes('institution');

    return (
        <div
            className="-mx-4 relative overflow-hidden rounded-b-[65px] px-13 py-5 flex items-center justify-between min-h-[160px]"
            style={{ background: isDark ? accent.bgDark : accent.bg }}
        >
            {/* Orbs */}
            <div className="absolute w-40 h-40 rounded-full bg-white/5 -top-10 -right-8" />
            <div className="absolute w-20 h-20 rounded-full bg-white/5 top-16 right-10" />

            {/* Stars */}
            <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-5 left-16 animate-pulse" />
            <div className="absolute w-1 h-1 rounded-full bg-white/70 top-27 left-36 animate-pulse delay-300" />
            <div className="absolute w-1 h-1 rounded-full bg-white/70 top-22 left-5 animate-pulse delay-500" />
            <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 top-4 left-52 animate-pulse delay-700" />

            {/* Text */}
            <div className="space-y-1 z-10">
                <p className="text-white/70 text-base">
                    {greeting} {accent.emoji},{' '}
                    <span className="relative inline-block">
                        {adminName}
                        <SillyStringOverlay name={adminName} fontSize={16} active={isAdminBday} />
                    </span>
                </p>
                <div className="relative">
                    <p className="text-white text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                        {institutionName}
                    </p>
                    <SillyStringOverlay name={institutionName} fontSize={30} active={isInstAnniversary} />
                </div>
                <p className="text-white/60 text-sm">Here&apos;s what&apos;s happening at your {accent.label.toLowerCase()} today.</p>
                <p className="text-white/50 text-xs mt-2">{dateStr}</p>
            </div>

            {/* Animated character */}
            <div className="z-10 relative w-[220px] h-[200px] hidden sm:block self-end mb-[-40px]">
                <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <AnimatePresence mode="wait">
                        <motion.img
                            key={currentChar}
                            src={CHARACTERS[currentChar]}
                            alt="admin character"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2 }}
                            className="w-[250px] h-[200px] object-contain"
                            style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' }}
                        />
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}