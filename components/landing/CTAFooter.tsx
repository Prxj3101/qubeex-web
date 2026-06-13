'use client';

import Link from 'next/link';
import { ArrowRight, Box } from 'lucide-react';
import { Reveal, SplitWords, DISPLAY } from './motion';

export default function CTAFooter({ onDemo }: { onDemo: () => void }) {
    return (
        <>
            {/* CTA */}
            <section className="mx-auto max-w-5xl px-6 pb-24">
                <Reveal>
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-[#190D2E] px-8 py-16 text-center sm:px-16 sm:py-24">
                        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#7C3AED]/50 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-[#DA7756]/40 blur-3xl" />
                        <div
                            className="pointer-events-none absolute inset-0 opacity-20"
                            style={{
                                backgroundImage:
                                    'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
                                backgroundSize: '48px 48px',
                            }}
                        />
                        <div className="relative">
                            <h2 style={DISPLAY} className="text-balance text-4xl font-bold tracking-tight text-white sm:text-[3.6rem] sm:leading-[1.05]">
                                <SplitWords text="Ready to see your institution differently?" />
                            </h2>
                            <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-white/65">
                                Book a walkthrough and watch QubeEx run on your own school&apos;s structure — classes, fees and all.
                            </p>
                            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                                <button
                                    onClick={onDemo}
                                    className="group inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-sm font-semibold text-[#1D1433] shadow-[0_16px_36px_-12px_rgba(255,255,255,0.4)] transition-all hover:scale-[1.03] active:scale-[0.98]"
                                >
                                    Request a Demo
                                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                                </button>
                                <Link
                                    href="/login"
                                    className="inline-flex items-center rounded-2xl border border-white/20 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                                >
                                    Login
                                </Link>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* Footer */}
            <footer className="border-t border-[#E9E3F6] bg-white/60 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
                    <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#9F67F8] text-white">
                            <Box size={15} strokeWidth={2.2} />
                        </span>
                        <span className="font-bold text-[#1D1433]">QubeEx</span>
                        <span className="ml-2 hidden text-xs text-[#9A93AC] sm:inline">AI-Powered Student Assessment System</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-[#6B6480]">
                        <a href="#features" className="transition-colors hover:text-[#1D1433]">Features</a>
                        <a href="#pricing" className="transition-colors hover:text-[#1D1433]">Pricing</a>
                        <a href="#faq" className="transition-colors hover:text-[#1D1433]">FAQ</a>
                        <Link href="/login" className="transition-colors hover:text-[#1D1433]">Login</Link>
                    </div>
                    <p className="text-xs text-[#9A93AC]">© {new Date().getFullYear()} QubeEx. All rights reserved.</p>
                </div>
            </footer>
        </>
    );
}
