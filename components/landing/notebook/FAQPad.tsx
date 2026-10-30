'use client';

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { FAQS } from '../landing-data';
import { DISPLAY, EASE } from '../motion';
import { HAND, INK, TERRA } from './paper';

// FAQ written on a spiral notepad lying on the page.
export default function FAQPad() {
    const [open, setOpen] = useState<number | null>(0);

    return (
        <section id="faq" className="relative scroll-mt-6">
            <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:px-10 lg:py-20">
                <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: EASE }}
                >
                    <p style={HAND} className="text-2xl text-[#8A6A5A] sm:text-3xl">hands up if you have a question,</p>
                    <h2 style={DISPLAY} className="mt-1 text-4xl font-bold tracking-[-0.02em] text-[#190D2E] sm:text-6xl">
                        Questions? <span style={{ color: TERRA }}>Answered.</span>
                    </h2>
                </motion.div>

                <motion.div
                    className="relative mt-14 rounded-[18px] border-2 bg-white pb-6 pt-10 shadow-[7px_8px_0_rgba(38,41,74,0.9)]"
                    style={{ borderColor: INK }}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: EASE }}
                >
                    {/* spiral rings */}
                    <div aria-hidden className="absolute -top-3.5 left-0 right-0 flex justify-around px-8">
                        {Array.from({ length: 12 }).map((_, k) => (
                            <span key={k} className="h-7 w-3 rounded-full border-2 bg-[#E9E5DC]" style={{ borderColor: INK }} />
                        ))}
                    </div>

                    <ol>
                        {FAQS.map((f, k) => {
                            const isOpen = open === k;
                            return (
                                <li key={f.q} className="border-b border-[#E7E2F2] last:border-b-0">
                                    <button
                                        onClick={() => setOpen(isOpen ? null : k)}
                                        className="flex w-full items-center gap-4 px-6 py-4 text-left sm:px-9"
                                        aria-expanded={isOpen}
                                    >
                                        <span style={{ ...HAND, color: TERRA }} className="w-8 shrink-0 text-2xl">Q{k + 1}.</span>
                                        <span className="flex-1 text-[16px] font-semibold text-[#190D2E] sm:text-[17px]">{f.q}</span>
                                        <motion.span
                                            animate={{ rotate: isOpen ? 45 : 0 }}
                                            transition={{ duration: 0.3, ease: EASE }}
                                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2"
                                            style={{ borderColor: INK, background: isOpen ? TERRA : '#FFFFFF', color: isOpen ? '#FFFFFF' : INK }}
                                        >
                                            <Plus size={15} strokeWidth={2.5} />
                                        </motion.span>
                                    </button>
                                    {/* CSS grid-rows open/close: the browser animates it natively,
                                        smoother than measuring height in JS on every frame */}
                                    <div
                                        className="grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', opacity: isOpen ? 1 : 0 }}
                                        aria-hidden={!isOpen}
                                    >
                                        <div className="overflow-hidden">
                                            <p className="pb-5 pl-[4.5rem] pr-6 text-[15px] leading-relaxed text-[#575C7A] sm:pl-[5.25rem] sm:pr-9">{f.a}</p>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </motion.div>
            </div>
        </section>
    );
}
