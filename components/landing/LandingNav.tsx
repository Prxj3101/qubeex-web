'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
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
                className={`relative flex w-full max-w-5xl items-center justify-between overflow-hidden rounded-2xl px-4 py-2.5 ring-1 ring-white/10 backdrop-blur-xl transition-all duration-500 sm:px-5 ${
                    scrolled
                        ? 'bg-[#190D2E]/95 shadow-[0_16px_48px_-16px_rgba(25,13,46,0.65)]'
                        : 'bg-[#190D2E]/85 shadow-[0_12px_36px_-16px_rgba(25,13,46,0.5)]'
                }`}
            >
                {/* subtle aurora inside the dark pill */}
                <div aria-hidden className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-10 -top-12 h-32 w-32 rounded-full bg-[#7C3AED]/35 blur-2xl" />
                    <div className="absolute -right-8 -bottom-14 h-32 w-40 rounded-full bg-[#DA7756]/25 blur-2xl" />
                </div>

                <a href="#top" className="relative flex items-center gap-2.5">
                    <Image
                        src="/QubeEx_darkmode_DA7756.png"
                        alt="QubeEx"
                        width={30}
                        height={35}
                        className="h-9 w-[30px] object-contain drop-shadow-[0_2px_8px_rgba(218,119,86,0.45)]"
                        priority
                    />
                    <span className="text-lg font-bold tracking-tight text-white">QubeEx</span>
                </a>

                <div className="relative hidden items-center gap-1 md:flex">
                    {LINKS.map((l) => (
                        <a
                            key={l.href}
                            href={l.href}
                            className="rounded-lg px-3.5 py-2 text-sm font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            {l.label}
                        </a>
                    ))}
                </div>

                <div className="relative flex items-center gap-2.5">
                    <Link
                        href="/login"
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        Login
                    </Link>
                    <button
                        onClick={onDemo}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#190D2E] shadow-[0_8px_20px_-8px_rgba(255,255,255,0.4)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
                    >
                        Request a Demo
                    </button>
                </div>
            </nav>
        </motion.header>
    );
}
