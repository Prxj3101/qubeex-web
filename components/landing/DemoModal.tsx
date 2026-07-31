'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { EASE } from './motion';

const INPUT =
    'w-full rounded-xl border border-[#E4DCF7] bg-[#FBFAFE] px-4 py-3 text-sm text-[#1D1433] placeholder:text-[#9A93AC] outline-none transition-colors focus:border-[#7C3AED] focus:bg-white';

export default function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [sent, setSent] = useState(false);
    const [form, setForm] = useState({ name: '', institution: '', email: '', phone: '' });
    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((p) => ({ ...p, [k]: e.target.value }));

    const close = () => {
        onClose();
        // reset after exit animation
        setTimeout(() => {
            setSent(false);
            setForm({ name: '', institution: '', email: '', phone: '' });
        }, 350);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setSent(true); // TODO: wire to backend API when available
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="fixed inset-0 z-[100] grid place-items-center bg-[#1D1433]/40 px-4 backdrop-blur-sm"
                    onClick={close}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 32, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.97 }}
                        transition={{ duration: 0.4, ease: EASE }}
                        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#ECE6F8] bg-white p-8 shadow-[0_48px_96px_-32px_rgba(29,20,51,0.4)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#EDE9FE] blur-3xl" />
                        <button
                            onClick={close}
                            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[#9A93AC] transition-colors hover:bg-[#F1EBFD] hover:text-[#1D1433]"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>

                        {sent ? (
                            <div className="relative py-6 text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                                    className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#D1FAE5] text-[#047857]"
                                >
                                    <CheckCircle2 size={32} />
                                </motion.div>
                                <h3 className="mt-5 text-xl font-bold text-[#1D1433]">Request received!</h3>
                                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#6B6480]">
                                    Thanks, {form.name.split(' ')[0] || 'there'}. Our team will reach out within 24 hours to schedule your walkthrough.
                                </p>
                                <button
                                    onClick={close}
                                    className="mt-7 rounded-xl bg-[#1D1433] px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <h3 className="text-xl font-bold text-[#1D1433]">Request a demo</h3>
                                <p className="mt-1.5 text-sm text-[#6B6480]">
                                    See QubeEx running on your institution&apos;s structure - takes 20 minutes.
                                </p>
                                <form onSubmit={submit} className="mt-6 space-y-3.5">
                                    <input required value={form.name} onChange={set('name')} placeholder="Your name" className={INPUT} />
                                    <input required value={form.institution} onChange={set('institution')} placeholder="Institution name" className={INPUT} />
                                    <input required type="email" value={form.email} onChange={set('email')} placeholder="Work email" className={INPUT} />
                                    <input value={form.phone} onChange={set('phone')} placeholder="Phone (optional)" className={INPUT} />
                                    <button
                                        type="submit"
                                        className="mt-2 w-full rounded-xl bg-[#7C3AED] py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(124,58,237,0.6)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        Submit request
                                    </button>
                                </form>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
