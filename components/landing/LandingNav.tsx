'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useSpring } from 'framer-motion';
import { EASE } from './motion';
import { SHOW_PRICING } from './landing-data';

/**
 * Logo + brand lockup — brand visibility is driven by the nav's scroll
 * progress line: once the line's edge crosses past the logo, the brand
 * slides out behind the logo (anticlockwise spin); when the line retreats
 * back behind the logo, the brand slides in (clockwise spin).
 */
function BrandLockup({ hidden, rot }: { hidden: boolean; rot: number }) {
    return (
        <a href="#top" className="relative flex items-center gap-1.5 overflow-hidden">
            <div className="relative z-10 shrink-0">
                <motion.div animate={{ rotate: rot }} transition={{ duration: 0.6, ease: 'easeInOut' }}>
                    <Image
                        src="/QubeEx_darkmode_DA7756.png"
                        alt="QubeEx"
                        width={30}
                        height={35}
                        className="h-9 w-[30px] object-contain"
                        priority
                    />
                </motion.div>
            </div>
            <motion.span
                initial={false}
                animate={{ x: hidden ? -100 : 0, opacity: hidden ? 0 : 1 }}
                transition={{ x: { duration: 0.5, ease: 'easeInOut' }, opacity: { duration: 0.35, ease: 'easeInOut' } }}
                className="relative z-0 -mt-[5px] leading-none text-[24px] font-bold text-[#FAE5D9]"
                style={{ fontFamily: 'var(--font-poppins)' }}
            >
                QubeEx
            </motion.span>
        </a>
    );
}

const LINKS = [
    { label: 'Features', href: '#features', id: 'features' },
    { label: 'Modules', href: '#modules', id: 'modules' },
    { label: 'Pricing', href: '#pricing', id: 'pricing' },
    { label: 'FAQ', href: '#faq', id: 'faq' },
].filter((l) => SHOW_PRICING || l.id !== 'pricing');

export default function LandingNav({ onDemo }: { onDemo: () => void }) {
    const [active, setActive] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);

    const { scrollYProgress } = useScroll();
    const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });

    // brand hides once the user reaches the Features section, shows again above it
    const [brandHidden, setBrandHidden] = useState(false);
    const [rot, setRot] = useState(0);
    const hiddenRef = useRef(false);

    useEffect(() => {
        const fn = () => {
            // scrollspy — last section whose top has crossed 40% of viewport
            let current: string | null = null;
            for (const l of LINKS) {
                const el = document.getElementById(l.id);
                if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) current = l.id;
            }
            setActive(current);

            // features (or beyond) reached → hide brand; back above it → show
            const crossed = current !== null;
            if (crossed !== hiddenRef.current) {
                hiddenRef.current = crossed;
                setBrandHidden(crossed);
                setRot((r) => (crossed ? r - 360 : r + 360));
            }
        };
        fn();
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);

    const indicator = hovered ?? active;

    return (
        <motion.header
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
        >
            <div className="relative w-full max-w-5xl rounded-full">
                <nav
                    style={{
                        boxShadow:
                            'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.35), 0 12px 28px -10px rgba(25,13,46,0.55), 0 32px 64px -20px rgba(25,13,46,0.4)',
                    }}
                    className="relative flex w-full items-center justify-between rounded-full bg-[#1C1B22]/95 px-4 py-2.5 backdrop-blur-xl sm:px-6"
                >
                    <BrandLockup hidden={brandHidden} rot={rot} />

                    <div className="relative hidden items-center md:flex" onMouseLeave={() => setHovered(null)}>
                        {LINKS.map((l) => {
                            const on = indicator === l.id;
                            return (
                                <a
                                    key={l.href}
                                    href={l.href}
                                    onMouseEnter={() => setHovered(l.id)}
                                    className="relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
                                >
                                    {on && (
                                        <motion.span
                                            layoutId="nav-indicator"
                                            className="absolute inset-0 rounded-full bg-white/10"
                                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                        />
                                    )}
                                    <span className={`relative transition-colors duration-200 ${on ? 'text-white' : 'text-white/60'}`}>
                                        {l.label}
                                    </span>
                                </a>
                            );
                        })}
                    </div>

                    <div className="relative flex items-center gap-1.5 sm:gap-2.5">
                        <Link
                            href="/login"
                            className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
                        >
                            Login
                        </Link>
                        <button
                            onClick={onDemo}
                            className="group relative overflow-hidden rounded-full bg-white px-2.5 py-1.5 text-xs font-bold text-[#190D2E] transition-transform hover:scale-[1.03] active:scale-[0.98] sm:px-4 sm:py-2 sm:text-sm"
                        >
                            {/* shimmer sweep */}
                            <motion.span
                                aria-hidden
                                className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#71717A]/20 to-transparent"
                                initial={{ x: '-150%' }}
                                animate={{ x: '400%' }}
                                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3.2, ease: 'easeInOut' }}
                            />
                            <span className="relative">Request a Demo</span>
                        </button>
                    </div>

                    {/* scroll progress line */}
                    <motion.div
                        aria-hidden
                        style={{ scaleX: progress }}
                        className="absolute inset-x-6 bottom-0 h-[2px] origin-left rounded-full bg-gradient-to-r from-[#71717A] via-[#8A8A93] to-[#DA7756]"
                    />
                </nav>
            </div>
        </motion.header>
    );
}
