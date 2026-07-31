'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Reveal, SplitWords, DISPLAY } from './motion';

export default function CTAFooter({ onDemo }: { onDemo: () => void }) {
    return (
        <>
            {/* CTA */}
            <section className="mx-auto max-w-5xl px-6 pb-24">
                <Reveal>
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-[#1C1B22] px-8 py-16 text-center sm:px-16 sm:py-24">
                        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#71717A]/50 blur-3xl" />
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
                                Book a walkthrough and watch QubeEx run on your own institution&apos;s structure - classes, fees and all.
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
                    <div className="flex flex-col items-center sm:items-start">
                        <div className="flex items-center gap-1.5">
                            <Image src="/QubeEx_darkmode_DA7756.png" alt="QubeEx" width={28} height={33} className="h-8 w-7 object-contain" />
                            <span className="-mt-0.5 text-[20px] font-bold leading-tight text-[#374151]" style={{ fontFamily: 'var(--font-poppins)' }}>QubeEx</span>
                        </div>
                        <span className="-mt-1 pl-[34px] text-xs text-[#9A93AC] sm:self-start">An AI-Powered SAS Platform</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#6B6480]">
                        <a href="#features" className="transition-colors hover:text-[#1D1433]">Features</a>
                        <a href="#pricing" className="transition-colors hover:text-[#1D1433]">Pricing</a>
                        <a href="#faq" className="transition-colors hover:text-[#1D1433]">FAQ</a>
                        <Link href="/login" className="transition-colors hover:text-[#1D1433]">Login</Link>
                        {/* TODO: point to real pages once legal docs are ready (Privacy Policy, ToS, DPA) */}
                        <a href="#" className="transition-colors hover:text-[#1D1433]">Privacy Policy</a>
                        <a href="#" className="transition-colors hover:text-[#1D1433]">Terms of Service</a>
                    </div>
                    <p className="text-xs text-[#9A93AC]">© {new Date().getFullYear()} QubeEx · A Mynus Technologies LLP product</p>
                </div>
            </footer>
        </>
    );
}
