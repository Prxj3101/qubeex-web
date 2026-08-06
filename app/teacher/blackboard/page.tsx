'use client';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import {
    Monitor, Upload, ChevronLeft, ChevronRight,
    Maximize2, Minimize2, X, Sparkles, MessageSquare,
    HelpCircle, Scan, Send, ZoomIn, ZoomOut,
    FolderOpen, ChevronDown, RotateCw, GripVertical, Pencil, Pen, Highlighter, Eraser, Undo2, Redo2,
    Loader2, RefreshCw, Check, ScanLine, Layers, CheckCircle2, Bot, Copy, ThumbsUp, ThumbsDown, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import api from '@/lib/api';
import { useTheme } from 'next-themes';

import dynamic from 'next/dynamic';

const Document = dynamic(() => import('react-pdf').then(m => m.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then(m => m.Page), { ssr: false });
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// Module-level cache — fetched once as soon as this file loads (not tied to any
// panel's mount/unmount), so whichever panel needs it first already has it
// in memory and can render it in the very same tick as everything else.
let scanLoadingAnimCache: object | null = null;
const scanLoadingAnimPromise: Promise<object | null> = typeof window !== 'undefined'
    ? fetch('/ai-scan-loading.json').then(res => res.json()).then(data => { scanLoadingAnimCache = data; return data; }).catch(() => null)
    : Promise.resolve(null);

function useScanLoadingAnim() {
    const [anim, setAnim] = useState<object | null>(scanLoadingAnimCache);
    useEffect(() => {
        if (anim) return;
        let cancelled = false;
        scanLoadingAnimPromise.then(data => { if (!cancelled && data) setAnim(data); });
        return () => { cancelled = true; };
    }, [anim]);
    return anim;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type AIMode = 'scan' | 'prompt' | 'quiz' | null;
type DocRenderer = 'pdf' | 'office-online' | 'office-local' | 'image' | 'unsupported';

function getRenderer(doc: { url: string; type: string }): DocRenderer {
    if (doc.type === 'application/pdf') return 'pdf';
    if (doc.type.startsWith('image/')) return 'image';
    const isOffice =
        doc.type.includes('powerpoint') || doc.type.includes('presentation') ||
        doc.type.includes('word') || doc.type.includes('document');
    if (isOffice) return doc.url.startsWith('blob:') ? 'office-local' : 'office-online';
    return 'unsupported';
}

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    answer: number;
}

interface ScanResult {
    topic: string;
    overview: string;
    keyPoints: string[];
    images: { url: string; caption: string }[];
}

function stripExtension(name: string) {
    return name.replace(/\.[^/.]+$/, '');
}

// The backend's aiScan/aiQuiz endpoints accept an optional `pageText` field
// (capped at 8000 chars server-side) to ground the AI in what's actually on
// the selected pages, instead of having it improvise from just the page
// numbers + instructions. We extract that text client-side via pdf.js, which
// react-pdf already loads for rendering — no extra dependency needed.
const PAGE_TEXT_CHAR_LIMIT = 7500;

async function extractPdfPageText(fileUrl: string, pages: number[]): Promise<string> {
    if (pages.length === 0) return '';
    const { pdfjs } = await import('react-pdf');
    const pdf = await pdfjs.getDocument(fileUrl).promise;
    const chunks: string[] = [];
    for (const pageNum of pages) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const text = content.items
            .map(item => ('str' in item ? item.str : ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (text) chunks.push(`[Page ${pageNum}]\n${text}`);
    }
    return chunks.join('\n\n').slice(0, PAGE_TEXT_CHAR_LIMIT);
}

// ── AI Scan Panel ─────────────────────────────────────────────────────────────
function AIScanPanel({
    onClose, docName, doc, totalPages, selectedPages, onTogglePage,
    onScanStart, onScanEnd, onNavigateToPage,
}: {
    onClose: () => void;
    docName?: string;
    doc: { url: string; type: string } | null;
    totalPages: number;
    selectedPages: number[];
    onTogglePage: (page: number) => void;
    onScanStart: () => void;
    onScanEnd: () => void;
    onNavigateToPage?: (page: number) => void;
}) {
    const [phase, setPhase] = useState<'input' | 'loading' | 'result'>('input');
    const [instructions, setInstructions] = useState('');
    const [result, setResult] = useState<ScanResult | null>(null);
    const loadingAnim = useScanLoadingAnim();
    const isPdf = doc?.type === 'application/pdf';
    const canScan = !doc ? false : isPdf ? selectedPages.length > 0 : true;

    const [showLoadingText, setShowLoadingText] = useState(false);
    useEffect(() => {
        if (phase !== 'loading') { setShowLoadingText(false); return; }
        const id = setTimeout(() => setShowLoadingText(true), 300);
        return () => clearTimeout(id);
    }, [phase]);

    const handleScan = async () => {
        if (!canScan) return;
        const sorted = [...selectedPages].sort((a, b) => a - b);
        // Just the page/document label — instructions are sent as their own field
        // below so the backend can treat them as explicit guidance rather than
        // having them buried (and easy to ignore) inside a single topic string.
        const topic = sorted.length > 0 ? `Pages ${sorted.join(', ')}` : (docName ? stripExtension(docName) : instructions.trim());
        if (!topic.trim()) return;
        setPhase('loading');
        onScanStart();

        const minDelay = new Promise(resolve => setTimeout(resolve, 5000));

        try {
            // Ground the scan in what's actually on the selected pages instead of
            // having the AI guess from just the page numbers + instructions.
            let pageText = '';
            if (isPdf && sorted.length > 0) {
                try {
                    pageText = await extractPdfPageText(doc!.url, sorted);
                } catch (extractErr) {
                    // Extraction failure (e.g. scanned/image-only PDF with no text
                    // layer, or a CORS-blocked file host) — fall back to the
                    // topic-only request rather than blocking the scan entirely.
                    console.error('[AI Scan] PDF text extraction failed, falling back to topic-only:', extractErr);
                }
            }
            // Instructions are sent as their own field regardless of whether page
            // text extraction succeeded — previously this was only sent alongside
            // pageText, so a failed/empty extraction silently dropped whatever the
            // teacher typed in the Instructions box.
            const [res] = await Promise.all([
                api.post('/teacher/blackboard/ai/scan', {
                    topic: topic.trim(),
                    ...(pageText ? { pageText } : {}),
                    ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
                }),
                minDelay,
            ]);
            setResult(res.data.data);
            setPhase('result');
        } catch (err: any) {
            await minDelay;
            toast.error(err.response?.status === 429
                ? 'Monthly AI token limit reached'
                : 'Scan failed. Please try again.');
            setPhase('input');
        } finally {
            onScanEnd();
        }
    };

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="w-full h-full flex flex-col overflow-hidden relative" style={{ background: '#000' }}>
            {/* Persistently-mounted Lottie — kept alive across phase changes so
                lottie-react never has to re-parse the (large) animation JSON on
                every scan, which was causing a visible stutter after the first run. */}
            {loadingAnim && (
                <div className={`absolute inset-x-0 bottom-0 z-40 flex items-center justify-center transition-opacity duration-150 ${phase === 'loading' ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    style={{ background: '#000', top: '45px', opacity: phase === 'loading' ? 1 : 0 }}>
                    <div className="relative" style={{ width: 118, height: 66.4 }}>
                        <Lottie animationData={loadingAnim} loop autoplay style={{ width: 118, height: 66.4 }} />
                        {showLoadingText && (
                            <p className="absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap text-sm text-white/50">
                                Scanning selected pages...
                            </p>
                        )}
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ background: '#000' }}>
                <p className="text-sm font-bold flex items-center gap-2 text-white">
                    <ScanLine size={14} style={{ color: '#DA7756' }} /> AI Scan
                </p>
                <div className="flex items-center gap-2">
                    {phase === 'result' && (
                        <button
                            onClick={() => setPhase('input')}
                            className="h-6 px-2 rounded-lg text-[10.5px] font-medium text-white/60 border border-white/15 hover:bg-white/10 transition-all flex items-center gap-1">
                            <RefreshCw size={10} /> Scan Again
                        </button>
                    )}
                    <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {phase === 'input' && (
                <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#000' }}>
                    {isPdf && totalPages > 0 && (
                        <div className="shrink-0 px-4 pt-2 pb-2" style={{ background: '#000' }}>
                            <p className="text-xs font-bold mb-1 text-white flex items-center gap-1.5">
                                <CheckCircle2 size={12} style={{ color: '#DA7756' }} /> Selected Pages
                            </p>
                            <p className="text-[11px] text-white/60">
                                Use the page nav on the left to select the pages, they&apos;ll show up here.
                            </p>
                        </div>
                    )}

                    {/* Scrollable page picker */}
                    <div className="flex-1 overflow-hidden pr-1" style={{ background: '#000' }}>
                        <div className="h-full overflow-y-auto pl-4 pr-2 pt-1 pb-4" style={{ background: '#000', scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                            {isPdf && totalPages > 0 ? (
                                selectedPages.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-white/20 py-6 flex flex-col items-center gap-1.5">
                                        <Scan size={16} className="text-white/30" />
                                        <p className="text-[11px] text-white/40">No pages selected yet</p>
                                    </div>
                                ) : (
                                    <Document file={doc!.url} loading={null}>
                                        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 220px)' }}>
                                            {[...selectedPages].sort((a, b) => a - b).map(pageNum => (
                                                <div key={pageNum}
                                                    onClick={() => onNavigateToPage?.(pageNum)}
                                                    className="relative rounded-lg overflow-hidden border-2 w-fit leading-[0] cursor-pointer hover:opacity-90 transition-opacity"
                                                    style={{ borderColor: '#DA7756' }}
                                                    title="Go to this page">
                                                    <Page pageNumber={pageNum} width={220} renderTextLayer={false} renderAnnotationLayer={false} />
                                                    <span className="absolute bottom-0 inset-x-0 text-[10px] text-center py-1 text-white"
                                                        style={{ background: '#DA7756' }}>
                                                        {pageNum}
                                                    </span>
                                                    <button onClick={(e) => { e.stopPropagation(); onTogglePage(pageNum); }}
                                                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center hover:bg-black transition-all">
                                                        <X size={11} className="text-white" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </Document>
                                )
                            ) : !doc ? (
                                <div className="rounded-xl border border-dashed border-white/20 py-6 flex flex-col items-center gap-1.5">
                                    <ScanLine size={16} className="text-white/30" />
                                    <p className="text-[11px] text-white/40 text-center px-4">Load a document on the blackboard to start scanning</p>
                                </div>
                            ) : (
                                <p className="text-[11px] text-white/50 pt-4">
                                    Page selection isn&apos;t available for this document type — the whole document will be scanned.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Sticky footer — instructions + scan button never scroll */}
                    <div className="shrink-0 px-4 pt-3 pb-4 border-t border-white/10 flex flex-col gap-3 mb-7" style={{ background: '#000' }}>
                        <div>
                            <p className="text-[11px] text-white/50 mb-1.5">Instructions (optional)</p>
                            <textarea
                                value={instructions}
                                onChange={e => setInstructions(e.target.value)}
                                placeholder="e.g. Show diagrams of the water cycle stages"
                                rows={1}
                                className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-primary/50 placeholder:text-white/30 resize-none"
                            />
                        </div>

                        <button
                            onClick={handleScan}
                            disabled={!canScan}
                            className="w-full h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Sparkles size={12} className="inline mr-1.5 -mt-0.5" />
                            {!doc ? 'Load a Document First' : isPdf && totalPages > 0 ? 'Scan Selected Pages' : 'Scan Document'}
                        </button>
                    </div>
                </div>
            )}

            {phase === 'result' && result && (
                <div className="flex-1 overflow-y-auto px-4 pt-3 pb-10 space-y-3" style={{ background: '#000' }}>
                    {/* Topic */}
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                        <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">Detected Topic</p>
                        <p className="text-sm font-bold text-white">{result.topic}</p>
                    </div>

                    {/* Overview */}
                    <div>
                        <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1.5">Overview</p>
                        <p className="text-xs text-white/70 leading-relaxed">{result.overview}</p>
                    </div>

                    {/* Key Points */}
                    {result.keyPoints.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1.5">Key Points</p>
                            <div className="space-y-1">
                                {result.keyPoints.map((point, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                                        <p className="text-xs text-white/80">{point}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Images */}
                    {result.images.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-1.5">Related Images</p>
                            <div className="space-y-2">
                                {result.images.map((img, i) => (
                                    <div key={i} className="rounded-xl overflow-hidden border border-white/10">
                                        <img src={img.url} alt={img.caption} className="w-full object-cover" />
                                        <p className="text-[10px] text-white/60 text-center py-1.5 bg-white/5">{img.caption}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
}

// ── Chat persistence helpers ──────────────────────────────────────────────────
const CHAT_STORAGE_KEY = 'blackboard_chat_v1';
const CHAT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type ChatMessage = { role: 'user' | 'ai'; text: string; streaming?: boolean; timestamp?: number };

// Reveals `text` word-by-word like a typewriter, then calls onDone once fully shown.
function StreamingText({ text, onDone, onUpdate }: { text: string; onDone: () => void; onUpdate?: () => void }) {
    const [shown, setShown] = useState('');
    useEffect(() => {
        const words = text.split(' ');
        let i = 0;
        setShown('');
        const id = setInterval(() => {
            i++;
            setShown(words.slice(0, i).join(' '));
            onUpdate?.();
            if (i >= words.length) {
                clearInterval(id);
                onDone();
            }
        }, 45);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);
    return <>{shown}</>;
}

function loadPersistedChat(): { messages: ChatMessage[]; savedAt: Date } | null {
    try {
        const raw = localStorage.getItem(CHAT_STORAGE_KEY);
        if (!raw) return null;
        const { messages, savedAt } = JSON.parse(raw) as { messages: ChatMessage[]; savedAt: number };
        if (Date.now() - savedAt > CHAT_TTL_MS) {
            localStorage.removeItem(CHAT_STORAGE_KEY);
            return null;
        }
        return { messages, savedAt: new Date(savedAt) };
    } catch {
        return null;
    }
}

function persistChat(messages: ChatMessage[]) {
    try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages, savedAt: Date.now() }));
    } catch {}
}

function clearPersistedChat() {
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch {}
}

const WELCOME_MESSAGE: ChatMessage = {
    role: 'ai',
    text: 'Hello! Ask me anything about your current topic. I can help with explanations, definitions, examples, and more.',
};

// ── AI Prompt Panel ───────────────────────────────────────────────────────────
const THINKING_WORDS = ['Thinking', 'Working on it', 'Analyzing', 'Reasoning', 'Putting it together'];

function AIPromptPanel({ onClose, context }: { onClose: () => void; context?: string }) {
    const [input, setInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [restoredAt, setRestoredAt] = useState<Date | null>(null);
    const [thinkingWordIdx, setThinkingWordIdx] = useState(0);
    const [showThinkingText, setShowThinkingText] = useState(false);
    const loadingAnim = useScanLoadingAnim();
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<Record<number, 'up' | 'down'>>({});

    const handleCopy = (idx: number, text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIdx(idx);
            setTimeout(() => setCopiedIdx(prev => (prev === idx ? null : prev)), 1500);
        });
    };

    useEffect(() => {
        if (!aiLoading) { setShowThinkingText(false); return; }
        const id = setTimeout(() => setShowThinkingText(true), 300);
        return () => clearTimeout(id);
    }, [aiLoading]);

    const chatInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (!aiLoading) chatInputRef.current?.focus();
    }, [aiLoading]);

    useEffect(() => {
        if (!aiLoading) { setThinkingWordIdx(0); return; }
        let timeoutId: NodeJS.Timeout;
        const scheduleNext = () => {
            // Random delay each time (3s–20s) so the cadence never feels patterned.
            const delay = 3000 + Math.random() * 17000;
            timeoutId = setTimeout(() => {
                setThinkingWordIdx(prev => {
                    // Pick a random word, avoiding an immediate repeat of the same one.
                    let next = Math.floor(Math.random() * THINKING_WORDS.length);
                    if (THINKING_WORDS.length > 1 && next === prev) {
                        next = (next + 1 + Math.floor(Math.random() * (THINKING_WORDS.length - 1))) % THINKING_WORDS.length;
                    }
                    return next;
                });
                scheduleNext();
            }, delay);
        };
        scheduleNext();
        return () => clearTimeout(timeoutId);
    }, [aiLoading]);

    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        const stored = loadPersistedChat();
        if (stored && stored.messages.length > 0) {
            setRestoredAt(stored.savedAt);
            return stored.messages;
        }
        return [WELCOME_MESSAGE];
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Persist whenever messages change (skip the initial welcome-only state)
    useEffect(() => {
        if (messages.length > 1 || (messages.length === 1 && messages[0] !== WELCOME_MESSAGE)) {
            persistChat(messages);
        }
    }, [messages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, aiLoading, loadingAnim, thinkingWordIdx]);

    const handleClear = () => {
        clearPersistedChat();
        setMessages([WELCOME_MESSAGE]);
        setRestoredAt(null);
    };

    const handleSend = async () => {
        if (!input.trim() || aiLoading) return;
        const userText = input.trim();
        setInput('');

        const updatedMessages = [...messages, { role: 'user' as const, text: userText, timestamp: Date.now() }];
        setMessages(updatedMessages);
        setAiLoading(true);

        const minDelay = new Promise(resolve => setTimeout(resolve, 3000));

        try {
            // Send conversation history (skip the initial welcome message at index 0)
            const apiMessages = updatedMessages.slice(1).map(m => ({
                role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
                content: m.text,
            }));

            const [res] = await Promise.all([
                api.post('/teacher/blackboard/ai/chat', {
                    messages: apiMessages,
                    ...(context ? { context } : {}),
                }),
                minDelay,
            ]);

            setMessages(prev => [...prev, { role: 'ai', text: res.data.data.reply, streaming: true, timestamp: Date.now() }]);
        } catch (err: any) {
            await minDelay;
            const errText = err.response?.status === 429
                ? 'Monthly AI token limit reached. Contact your administrator.'
                : 'Failed to get a response. Please try again.';
            setMessages(prev => [...prev, { role: 'ai', text: errText, streaming: true, timestamp: Date.now() }]);
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="w-full h-full flex flex-col overflow-hidden" style={{ background: '#000' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ background: '#000' }}>
                <p className="text-sm font-bold flex items-center gap-2 text-white">
                    <Bot size={18} style={{ color: '#DA7756' }} /> AI Prompt
                </p>
                <div className="flex items-center gap-1.5">
                    {messages.length > 1 && (
                        <button onClick={handleClear}
                            title="Clear chat history"
                            className="text-[10px] text-white/50 hover:text-red-400 transition-colors px-2 py-0.5 rounded-md hover:bg-white/10">
                            Clear
                        </button>
                    )}
                    <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Restored banner */}
            {restoredAt && (
                <div className="px-4 py-1.5 border-b border-white/10 flex items-center justify-between" style={{ background: 'rgba(218,119,86,0.08)' }}>
                    <p className="text-[10px]" style={{ color: 'rgba(218,119,86,0.8)' }}>
                        Restored from {restoredAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                    <button onClick={handleClear} className="text-[10px] text-white/50 hover:text-red-400 transition-colors">
                        Clear
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 min-h-0"
                style={{ background: '#000', scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                {messages.map((msg, i) => (
                    <div key={i} className={`group flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {msg.timestamp && (
                            <span className={`text-[10px] text-white/30 opacity-0 group-hover:opacity-100 transition-opacity px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                        )}
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${msg.role === 'user'
                            ? 'text-white rounded-br-sm'
                            : 'text-white/85 rounded-bl-sm'
                            }`}
                            style={msg.role === 'user'
                                ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }
                                : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {msg.role === 'ai' && msg.streaming ? (
                                <StreamingText text={msg.text}
                                    onUpdate={() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })}
                                    onDone={() => {
                                        setMessages(prev => prev.map((m, mi) => mi === i ? { ...m, streaming: false } : m));
                                    }} />
                            ) : msg.text}
                        </div>
                        {msg.role === 'ai' && !msg.streaming && msg !== WELCOME_MESSAGE && (
                            <div className="flex items-center gap-0 pl-1">
                                <button onClick={() => handleCopy(i, msg.text)} title="Copy"
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                                    {copiedIdx === i ? <Check size={14} className="text-green-400 block" strokeWidth={2.5} style={{ display: 'block' }} /> : <Copy size={14} className="block" strokeWidth={2.5} style={{ display: 'block' }} />}
                                </button>
                                <button onClick={() => setFeedback(prev => ({ ...prev, [i]: prev[i] === 'up' ? undefined as any : 'up' }))}
                                    title="Good response"
                                    className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                                    style={feedback[i] === 'up' ? { color: '#DA7756', background: 'rgba(218,119,86,0.15)' } : {}}>
                                    <ThumbsUp size={14} strokeWidth={2.5} className={`block ${feedback[i] === 'up' ? '' : 'text-white/40'}`} style={{ display: 'block' }} />
                                </button>
                                <button onClick={() => setFeedback(prev => ({ ...prev, [i]: prev[i] === 'down' ? undefined as any : 'down' }))}
                                    title="Bad response"
                                    className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                                    style={feedback[i] === 'down' ? { color: '#DA7756', background: 'rgba(218,119,86,0.15)' } : {}}>
                                    <ThumbsDown size={14} strokeWidth={2.5} className={`block ${feedback[i] === 'down' ? '' : 'text-white/40'}`} style={{ display: 'block' }} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {aiLoading && (
                    <div className="flex items-center gap-0 justify-start">
                        {loadingAnim && (
                            <Lottie animationData={loadingAnim} loop autoplay style={{ width: 69.5, height: 39.1, marginLeft: '-8px' }} />
                        )}
                        {showThinkingText && (
                            <AnimatePresence mode="wait">
                                <motion.span key={thinkingWordIdx}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.25 }}
                                    className="text-xs font-medium -ml-1 translate-y-[3px]"
                                    style={{ color: '#DA7756' }}>
                                    {THINKING_WORDS[thinkingWordIdx]}...
                                </motion.span>
                            </AnimatePresence>
                        )}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="border-t border-white/10 px-3 py-2.5 flex items-center gap-2" style={{ background: '#000' }}>
                <input ref={chatInputRef} value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="Ask anything..."
                    disabled={aiLoading}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-primary/50 placeholder:text-white/30 disabled:opacity-60" />
                <button onClick={handleSend} disabled={!input.trim() || aiLoading}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                    <Send size={14} />
                </button>
            </div>
        </motion.div>
    );
}

// ── AI Quiz Panel ─────────────────────────────────────────────────────────────
function AIQuizPanel({
    onClose, docName, doc, totalPages, selectedPages, onTogglePage, onNavigateToPage,
}: {
    onClose: () => void;
    docName?: string;
    doc: { url: string; type: string } | null;
    totalPages: number;
    selectedPages: number[];
    onTogglePage: (page: number) => void;
    onNavigateToPage?: (page: number) => void;
}) {
    const [phase, setPhase] = useState<'input' | 'loading' | 'result'>('input');
    const [instructions, setInstructions] = useState('');
    const [count, setCount] = useState(5);
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentQ, setCurrentQ] = useState(0);
    // Per-question answer state, keyed by question index — so navigating
    // Prev/Next preserves what was already selected/revealed for each question.
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [revealedMap, setRevealedMap] = useState<Record<number, boolean>>({});
    const selectedOption = answers[currentQ] ?? null;
    const revealed = revealedMap[currentQ] ?? false;
    const loadingAnim = useScanLoadingAnim();

    const [showLoadingText, setShowLoadingText] = useState(false);
    useEffect(() => {
        if (phase !== 'loading') { setShowLoadingText(false); return; }
        const id = setTimeout(() => setShowLoadingText(true), 300);
        return () => clearTimeout(id);
    }, [phase]);

    const isPdf = doc?.type === 'application/pdf';
    const canGenerate = !doc ? false : isPdf ? selectedPages.length > 0 : true;

    const handleGenerate = async () => {
        if (!canGenerate) return;
        const sorted = [...selectedPages].sort((a, b) => a - b);
        const pagesLabel = sorted.length > 0 ? `Pages ${sorted.join(', ')}` : (docName ? stripExtension(docName) : '');
        const topic = [pagesLabel, instructions.trim()].filter(Boolean).join(' — ');
        if (!topic.trim()) return;
        setPhase('loading');

        const minDelay = new Promise(resolve => setTimeout(resolve, 5000));

        try {
            // Ground the quiz in what's actually on the selected pages instead of
            // having the AI guess from just the page numbers + instructions.
            let pageText = '';
            if (isPdf && sorted.length > 0) {
                try {
                    pageText = await extractPdfPageText(doc!.url, sorted);
                } catch {
                    // Extraction failure (e.g. scanned/image-only PDF with no text
                    // layer) — fall back to the topic-only request rather than blocking.
                }
            }
            const [res] = await Promise.all([
                api.post('/teacher/blackboard/ai/quiz', { topic: topic.trim(), count, difficulty, ...(pageText ? { pageText } : {}) }),
                minDelay,
            ]);
            setQuestions(res.data.data.questions);
            setCurrentQ(0);
            setAnswers({});
            setRevealedMap({});
            setPhase('result');
        } catch (err: any) {
            await minDelay;
            toast.error(err.response?.status === 429
                ? 'Monthly AI token limit reached'
                : 'Quiz generation failed. Please try again.');
            setPhase('input');
        }
    };

    const q = questions[currentQ];

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="w-full h-full flex flex-col overflow-hidden relative" style={{ background: '#000' }}>
            {/* Persistently-mounted Lottie — kept alive across phase changes so
                lottie-react never has to re-parse the (large) animation JSON on
                every generation, which was causing a visible stutter after the first run. */}
            {loadingAnim && (
                <div className={`absolute inset-x-0 bottom-0 z-40 flex items-center justify-center transition-opacity duration-150 ${phase === 'loading' ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    style={{ background: '#000', top: '45px', opacity: phase === 'loading' ? 1 : 0 }}>
                    <div className="relative" style={{ width: 118, height: 66.4 }}>
                        <Lottie animationData={loadingAnim} loop autoplay style={{ width: 118, height: 66.4 }} />
                        {showLoadingText && (
                            <p className="absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap text-sm text-white/50">
                                Generating {count} questions...
                            </p>
                        )}
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ background: '#000' }}>
                <p className="text-sm font-bold flex items-center gap-2 text-white">
                    <HelpCircle size={14} style={{ color: '#DA7756' }} /> AI Quiz
                    <span className="text-[9px] font-semibold italic px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                        <Zap size={9} className="fill-current" />
                        2 mins
                    </span>
                </p>
                <div className="flex items-center gap-2">
                    {phase === 'result' && (
                        <>
                            <span className="text-[11px] text-white/50">{currentQ + 1}/{questions.length}</span>
                            <button
                                onClick={() => setPhase('input')}
                                className="h-6 px-2 rounded-lg text-[10.5px] font-medium text-white/60 border border-white/15 hover:bg-white/10 transition-all flex items-center gap-1">
                                <RefreshCw size={10} /> New Quiz
                            </button>
                        </>
                    )}
                    <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {phase === 'input' && (
                <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#000' }}>
                    {isPdf && totalPages > 0 && (
                        <div className="shrink-0 px-4 pt-2 pb-2" style={{ background: '#000' }}>
                            <p className="text-xs font-bold mb-1 text-white flex items-center gap-1.5">
                                <CheckCircle2 size={12} style={{ color: '#DA7756' }} /> Selected Pages
                            </p>
                            <p className="text-[11px] text-white/60">
                                Use the page nav on the left to select the pages, they&apos;ll show up here.
                            </p>
                        </div>
                    )}

                    {/* Scrollable page picker */}
                    <div className="flex-1 overflow-hidden pr-1" style={{ background: '#000' }}>
                        <div className="h-full overflow-y-auto pl-4 pr-2 pt-1 pb-4"
                            style={{ background: '#000', scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}>
                            {isPdf && totalPages > 0 ? (
                                selectedPages.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-white/20 py-6 flex flex-col items-center gap-1.5">
                                        <HelpCircle size={16} className="text-white/30" />
                                        <p className="text-[11px] text-white/40">No pages selected yet</p>
                                    </div>
                                ) : (
                                    <Document file={doc!.url} loading={null}>
                                        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 220px)' }}>
                                            {[...selectedPages].sort((a, b) => a - b).map(pageNum => (
                                                <div key={pageNum}
                                                    onClick={() => onNavigateToPage?.(pageNum)}
                                                    className="relative rounded-lg overflow-hidden border-2 w-fit leading-[0] cursor-pointer hover:opacity-90 transition-opacity"
                                                    style={{ borderColor: '#DA7756' }}
                                                    title="Go to this page">
                                                    <Page pageNumber={pageNum} width={220} renderTextLayer={false} renderAnnotationLayer={false} />
                                                    <span className="absolute bottom-0 inset-x-0 text-[10px] text-center py-1 text-white"
                                                        style={{ background: '#DA7756' }}>
                                                        {pageNum}
                                                    </span>
                                                    <button onClick={(e) => { e.stopPropagation(); onTogglePage(pageNum); }}
                                                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center hover:bg-black transition-all">
                                                        <X size={11} className="text-white" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </Document>
                                )
                            ) : !doc ? (
                                <div className="rounded-xl border border-dashed border-white/20 py-6 flex flex-col items-center gap-1.5">
                                    <HelpCircle size={16} className="text-white/30" />
                                    <p className="text-[11px] text-white/40 text-center px-4">Load a document on the blackboard to start</p>
                                </div>
                            ) : (
                                <p className="text-[11px] text-white/50 pt-4">
                                    Page selection isn&apos;t available for this document type — the whole document will be used.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Sticky footer — instructions, question count, difficulty & generate button */}
                    <div className="shrink-0 px-4 pt-3 pb-4 border-t border-white/10 flex flex-col gap-3 mb-7" style={{ background: '#000' }}>
                        <div className="-mb-2.5">
                            <p className="text-[11px] text-white/50 mb-1.5">Instructions (optional)</p>
                            <textarea
                                value={instructions}
                                onChange={e => setInstructions(e.target.value)}
                                placeholder="e.g. Focus on definitions and key dates"
                                rows={1}
                                className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-primary/50 placeholder:text-white/30 resize-none"
                            />
                        </div>

                        <div className="border-t border-white/10 -mb-2" />

                        <div className="space-y-1.5 -mb-2.5">
                            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">
                                Questions: <span style={{ color: '#DA7756' }}>{count}</span>
                            </label>
                            <input type="range" min={1} max={10} value={count}
                                onChange={e => setCount(Number(e.target.value))}
                                className="w-full h-1 cursor-pointer" style={{ accentColor: '#DA7756' }} />
                            <div className="flex justify-between text-[10px] text-white/30">
                                <span>1</span><span>10</span>
                            </div>
                        </div>

                        <div className="border-t border-white/10 -mb-2" />

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">Difficulty</label>
                            <div className="flex gap-2">
                                {([
                                    { key: 'easy' as const, color: '#10B981' },
                                    { key: 'medium' as const, color: '#F59E0B' },
                                    { key: 'hard' as const, color: '#EF4444' },
                                ]).map(({ key: d, color }) => {
                                    const isActive = difficulty === d;
                                    return (
                                        <button key={d} onClick={() => setDifficulty(d)}
                                            className="flex-1 py-2 rounded-xl text-[11px] font-semibold capitalize flex flex-col items-center gap-1 transition-all"
                                            style={isActive
                                                ? { background: `${color}26`, border: `1px solid ${color}80`, color }
                                                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                                            <span className="w-1.5 h-1.5 rounded-full transition-all"
                                                style={{ background: isActive ? color : 'rgba(255,255,255,0.25)' }} />
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={!canGenerate}
                            className="w-full h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                            <Sparkles size={12} className="inline mr-1.5 -mt-0.5" />
                            {!doc ? 'Load a Document First' : isPdf && totalPages > 0 ? 'Generate Quiz from Selected Pages' : 'Generate Quiz'}
                        </button>
                    </div>
                </div>
            )}


            {phase === 'result' && q && (
                <>
                    <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto" style={{ background: '#000' }}>
                        {/* Question */}
                        <div className="p-3 rounded-xl" style={{ background: 'rgba(218,119,86,0.08)', border: '1px solid rgba(218,119,86,0.25)' }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#DA7756' }}>Question {currentQ + 1}</p>
                            <p className="text-sm font-semibold leading-relaxed text-white">{q.question}</p>
                        </div>

                        {/* Options */}
                        <div className="space-y-1.5">
                            {q.options.map((opt, i) => {
                                const isCorrect = i === q.answer;
                                const isSelected = i === selectedOption;
                                let style: React.CSSProperties;
                                if (revealed) {
                                    style = isCorrect
                                        ? { background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.5)', color: '#34D399' }
                                        : isSelected
                                            ? { background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.5)', color: '#F87171' }
                                            : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' };
                                } else {
                                    style = isSelected
                                        ? { background: 'rgba(218,119,86,0.15)', borderColor: '#DA7756', color: '#fff' }
                                        : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' };
                                }
                                return (
                                    <button key={i}
                                        onClick={() => !revealed && setAnswers(prev => ({ ...prev, [currentQ]: i }))}
                                        disabled={revealed}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-left"
                                        style={style}>
                                        <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0">
                                            {String.fromCharCode(65 + i)}
                                        </span>
                                        {opt}
                                        {revealed && isCorrect && <Check size={13} className="ml-auto shrink-0" strokeWidth={3} />}
                                        {revealed && !isCorrect && isSelected && <X size={13} className="ml-auto shrink-0" strokeWidth={3} />}
                                    </button>
                                );
                            })}
                        </div>

                        {revealed && (
                            <div className="p-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold"
                                style={selectedOption === q.answer
                                    ? { background: 'rgba(16,185,129,0.1)', color: '#34D399' }
                                    : { background: 'rgba(239,68,68,0.1)', color: '#F87171' }}>
                                {selectedOption === q.answer ? (
                                    <><Check size={13} strokeWidth={3} /> Correct!</>
                                ) : (
                                    <><X size={13} strokeWidth={3} /> Incorrect — correct answer is {String.fromCharCode(65 + q.answer)}. {q.options[q.answer]}</>
                                )}
                            </div>
                        )}

                        {!revealed && (
                            <button onClick={() => setRevealedMap(prev => ({ ...prev, [currentQ]: true }))}
                                disabled={selectedOption === null}
                                className="w-full h-8 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                {selectedOption === null ? 'Select an option to reveal' : 'Reveal Answer'}
                            </button>
                        )}

                        {/* Nav */}
                        <div className="flex items-center justify-between pt-1">
                            <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
                                disabled={currentQ === 0}
                                className="flex items-center gap-1 text-xs text-white/50 hover:text-white disabled:opacity-30 transition-all">
                                <ChevronLeft size={14} /> Prev
                            </button>
                            <button onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))}
                                disabled={currentQ === questions.length - 1}
                                className="flex items-center gap-1 text-xs text-white/50 hover:text-white disabled:opacity-30 transition-all">
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
}

// ── Floating QubeEx Button ────────────────────────────────────────────────────
function FloatingAIButton({ activeMode, onSelect, showControls }: {
    activeMode: AIMode;
    onSelect: (mode: AIMode) => void;
    showControls: boolean;
}) {
    const [open, setOpen] = useState(false);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    const options = [
        { key: 'scan' as AIMode, icon: ScanLine, label: 'AI Scan', color: 'var(--primary)', iconSize: 13 },
        { key: 'prompt' as AIMode, icon: Bot, label: 'AI Prompt', color: '#DA7756', iconSize: 15 },
        { key: 'quiz' as AIMode, icon: HelpCircle, label: 'AI Quiz', color: '#059669', iconSize: 13 },
    ];

    return (
        <div className="absolute bottom-5 right-5 flex flex-col items-end gap-2 z-20">
            <AnimatePresence>
                {open && showControls && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                        className="flex flex-col gap-2 items-end">
                        {options.map((opt, i) => {
                            const Icon = opt.icon;
                            const isActive = activeMode === opt.key;
                            return (
                                <motion.button key={opt.key}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ delay: i * 0.05 }}
                                    onClick={() => { onSelect(isActive ? null : opt.key); setOpen(false); }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-2xl text-white text-xs font-semibold shadow-lg hover:opacity-90 transition-all"
                                    style={{ background: isActive ? '#374151' : opt.color }}>
                                    <Icon size={opt.iconSize} />
                                    {opt.label}
                                    {isActive && <span className="text-[10px] opacity-70">(active)</span>}
                                </motion.button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* QubeEx Logo Button */}
            <motion.button
                animate={{ opacity: showControls ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => setOpen(v => !v)}
                className="w-12 h-12 flex items-center justify-center active:scale-95"
                whileHover={{ scale: 1.08 }}>
                <Image src="/QubeEx_darkmode_DA7756.png" alt="QubeEx" width={34} height={34} className="rounded-md" />
            </motion.button>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BlackboardPage() {
    const [doc, setDoc] = useState<{ name: string; url: string; type: string } | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeMode, setActiveMode] = useState<AIMode>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const docViewerRef = useRef<HTMLDivElement>(null);
    const barX = useMotionValue(0);
    const barY = useMotionValue(0);

    const [showLoadMenu, setShowLoadMenu] = useState(false);
    const router = useRouter();
    const [totalPages, setTotalPages] = useState(0);

    // Pages selected in the AI Scan panel — also shown as a badge on the main
    // blackboard viewer when browsing that page, and used to drive the scan animation.
    const [selectedScanPages, setSelectedScanPages] = useState<number[]>([]);
    const [isScanningPages, setIsScanningPages] = useState(false);
    const [scanGoingDown, setScanGoingDown] = useState(true);

    // Pages selected in the AI Quiz panel — same page-picker mechanism as AI Scan,
    // kept as a separate selection so switching between Scan/Quiz doesn't clash.
    const [selectedQuizPages, setSelectedQuizPages] = useState<number[]>([]);

    // Which selection array/setter the page-nav "select page" controls should
    // drive, based on whichever AI panel is currently open.
    const pageSelectMode = activeMode === 'scan' || activeMode === 'quiz';
    const activeSelectedPages = activeMode === 'quiz' ? selectedQuizPages : selectedScanPages;
    const setActiveSelectedPages = activeMode === 'quiz' ? setSelectedQuizPages : setSelectedScanPages;

    useEffect(() => {
        if (!isScanningPages) return;
        setScanGoingDown(true);
        const id = setInterval(() => setScanGoingDown(d => !d), 1600);
        return () => clearInterval(id);
    }, [isScanningPages]);

    // Load file passed from the Storage page via sessionStorage
    useEffect(() => {
        const stored = sessionStorage.getItem('blackboard_file');
        if (stored) {
            try {
                const { url, name, type } = JSON.parse(stored);
                setDoc({ name, url, type });
                setCurrentPage(1);
                setSelectedScanPages([]);
                setSelectedQuizPages([]);
                initialScaleSet.current = false;
            } catch {}
            sessionStorage.removeItem('blackboard_file');
        }
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setDoc({ name: file.name, url, type: file.type });
        setCurrentPage(1);
        setSelectedScanPages([]);
        setSelectedQuizPages([]);
        setScale(1);
        setRotation(0);
        initialScaleSet.current = false;
        toast.success(`${file.name} loaded!`);
        e.target.value = '';
    };

    const toggleFullscreen = () => {
        setIsFullscreen(v => !v);
    };

    const [showControls, setShowControls] = useState(true);
    const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);

    const viewerRef = useRef<HTMLDivElement>(null);
    const [pageWidth, setPageWidth] = useState(612);
    const [pageHeight, setPageHeight] = useState(792);

    const [splitRatio, setSplitRatio] = useState(65);
    const isDragging = useRef(false);
    const containerWidth = useRef(0);
    const [isDraggingState, setIsDraggingState] = useState(false);

    const initialScaleSet = useRef(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [drawingMode, setDrawingMode] = useState(false);
    const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
    const [drawColor, setDrawColor] = useState('#FF0000');
    const [drawSize, setDrawSize] = useState(3);
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

    const currentStroke = useRef<{ x: number; y: number }[]>([]);
    const baseImageData = useRef<ImageData | null>(null);

    const undoStack = useRef<ImageData[]>([]);
    const redoStack = useRef<ImageData[]>([]);

    useEffect(() => {
        import('react-pdf').then(({ pdfjs }) => {
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/build/pdf.worker.min.mjs',
                import.meta.url,
            ).toString();
        });
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setCurrentPage(p => Math.min(totalPages, p + 1));
            if (e.key === 'ArrowLeft') setCurrentPage(p => Math.max(1, p - 1));
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [totalPages]);

    useEffect(() => {
        if (viewerRef.current && pageWidth && pageHeight) {
            setTimeout(() => {
                if (viewerRef.current) {
                    const isRotated = rotation % 180 !== 0;
                    const w = isRotated ? pageHeight : pageWidth;
                    const h = isRotated ? pageWidth : pageHeight;
                    const scaleW = viewerRef.current.clientWidth / w;
                    const scaleH = viewerRef.current.clientHeight / h;
                    setScale(Math.min(scaleW, scaleH) * 0.98);
                }
            }, 350);
        }
    }, [isFullscreen, rotation, pageWidth, pageHeight]);

    useEffect(() => {
        if (viewerRef.current && pageWidth && pageHeight) {
            setTimeout(() => {
                if (viewerRef.current) {
                    const isRotated = rotation % 180 !== 0;
                    const w = isRotated ? pageHeight : pageWidth;
                    const h = isRotated ? pageWidth : pageHeight;
                    const scaleW = viewerRef.current.clientWidth / w;
                    const scaleH = viewerRef.current.clientHeight / h;
                    setScale(Math.min(scaleW, scaleH) * 0.98);
                }
            }, 350);
        }
    }, [activeMode]);

    useEffect(() => {
        setTimeout(() => {
            barX.set(0);
            barY.set(0);
        }, 200);
    }, [activeMode]);


    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = setTimeout(() => setShowControls(false), 2500);
    };

    const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        isDrawing.current = true;
        const rect = canvasRef.current!.getBoundingClientRect();
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        lastPos.current = pos;
        const ctx = canvasRef.current!.getContext('2d')!;
        undoStack.current.push(ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height));
        redoStack.current = [];
        if (activeTool === 'highlighter') {
            currentStroke.current = [pos];
            baseImageData.current = ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d')!;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (activeTool === 'highlighter') {
            currentStroke.current.push({ x, y });
            if (baseImageData.current) {
                ctx.putImageData(baseImageData.current, 0, 0);
            }
            ctx.beginPath();
            ctx.moveTo(currentStroke.current[0].x, currentStroke.current[0].y);
            currentStroke.current.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.globalAlpha = 0.35;
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = drawSize * 8;
            ctx.lineCap = 'square';
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        } else if (activeTool === 'pen') {
            ctx.beginPath();
            ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
            ctx.lineTo(x, y);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = drawSize;
            ctx.lineCap = 'round';
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
            ctx.lineTo(x, y);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = drawSize * 4;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
        lastPos.current = { x, y };
    };

    const undo = () => {
        if (!canvasRef.current || undoStack.current.length === 0) return;
        const ctx = canvasRef.current.getContext('2d')!;
        redoStack.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
        const prev = undoStack.current.pop()!;
        ctx.putImageData(prev, 0, 0);
    };

    const redo = () => {
        if (!canvasRef.current || redoStack.current.length === 0) return;
        const ctx = canvasRef.current.getContext('2d')!;
        undoStack.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
        const next = redoStack.current.pop()!;
        ctx.putImageData(next, 0, 0);
    };

    const stopDraw = () => {
        isDrawing.current = false;
        lastPos.current = null;
    };

    const clearCanvas = () => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d')!;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const handleDividerMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        setIsDraggingState(true);
        containerWidth.current = containerRef.current?.clientWidth ?? 0;

        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = (x / rect.width) * 100;
            setSplitRatio(Math.min(80, Math.max(30, ratio)));
        };

        const onMouseUp = () => {
            isDragging.current = false;
            setIsDraggingState(false);
            setTimeout(() => {
                if (viewerRef.current && pageWidth && pageHeight) {
                    const isRotated = rotation % 180 !== 0;
                    const w = isRotated ? pageHeight : pageWidth;
                    const h = isRotated ? pageWidth : pageHeight;
                    const scaleW = viewerRef.current.clientWidth / w;
                    const scaleH = viewerRef.current.clientHeight / h;
                    setScale(Math.min(scaleW, scaleH) * 0.98);
                }
            }, 100);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <motion.div
            layout
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`flex flex-col overflow-hidden ${isFullscreen
                ? 'fixed top-[81px] left-0 right-0 bottom-0 z-[100] bg-background px-2 py-2'
                : 'h-full pb-2'
                }`}>
            {/* Header */}
            {!isFullscreen && (
                <div className="shrink-0 px-1 pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Monitor size={21} /> Blackboard
                            </h1>
                            <p className="text-[13px] text-muted-foreground">
                                {doc ? doc.name : 'Load a document to begin'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <button onClick={() => setShowLoadMenu(v => !v)}
                                    className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                    <Upload size={14} /> Load Document <ChevronDown size={11} />
                                </button>
                                <AnimatePresence>
                                    {showLoadMenu && (
                                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 top-10 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[180px]">
                                            <button onClick={() => { router.push('/teacher/blackboard/storage'); setShowLoadMenu(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted transition-colors">
                                                <FolderOpen size={14} className="text-amber-500" /> From Storage
                                            </button>
                                            <button onClick={() => { fileInputRef.current?.click(); setShowLoadMenu(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted transition-colors">
                                                <Upload size={14} className="text-primary" /> From Computer
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <input ref={fileInputRef} type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.svg" className="hidden" onChange={handleFileUpload} />
                        </div>
                    </div>
                    <div className="h-px bg-border/60 mt-2" />
                </div>
            )}

            {/* Main blackboard box */}
            <div ref={containerRef}
                onMouseMove={handleMouseMove}
                className="flex-1 flex min-h-0 overflow-hidden bg-black border border-border/50 rounded-2xl shadow-md shadow-black/20 relative">

                {/* Doc Viewer */}
                <div
                    ref={docViewerRef}
                    className={`relative flex flex-col min-h-0 overflow-hidden ${isDraggingState ? '' : 'transition-all duration-150'}`}
                    style={{ width: activeMode ? `${splitRatio}%` : '100%' }}>

                    {/* Fullscreen button */}
                    <motion.button
                        animate={{ opacity: showControls ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={toggleFullscreen}
                        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-xl flex items-center justify-center text-white/70 hover:text-white border border-white/10 transition-colors"
                        style={{ background: 'rgba(0,0,0,0.6)' }}>
                        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </motion.button>

                    {/* Floating QubeEx Button */}
                    <FloatingAIButton activeMode={activeMode} onSelect={setActiveMode} showControls={showControls} />

                    {!doc ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                            <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center">
                                <Monitor size={36} className="text-white/40" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white/70">No document loaded</p>
                                <p className="text-xs text-white/40 mt-1">Upload a PDF, PPT, or Word document to start</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {(() => {
                                const renderer = getRenderer(doc);
                                return (
                                    <div ref={viewerRef} className="flex-1 bg-zinc-900 flex items-center justify-center overflow-hidden relative"
                                        onWheel={(e) => {
                                            if (totalPages <= 1) return;
                                            e.preventDefault();
                                            setShowControls(true);
                                            if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
                                            controlsTimerRef.current = setTimeout(() => setShowControls(false), 2500);
                                            if (e.deltaY > 0) {
                                                setCurrentPage(p => Math.min(totalPages, p + 1));
                                            } else if (e.deltaY < 0) {
                                                setCurrentPage(p => Math.max(1, p - 1));
                                            }
                                        }}>
                                        {pageSelectMode && (
                                            <button
                                                onClick={() => setActiveSelectedPages(prev =>
                                                    prev.includes(currentPage) ? prev.filter(p => p !== currentPage) : [...prev, currentPage]
                                                )}
                                                className="absolute top-7 left-7 z-20 w-5 h-5 rounded-full shrink-0 transition-all hover:scale-110"
                                                style={activeSelectedPages.includes(currentPage)
                                                    ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }
                                                    : { background: 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.4)' }}
                                                title={activeSelectedPages.includes(currentPage) ? 'Deselect page' : 'Select page'}>
                                                {activeSelectedPages.includes(currentPage) && (
                                                    <span className={`absolute inset-0 flex items-center justify-center leading-none ${isFullscreen ? '-translate-y-[1px]' : 'translate-y-[1px]'}`}>
                                                        <Check size={11} className="text-white block" strokeWidth={3} style={{ display: 'block' }} />
                                                    </span>
                                                )}
                                            </button>
                                        )}
                                        {/* AI Scan animation overlay — placeholder until a final animation asset is provided */}
                                        <AnimatePresence>
                                            {isScanningPages && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />

                                                    <motion.div
                                                        initial={{ top: '0%' }}
                                                        animate={{ top: ['0%', '100%'] }}
                                                        transition={{ duration: 1.6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                                                        className="absolute left-[0.5%] right-[0.5%] h-[2px]">
                                                        {/* Trailing glow — sits above the line when moving down, below when moving up */}
                                                        <div className="absolute inset-x-0 h-20 pointer-events-none"
                                                            style={scanGoingDown
                                                                ? { bottom: '100%', background: 'linear-gradient(180deg, transparent, rgba(218,119,86,0.35))' }
                                                                : { top: '100%', background: 'linear-gradient(0deg, transparent, rgba(218,119,86,0.35))' }} />
                                                        {/* Scan line */}
                                                        <div className="absolute inset-0" style={{ background: '#DA7756', boxShadow: '0 0 14px 3px rgba(218,119,86,1)' }} />
                                                        {/* End dots */}
                                                        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                                                            style={{ background: '#DA7756', boxShadow: '0 0 6px 1px rgba(218,119,86,0.9)' }} />
                                                        <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                                                            style={{ background: '#DA7756', boxShadow: '0 0 6px 1px rgba(218,119,86,0.9)' }} />
                                                    </motion.div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {renderer === 'pdf' && (
                                            <>
                                                <Document
                                                    file={doc.url}
                                                    onLoadSuccess={({ numPages }) => setTotalPages(numPages)}
                                                    className="flex items-center justify-center h-full overflow-auto">
                                                    <Page
                                                        pageNumber={currentPage}
                                                        scale={scale}
                                                        rotate={rotation}
                                                        renderTextLayer={false}
                                                        renderAnnotationLayer={false}
                                                        className="shadow-2xl"
                                                        onLoadSuccess={(page) => {
                                                            setPageWidth(page.originalWidth);
                                                            setPageHeight(page.originalHeight);
                                                            if (viewerRef.current && !initialScaleSet.current) {
                                                                const scaleW = viewerRef.current.clientWidth / page.originalWidth;
                                                                const scaleH = viewerRef.current.clientHeight / page.originalHeight;
                                                                setScale(Math.min(scaleW, scaleH) * 0.92);
                                                                initialScaleSet.current = true;
                                                            }
                                                        }}
                                                    />
                                                </Document>

                                                {drawingMode && (
                                                    <canvas
                                                        ref={canvasRef}
                                                        width={viewerRef.current?.clientWidth ?? 800}
                                                        height={viewerRef.current?.clientHeight ?? 600}
                                                        className="absolute inset-0 z-20"
                                                        style={{ cursor: activeTool === 'eraser' ? 'cell' : 'crosshair' }}
                                                        onMouseDown={startDraw}
                                                        onMouseMove={draw}
                                                        onMouseUp={stopDraw}
                                                        onMouseLeave={stopDraw}
                                                    />
                                                )}

                                                <div
                                                    className="absolute inset-0 z-10"
                                                    onMouseMove={handleMouseMove}
                                                    style={{ pointerEvents: showControls ? 'none' : 'all' }}
                                                />
                                            </>
                                        )}

                                        {renderer === 'office-online' && (
                                            <iframe
                                                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(doc.url)}`}
                                                className="w-full h-full border-0"
                                                title={doc.name}
                                                allow="fullscreen"
                                            />
                                        )}

                                        {renderer === 'image' && (
                                            <img
                                                src={doc.url}
                                                alt={doc.name}
                                                className="max-w-full max-h-full object-contain"
                                                style={{ transform: `rotate(${rotation}deg) scale(${scale})` }}
                                            />
                                        )}

                                        {renderer === 'office-local' && (
                                            <div className="flex flex-col items-center justify-center gap-3 text-center px-8">
                                                <Monitor size={28} className="text-white/30" />
                                                <p className="text-sm font-medium text-white/80">{doc.name}</p>
                                                <p className="text-xs text-white/40 leading-relaxed">
                                                    PPT and Word files must be opened from Storage to preview online.<br />
                                                    Go to <span className="text-primary">Storage → Upload → Open in Blackboard</span>.
                                                </p>
                                            </div>
                                        )}

                                        {renderer === 'unsupported' && (
                                            <div className="flex flex-col items-center justify-center gap-3 text-white/60">
                                                <Monitor size={28} className="text-white/30" />
                                                <p className="text-sm font-medium text-white/80">{doc.name}</p>
                                                <p className="text-xs text-white/40">Unsupported file format</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Floating controls bar */}
                            {doc && (() => {
                                const renderer = getRenderer(doc);
                                const isPdf = renderer === 'pdf';
                                const isImage = renderer === 'image';
                                const showZoom = isPdf || isImage;
                                return (
                                    <motion.div
                                        drag
                                        dragMomentum={false}
                                        dragConstraints={docViewerRef}
                                        style={{ x: barX, y: barY, background: 'rgba(0,0,0,0.6)', maxWidth: 'calc(100% - 2rem)' }}
                                        animate={{ opacity: showControls ? 1 : 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-white/10 overflow-hidden cursor-default">
                                        <div className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 transition-colors shrink-0 pr-1">
                                            <GripVertical size={14} />
                                        </div>

                                        {showZoom && (
                                            <>
                                                <div className="w-px h-4 bg-white/10 shrink-0" />

                                                <button onClick={() => setRotation(r => (r + 90) % 360)}
                                                    className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-all">
                                                    <RotateCw size={14} />
                                                </button>

                                                {isPdf && (
                                                    <>
                                                        <div className="w-px h-4 bg-white/10" />
                                                        <button onClick={() => {
                                                            if (viewerRef.current) {
                                                                const scaleW = viewerRef.current.clientWidth / pageWidth;
                                                                const scaleH = viewerRef.current.clientHeight / pageHeight;
                                                                setScale(Math.min(scaleW, scaleH) * 0.98);
                                                            }
                                                        }}
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all text-[10px] font-medium">
                                                            Page
                                                        </button>
                                                        <button onClick={() => {
                                                            if (viewerRef.current) {
                                                                setScale((viewerRef.current.clientWidth / pageWidth) * 0.98);
                                                            }
                                                        }}
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all text-[10px] font-medium">
                                                            Width
                                                        </button>
                                                    </>
                                                )}

                                                <div className="w-px h-4 bg-white/10" />

                                                <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                                                    className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-all">
                                                    <ZoomOut size={14} />
                                                </button>

                                                <span className="text-xs text-white/60 text-center shrink-0">
                                                    {Math.round(scale * 100)}%
                                                </span>

                                                <button onClick={() => setScale(s => Math.min(3, s + 0.1))}
                                                    className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-all">
                                                    <ZoomIn size={14} />
                                                </button>
                                            </>
                                        )}

                                        {isPdf && (
                                            <>
                                                <div className="w-px h-4 bg-white/10" />

                                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                                    className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-20 transition-all">
                                                    <ChevronLeft size={14} />
                                                </button>
                                                <span className="text-xs text-white/60 text-center shrink-0">
                                                    {currentPage} / {totalPages}
                                                </span>
                                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                                    className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-20 transition-all">
                                                    <ChevronRight size={14} />
                                                </button>

                                                {pageSelectMode && (
                                                    <>
                                                        <div className="w-px h-4 bg-white/10 shrink-0" />
                                                        <button
                                                            onClick={() => setActiveSelectedPages(prev =>
                                                                prev.includes(currentPage) ? prev.filter(p => p !== currentPage) : [...prev, currentPage]
                                                            )}
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all shrink-0"
                                                            style={activeSelectedPages.includes(currentPage)
                                                                ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)', color: '#fff' }
                                                                : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                                                            {activeSelectedPages.includes(currentPage) ? <Check size={11} /> : null}
                                                            {activeSelectedPages.includes(currentPage) ? 'Selected' : 'Select page'}
                                                        </button>
                                                    </>
                                                )}

                                                <div className="w-px h-4 bg-white/10 shrink-0" />
                                                <button
                                                    onClick={() => setDrawingMode(v => !v)}
                                                    className={`w-6 h-6 flex items-center justify-center transition-all shrink-0 rounded-md ${drawingMode ? 'text-white bg-white/20' : 'text-white/50 hover:text-white'}`}>
                                                    <Pencil size={14} />
                                                </button>
                                            </>
                                        )}
                                    </motion.div>
                                );
                            })()}

                            {drawingMode && doc && getRenderer(doc) === 'pdf' && (
                                <motion.div
                                    drag
                                    dragMomentum={false}
                                    dragConstraints={containerRef}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-white/10 cursor-default"
                                    style={{ background: 'rgba(0,0,0,0.85)' }}>

                                    <GripVertical size={14} className="text-white/30 cursor-grab active:cursor-grabbing shrink-0" />
                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    {([
                                        { key: 'pen' as const, icon: Pen, title: 'Pen' },
                                        { key: 'highlighter' as const, icon: Highlighter, title: 'Highlighter' },
                                        { key: 'eraser' as const, icon: Eraser, title: 'Eraser' },
                                    ]).map(tool => (
                                        <button key={tool.key}
                                            title={tool.title}
                                            onClick={() => setActiveTool(tool.key)}
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${activeTool === tool.key ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}>
                                            <tool.icon size={14} />
                                        </button>
                                    ))}

                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    {['#FF0000', '#FFFF00', '#00FF00', '#0099FF', '#FFFFFF'].map(color => (
                                        <button key={color}
                                            onClick={() => setDrawColor(color)}
                                            className={`w-5 h-5 rounded-full transition-all shrink-0 ${drawColor === color ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                                            style={{ background: color }} />
                                    ))}

                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    <input type="range" min={1} max={10} value={drawSize}
                                        onChange={e => setDrawSize(Number(e.target.value))}
                                        className="w-16 accent-white h-1 cursor-pointer" />
                                    <span className="text-[10px] text-white/50 w-4 shrink-0">{drawSize}</span>

                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    <button onClick={undo} title="Undo"
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-all shrink-0">
                                        <Undo2 size={14} />
                                    </button>
                                    <button onClick={redo} title="Redo"
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-all shrink-0">
                                        <Redo2 size={14} />
                                    </button>

                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    <button onClick={clearCanvas}
                                        className="text-[10px] text-red-400 hover:text-red-300 font-medium px-1 transition-all shrink-0">
                                        Clear All
                                    </button>

                                    <button onClick={() => setDrawingMode(false)} title="Close Draw"
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-all shrink-0">
                                        <X size={14} />
                                    </button>
                                </motion.div>
                            )}
                        </>
                    )}
                </div>

                {/* AI Panel */}
                <AnimatePresence>
                    {activeMode && (
                        <>
                            <div
                                onMouseDown={handleDividerMouseDown}
                                className="w-1 cursor-col-resize hover:bg-white/20 bg-white/10 transition-colors shrink-0 z-20 relative group">
                                <div className="absolute inset-y-0 -left-1 -right-1" />
                            </div>

                            <motion.div
                                className="flex flex-col overflow-hidden z-10 min-w-0"
                                style={{ flex: 1, background: '#000' }}>
                                {activeMode === 'scan' && (
                                    <AIScanPanel
                                        onClose={() => setActiveMode(null)}
                                        docName={doc?.name}
                                        doc={doc ? { url: doc.url, type: doc.type } : null}
                                        totalPages={totalPages}
                                        selectedPages={selectedScanPages}
                                        onTogglePage={(page) => setSelectedScanPages(prev =>
                                            prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
                                        )}
                                        onScanStart={() => setIsScanningPages(true)}
                                        onScanEnd={() => setIsScanningPages(false)}
                                        onNavigateToPage={setCurrentPage}
                                    />
                                )}
                                {activeMode === 'prompt' && (
                                    <AIPromptPanel onClose={() => setActiveMode(null)} context={doc?.name} />
                                )}
                                {activeMode === 'quiz' && (
                                    <AIQuizPanel
                                        onClose={() => setActiveMode(null)}
                                        docName={doc?.name}
                                        doc={doc ? { url: doc.url, type: doc.type } : null}
                                        totalPages={totalPages}
                                        selectedPages={selectedQuizPages}
                                        onTogglePage={(page) => setSelectedQuizPages(prev =>
                                            prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
                                        )}
                                        onNavigateToPage={setCurrentPage}
                                    />
                                )}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
