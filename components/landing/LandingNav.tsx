'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Box } from 'lucide-react';
import { EASE } from './motion';

const LINKS = [
    { label: 'Features', href: '#features' },
    { label: 'Modules', href: '#modules' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
];

export default function LandingNav({ onDemo }: { onDemo: () => void }) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 24);
        fn();
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);

    return (
        <motion.header
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
        >
            <nav
                className={`flex w-full max-w-5xl items-center justify-between rounded-2xl border px-4 py-2.5 transition-all duration-500 sm:px-6 ${
                    scrolled
                        ? 'border-[#E4DCF7] bg-white/80 shadow-[0_8px_32px_-12px_rgba(124,58,237,0.18)] backdrop-blur-xl'
                        : 'border-transparent bg-transparent'
                }`}
            >
                <a href="#top" className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#9F67F8] text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)]">
                        <Box size={18} strokeWidth={2.2} />
                    </span>
                    <span className="text-lg font-bold tracking-tight text-[#1D1433]">QubeEx</span>
                </a>

                <div className="hidden items-center gap-1 md:flex">
                    {LINKS.map((l) => (
                        <a
                            key={l.href}
                            href={l.href}
                            className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#6B6480] transition-colors hover:bg-[#F1EBFD] hover:text-[#1D1433]"
                        >
                            {l.label}
                        </a>
                    ))}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2.5">
                    <Link
                        href="/login"
                        className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#1D1433] transition-colors hover:bg-[#F1EBFD] sm:px-4 sm:py-2 sm:text-sm"
                    >
                        Login
                    </Link>
                    <button
                        onClick={onDemo}
                        className="rounded-xl bg-[#1D1433] px-2.5 py-1.5 text-xs font-semibold text-white shadow-[0_8px_20px_-8px_rgba(29,20,51,0.5)] transition-transform hover:scale-[1.03] active:scale-[0.98] sm:px-4 sm:py-2 sm:text-sm"
                    >
                        Request a Demo
                    </button>
                </div>
            </nav>
        </motion.header>
    );
}
