'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { FAQS } from './landing-data';
import { Reveal, SectionHead, EASE } from './motion';

export default function FAQ() {
    const [open, setOpen] = useState<number | null>(0);

    return (
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-28 px-6 py-24 sm:py-32">
            <SectionHead eyebrow="FAQ" title="Questions?? Answered!!" />

            <div className="mt-12 space-y-3">
                {FAQS.map((f, i) => {
                    const isOpen = open === i;
                    return (
                        <Reveal key={f.q} delay={i * 0.05}>
                            <div
                                className={`overflow-hidden rounded-2xl border transition-colors ${
                                    isOpen ? 'border-[#D9C9F8] bg-white shadow-[0_12px_32px_-20px_rgba(124,58,237,0.35)]' : 'border-[#ECE6F8] bg-white/70'
                                }`}
                            >
                                <button
                                    onClick={() => setOpen(isOpen ? null : i)}
                                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                                >
                                    <span className="text-[15px] font-semibold text-[#1D1433]">{f.q}</span>
                                    <motion.span
                                        animate={{ rotate: isOpen ? 45 : 0 }}
                                        transition={{ duration: 0.3, ease: EASE }}
                                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${isOpen ? 'bg-[#DA7756] text-white' : 'bg-[#FBEFEA] text-[#DA7756]'}`}
                                    >
                                        <Plus size={15} strokeWidth={2.5} />
                                    </motion.span>
                                </button>
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.35, ease: EASE }}
                                        >
                                            <p className="px-6 pb-5 text-sm leading-relaxed text-[#6B6480]">{f.a}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </Reveal>
                    );
                })}
            </div>
        </section>
    );
}
