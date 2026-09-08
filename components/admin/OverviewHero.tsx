'use client';

import type { InstitutionType } from '@/types';
import { getInstitutionAccent } from '@/lib/getInstitutionAccent';
import { useThemeAccent } from '@/hooks/useThemeAccent';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isTodayBirthday } from '@/components/shared/BirthdayBanner';
import { SillyStringOverlay } from '@/components/shared/SillyStringOverlay';

const CHARACTERS = [
    '/images/admin1.png',
    '/images/admin2.png',
    '/images/admin3.png',
    '/images/admin4.png',
    '/images/admin5.png',
    '/images/admin6.png',
];

const CASUAL_MESSAGES = [
    "Good morning! ☕ Your institution's engine room awaits.",
    "GM! 🌅 Somewhere, a fee reminder is waiting to be sent.",
    "Rise and shine - the timetable isn't going to balance itself.",
    "Another day, another attendance report to glance at. 📊",
    "Hope today has fewer 'sir ek minute' interruptions than yesterday.",
    "Behind every smooth school day is an admin quietly holding it together. 💪",
    "Coffee first, staff meeting agenda second. ☕",
    "Today's forecast: 90% paperwork, 10% chaos, 100% you've got this.",
    "Fun fact: no one notices a well-run school - that's the whole trick.",
    "May your inbox be light and your fee collections be heavy. 💰",
    "Somewhere a parent is drafting a WhatsApp message right now. Brace yourself. 😅",
    "You run the show even when nobody's watching the credits roll.",
    "Reminder: the staff room gossip is 90% accurate, plan accordingly.",
    "Today feels like a good day to finally clear that pending leave request pile.",
    "Behind schedule? So is everyone. You're just more honest about it.",
    "Every great school has one thing in common - an admin who never sleeps on deadlines.",
    "Plot twist: today might actually go as planned. Might.",
    "The bell rings for students. For you, it never really stops. 🔔",
    "Small tip: a five-minute walk through the corridors tells you more than any report.",
    "Somewhere, a teacher needs five minutes of your time. Multiply that by twelve.",
    "Great institutions aren't built in the classroom alone - admin desks matter too.",
    "Here's hoping today's 'urgent' issues are actually urgent.",
    "You've survived every Monday so far. Today is no different.",
    "A well-organized notepad is the closest thing to a superpower you'll get today.",
    "Somewhere in this building, a fan needs fixing and everyone assumes you already know.",
    "Today's mission: keep the ship steady, one decision at a time. 🚢",
    "Remember - the best schools run on decisions nobody sees you make.",
    "If today gets loud, that's usually a sign things are actually working.",
    "Admins don't get report cards, but if they did, yours would say 'exceeds expectations'.",
    "Take a breath before the first knock on your door. It's coming. 😄",
];

function getCasualMessage() {
    const today = new Date();
    const day = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return CASUAL_MESSAGES[day % CASUAL_MESSAGES.length];
}

interface OverviewHeroProps {
    adminName: string;
    institutionName: string;
    institutionType: InstitutionType;
    adminDob?: string;
    institutionEstablishedOn?: string;
}

export function OverviewHero({ adminName, institutionName, institutionType, adminDob, institutionEstablishedOn }: OverviewHeroProps) {
    // Emoji/label still come from institution type, but the actual color now
    // follows whatever accent the admin picked in Settings (--hero-accent
    // already resolves per light/dark and per data-theme preset via the
    // cascade in globals.css) instead of a color hardcoded per institution type.
    const accent = getInstitutionAccent(institutionType);
    const heroColor = useThemeAccent('--hero-accent');
    const [currentChar, setCurrentChar] = useState(0);

    useEffect(() => {
        const iv = setInterval(() => setCurrentChar(p => (p + 1) % CHARACTERS.length), 7000);
        return () => clearInterval(iv);
    }, []);

    const [currentTime, setCurrentTime] = useState('');
    useEffect(() => {
        const fmt = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        setCurrentTime(fmt());
        const id = setInterval(() => setCurrentTime(fmt()), 1000);
        return () => clearInterval(id);
    }, []);

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    const isAdminBday = isTodayBirthday(adminDob ?? '');
    const isInstAnniversary = isTodayBirthday(institutionEstablishedOn ?? '');

    return (
        <div
            className="-mx-4 relative overflow-hidden rounded-b-[30px] sm:rounded-b-[45px] lg:rounded-b-[65px] px-5 sm:px-8 lg:px-13 py-5 flex items-center justify-between min-h-[160px]"
            style={{ background: heroColor }}
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
            <div className="space-y-1 z-10 min-w-0">
                <p className="text-white/70 text-sm sm:text-base">
                    {greeting} {accent.emoji},{' '}
                    <span className="relative inline-block">
                        {adminName}
                        <SillyStringOverlay name={adminName} fontSize={16} active={isAdminBday} />
                    </span>
                </p>
                <div className="relative">
                    <p className="text-white text-xl sm:text-2xl lg:text-3xl font-semibold" style={{ fontFamily: 'var(--font-poppins)' }}>
                        {institutionName}
                    </p>
                    <SillyStringOverlay name={institutionName} fontSize={30} active={isInstAnniversary} />
                </div>
                <p className="text-white/60 text-xs sm:text-sm">{getCasualMessage()}</p>
                <p className="text-white/50 text-xs mt-2">{dateStr}{currentTime && <span className="ml-2">·&nbsp; {currentTime}</span>}</p>
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