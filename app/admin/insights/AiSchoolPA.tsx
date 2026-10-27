'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Sparkles, RotateCcw, Copy, Check } from 'lucide-react';
import Lottie from 'lottie-react';
import api from '@/lib/api';
import { MiniMarkdown } from '@/lib/miniMarkdown';
import aiAssistantAnimation from '@/public/lottie/ai-assistant.json';

type ChatMessage = { role: 'user' | 'assistant'; content: string; ts: number };

function timeAgo(ts: number): string {
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 30) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
}

const SUGGESTIONS = [
    "📋 How's attendance looking this month?",
    "💰 What's our fee collection rate?",
    "👨‍👩‍👧 Which parents are disengaged?",
    "🤖 Who's using AI tools the most?",
];

// The PA only makes sense next to real institution data — Analytics, not
// Subscription/billing pages under the same /admin/insights layout.
const VISIBLE_PATH = '/admin/insights/analytics';

// Gap kept between the panel's bottom edge and the actual viewport bottom —
// the panel's height is never fixed, it's whatever's left of the screen
// below the button minus this, so it always fills down to (almost) the
// bottom and reflows automatically on window resize.
const BOTTOM_GAP_PX = 5;

// Chat history lives server-side (AiChatMessage, keyed to the logged-in
// user) so the same conversation follows the admin across devices/browsers —
// not tied to this one browser's localStorage.

export default function AiSchoolPA() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    // Greets on every page load (auto-dismisses after 5s) and re-shows on
    // hover — same bubble either way, just a different trigger for it.
    const [showGreeting, setShowGreeting] = useState(true);
    const [isHovering, setIsHovering] = useState(false);
    const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [confirmingClear, setConfirmingClear] = useState(false);

    // Anchored to the button's actual on-screen position (not its layout
    // parent) so switching to `fixed` positioning — needed for the panel to
    // span all the way to the viewport bottom regardless of where the button
    // sits in the page — still opens right where the button is. Recomputed
    // on every resize while open so resizing the window keeps it aligned
    // and re-stretches the height at the same time (no separate height calc
    // needed: a `fixed` box with both `top` and `bottom` set has its height
    // computed by the browser).
    useEffect(() => {
        if (!open) return;
        const updatePos = () => {
            const rect = buttonRef.current?.getBoundingClientRect();
            if (!rect) return;
            // Aligned with the button's top edge, opening to its left (not
            // below it) — same placement as before, just measured live.
            setPanelPos({ top: rect.top, right: window.innerWidth - rect.left + 8 });
        };
        updatePos();
        window.addEventListener('resize', updatePos);
        return () => window.removeEventListener('resize', updatePos);
    }, [open]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading]);

    // Opening the panel (including right after a refresh, when persisted
    // history has already loaded) should land on the newest message, not
    // wherever the scroll container happens to start — a fresh mount always
    // begins at the top, so this has to run separately from the effect
    // above (which only fires on message/loading changes, not on open).
    useEffect(() => {
        if (!open) return;
        // A single rAF fires before multi-line message content (and the
        // panel's own open animation) has finished laying out, so
        // scrollHeight read there is too small and the scroll lands short
        // of the real bottom. Retrying a few times over ~300ms — matching
        // roughly the panel's own open transition — catches it once layout
        // has actually settled.
        let count = 0;
        const id = setInterval(() => {
            const el = scrollRef.current;
            if (el) el.scrollTo({ top: el.scrollHeight });
            count++;
            if (count >= 6) clearInterval(id);
        }, 50);
        return () => clearInterval(id);
    }, [open]);

    // Chat survives refresh/close AND follows the admin across devices —
    // loaded once from the backend on mount rather than localStorage.
    useEffect(() => {
        let cancelled = false;
        api.get('/admin/insights/assistant/history')
            .then(res => {
                if (cancelled) return;
                const history: ChatMessage[] = res.data?.data?.messages ?? [];
                if (history.length > 0) setMessages(history);
            })
            .catch(() => { /* history is best-effort — chat still works without it */ });
        return () => { cancelled = true; };
    }, []);

    // Auto-dismiss the greeting bubble 5s after the page loads.
    useEffect(() => {
        const id = setTimeout(() => setShowGreeting(false), 5000);
        return () => clearTimeout(id);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    // Don't leave the "Clear all?" confirmation stuck open if the panel gets
    // closed mid-confirm.
    useEffect(() => {
        if (!open) setConfirmingClear(false);
    }, [open]);

    const handleClear = () => {
        setMessages([]);
        setConfirmingClear(false);
        api.delete('/admin/insights/assistant/history').catch(() => { /* best-effort */ });
    };

    if (pathname !== VISIBLE_PATH) return null;

    const runQuery = async (history: ChatMessage[]) => {
        setLoading(true);
        try {
            // Backend caps history at 20 messages — trim client-side too so a
            // long-running persisted chat never gets rejected outright.
            const res = await api.post('/admin/insights/assistant/ask', { messages: history.slice(-20).map(({ role, content }) => ({ role, content })) });
            const reply: string = res.data?.data?.reply || "Sorry, I couldn't work that out — try asking a different way.";
            setMessages(m => [...m, { role: 'assistant', content: reply, ts: Date.now() }]);
        } catch {
            setMessages(m => [...m, { role: 'assistant', content: "Something went wrong on my end — give it another try in a moment.", ts: Date.now() }]);
        } finally {
            setLoading(false);
        }
    };

    const send = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;
        const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed, ts: Date.now() }];
        setMessages(next);
        setInput('');
        await runQuery(next);
    };

    // Re-asks a given user message — doesn't touch anything already in the
    // chat, just re-sends its text as a brand new message at the end, same
    // as retyping and hitting send.
    const retry = async (userIndex: number) => {
        if (loading) return;
        const original = messages[userIndex];
        if (!original || original.role !== 'user') return;
        await send(original.content);
    };

    const copyMessage = (i: number, text: string) => {
        navigator.clipboard?.writeText(text).then(() => {
            setCopiedIndex(i);
            setTimeout(() => setCopiedIndex(c => (c === i ? null : c)), 1500);
        });
    };

    return (
        <div className="relative mr-4">
            {/* Floating launcher */}
            <motion.button
                ref={buttonRef}
                onClick={() => setOpen(o => !o)}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                aria-label="Jarvis"
                className="relative w-[41px] h-[41px] rounded-full flex items-center justify-center shrink-0 border border-white/10"
                style={{
                    background: 'radial-gradient(circle at 32% 28%, #3E3E3E 0%, #1E1E1E 45%, #060606 100%)',
                    boxShadow: `
                        0 8px 16px -4px rgba(0,0,0,0.5),
                        0 3px 6px rgba(0,0,0,0.35),
                        inset 0 2px 3px rgba(255,255,255,0.22),
                        inset 0 -4px 6px rgba(0,0,0,0.65)
                    `,
                }}
            >
                <div className="w-7 h-7 relative pointer-events-none">
                    <div className="absolute" style={{ width: '280%', height: '280%', top: '-90%', left: '-90%', filter: 'brightness(1.3) saturate(1.4) drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>
                        <Lottie animationData={aiAssistantAnimation} loop autoplay />
                    </div>
                </div>
                {!open && (
                    <motion.span
                        className="absolute inset-0 rounded-full"
                        style={{ border: '1.5px solid rgba(226,138,107,0.65)', boxShadow: '0 0 6px rgba(226,138,107,0.2)' }}
                        animate={{ scale: [1, 1.5], opacity: [0.65, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                    />
                )}
            </motion.button>

            <AnimatePresence>
                {!open && (showGreeting || isHovering) && (
                    <motion.div
                        initial={{ opacity: 0, x: 8, scale: 0.92 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 8, scale: 0.92 }}
                        transition={{ type: 'spring', bounce: 0.35, duration: 0.4 }}
                        className="absolute top-1/2 -translate-y-1/2 right-full mr-2.5 whitespace-nowrap px-3 py-2 rounded-2xl rounded-br-md text-[12px] text-white/90 pointer-events-none"
                        style={{
                            background: 'linear-gradient(180deg, rgba(30,24,22,0.98) 0%, rgba(18,14,13,0.98) 100%)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 8px 20px -6px rgba(0,0,0,0.5)',
                        }}
                    >
                        How can I help you today?
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0, x: 12, scale: 0.94 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 8, scale: 0.96 }}
                            transition={{ type: 'spring', bounce: 0.28, duration: 0.5 }}
                            style={{
                                transformOrigin: 'top right',
                                top: panelPos?.top ?? 0,
                                right: panelPos?.right ?? 0,
                                bottom: BOTTOM_GAP_PX,
                                visibility: panelPos ? 'visible' : 'hidden',
                            }}
                            className="fixed z-50 w-[440px] rounded-3xl overflow-hidden flex flex-col"
                        >
                        <div
                            className="w-full h-full flex flex-col relative"
                            style={{
                                background: '#000000',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 20px 60px -12px rgba(0,0,0,0.6)',
                            }}
                        >
                            {/* Header */}
                            <div className="relative flex items-center justify-between px-4 py-3 shrink-0" style={{ background: '#000000', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 relative pointer-events-none">
                                        <div className="absolute" style={{ width: '220%', height: '220%', top: '-60%', left: '-60%', filter: 'brightness(1.3) saturate(1.4) drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>
                                            <Lottie animationData={aiAssistantAnimation} loop autoplay />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[14px] font-semibold text-white leading-none">Jarvis</p>
                                        <p className="text-[11px] text-white/40 mt-0.5 flex items-center gap-1">
                                            Your AI school assistant
                                            <Sparkles size={11} />
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 relative">
                                    {messages.length > 0 && !confirmingClear && (
                                        <button onClick={() => setConfirmingClear(true)}
                                            title="Clear chat history"
                                            className="text-[10px] text-white/50 hover:text-red-400 transition-colors px-2 py-0.5 rounded-md hover:bg-white/10">
                                            Clear
                                        </button>
                                    )}
                                    {confirmingClear && (
                                        <div className="flex items-center gap-1 text-[10px]">
                                            <span className="text-white/50 mr-0.5">Clear all?</span>
                                            <button onClick={handleClear}
                                                className="text-red-400 hover:text-red-300 transition-colors px-1.5 py-0.5 rounded-md hover:bg-white/10 font-medium">
                                                Yes
                                            </button>
                                            <button onClick={() => setConfirmingClear(false)}
                                                className="text-white/50 hover:text-white transition-colors px-1.5 py-0.5 rounded-md hover:bg-white/10">
                                                No
                                            </button>
                                        </div>
                                    )}
                                    <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-4 space-y-3"
                                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
                                {messages.length === 0 && (
                                    <div className="h-full flex flex-col justify-center gap-3">
                                        <p className="text-[12px] text-white/50 text-center px-4 leading-relaxed">
                                            Ask me anything about this school — attendance, fees, parent engagement, staff AI usage.
                                        </p>
                                        <div className="flex flex-col gap-1.5">
                                            {SUGGESTIONS.map((s) => (
                                                <button key={s} onClick={() => send(s)}
                                                    className="text-left text-[12px] px-3 py-2 rounded-xl text-white/80 hover:text-white transition-colors"
                                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {messages.map((m, i) => (
                                    <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[85%] px-3 py-2 text-[12px] leading-relaxed ${m.role === 'user' ? 'rounded-2xl rounded-br-md text-[#3A322C]' : 'rounded-2xl rounded-bl-md text-white/85'}`}
                                            style={m.role === 'user'
                                                ? { background: '#E8CBB5' }
                                                : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {m.role === 'assistant' ? <MiniMarkdown text={m.content} /> : m.content}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1 px-1">
                                            <span className="text-[10px] text-white/30">{timeAgo(m.ts ?? Date.now())}</span>
                                            {m.role === 'user' && !loading && (
                                                <button onClick={() => retry(i)} title="Retry"
                                                    className="text-white/40 hover:text-white/80 transition-colors">
                                                    <RotateCcw size={12} />
                                                </button>
                                            )}
                                            <button onClick={() => copyMessage(i, m.content)} title="Copy"
                                                className="text-white/40 hover:text-white/80 transition-colors">
                                                {copiedIndex === i ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="rounded-2xl px-3.5 py-3 flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {[0, 1, 2].map(i => (
                                                <motion.span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }}
                                                    animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input */}
                            <div className="relative shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <div className="flex items-center gap-2 rounded-2xl px-3 py-1.5" style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.14)' }}>
                                    <input
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                                        placeholder="Ask about your school..."
                                        className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/35 py-1.5 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => send(input)}
                                        disabled={!input.trim() || loading}
                                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity"
                                        style={{ background: 'linear-gradient(135deg, #EC9B7E 0%, #DA7756 100%)' }}
                                    >
                                        <Send size={12} className="text-white" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
