'use client';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import {
    Monitor, Upload, ChevronLeft, ChevronRight,
    Maximize2, Minimize2, X, Sparkles, MessageSquare,
    HelpCircle, Scan, Send, ZoomIn, ZoomOut,
    FolderOpen, ChevronDown, RotateCw, GripVertical, Pencil, Pen, Highlighter, Eraser, Undo2, Redo2
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

import dynamic from 'next/dynamic';

const Document = dynamic(() => import('react-pdf').then(m => m.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then(m => m.Page), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
type AIMode = 'scan' | 'prompt' | 'quiz' | null;

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    answer: number;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_SCAN_RESULTS = {
    topic: 'Photosynthesis',
    info: 'Photosynthesis is the process by which green plants convert sunlight into food using carbon dioxide and water, producing oxygen as a byproduct.',
    keyPoints: [
        'Occurs in chloroplasts',
        'Requires sunlight, CO₂, and water',
        'Produces glucose and oxygen',
        'Two stages: Light reaction & Calvin cycle',
    ],
    images: [
        { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Photosynthesis.gif/220px-Photosynthesis.gif', caption: 'Photosynthesis Process' },
        { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Chloroplast_mini.svg/220px-Chloroplast_mini.svg.png', caption: 'Chloroplast Structure' },
    ],
};

const MOCK_QUIZ: QuizQuestion[] = [
    { id: 'q1', question: 'Where does photosynthesis occur?', options: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Ribosome'], answer: 1 },
    { id: 'q2', question: 'What gas is released during photosynthesis?', options: ['Carbon Dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'], answer: 2 },
    { id: 'q3', question: 'What is the primary pigment in photosynthesis?', options: ['Carotenoid', 'Xanthophyll', 'Chlorophyll', 'Anthocyanin'], answer: 2 },
    { id: 'q4', question: 'Which light is most effective for photosynthesis?', options: ['Green', 'Yellow', 'Red & Blue', 'White'], answer: 2 },
    { id: 'q5', question: 'What is the end product of photosynthesis?', options: ['Protein', 'Glucose', 'Starch', 'Fat'], answer: 1 },
];

// ── AI Panel ─────────────────────────────────────────────────────────────────
function AIScanPanel({ onClose }: { onClose: () => void }) {
    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="w-full h-full bg-black flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <p className="text-sm font-bold flex items-center gap-2">
                    <Scan size={14} className="text-primary" /> AI Scan
                </p>
                <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                    <X size={13} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* Topic */}
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">Detected Topic</p>
                    <p className="text-sm font-bold">{MOCK_SCAN_RESULTS.topic}</p>
                </div>

                {/* Info */}
                <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Overview</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{MOCK_SCAN_RESULTS.info}</p>
                </div>

                {/* Key Points */}
                <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Key Points</p>
                    <div className="space-y-1">
                        {MOCK_SCAN_RESULTS.keyPoints.map((point, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                                <p className="text-xs text-foreground">{point}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Images */}
                <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Related Images</p>
                    <div className="space-y-2">
                        {MOCK_SCAN_RESULTS.images.map((img, i) => (
                            <div key={i} className="rounded-xl overflow-hidden border border-border/40">
                                <img src={img.url} alt={img.caption} className="w-full object-cover" />
                                <p className="text-[10px] text-muted-foreground text-center py-1.5 bg-muted/30">{img.caption}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function AIPromptPanel({ onClose }: { onClose: () => void }) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
        { role: 'ai', text: 'Hello! Ask me anything about your current topic. I can help with explanations, definitions, examples, and more.' },
    ]);

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages(prev => [
            ...prev,
            { role: 'user', text: input.trim() },
            { role: 'ai', text: `Here's a detailed explanation about "${input.trim()}": This is a mock AI response. In production, this will be powered by Claude AI to provide accurate, contextual information relevant to your current lesson.` },
        ]);
        setInput('');
    };

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="w-full h-full bg-black flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <p className="text-sm font-bold flex items-center gap-2">
                    <MessageSquare size={14} className="text-primary" /> AI Prompt
                </p>
                <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                    <X size={13} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${msg.role === 'user'
                            ? 'text-white rounded-tr-sm'
                            : 'bg-muted/60 border border-border/30 text-foreground rounded-tl-sm'
                            }`}
                            style={msg.role === 'user' ? { background: '#7C3AED' } : {}}>
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>
            <div className="border-t border-border/40 px-3 py-2 flex items-center gap-2">
                <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="Ask anything..."
                    className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/60" />
                <button onClick={handleSend} disabled={!input.trim()}
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-all shrink-0"
                    style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                    <Send size={12} />
                </button>
            </div>
        </motion.div>
    );
}

function AIQuizPanel({ onClose }: { onClose: () => void }) {
    const [currentQ, setCurrentQ] = useState(0);
    const [revealed, setRevealed] = useState(false);

    const q = MOCK_QUIZ[currentQ];

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="w-full h-full bg-black flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <p className="text-sm font-bold flex items-center gap-2">
                    <HelpCircle size={14} className="text-primary" /> Quiz
                </p>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{currentQ + 1}/{MOCK_QUIZ.length}</span>
                    <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                        <X size={13} />
                    </button>
                </div>
            </div>
            <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto">
                {/* Question */}
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">Question {currentQ + 1}</p>
                    <p className="text-sm font-semibold leading-relaxed">{q.question}</p>
                </div>

                {/* Options */}
                <div className="space-y-1.5">
                    {q.options.map((opt, i) => (
                        <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${revealed
                            ? i === q.answer
                                ? 'bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : 'bg-muted/30 border-border/30 text-muted-foreground'
                            : 'bg-muted/30 border-border/40 text-foreground'
                            }`}>
                            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0">
                                {String.fromCharCode(65 + i)}
                            </span>
                            {opt}
                            {revealed && i === q.answer && <span className="ml-auto">✓</span>}
                        </div>
                    ))}
                </div>

                {/* Reveal button */}
                {!revealed && (
                    <button onClick={() => setRevealed(true)}
                        className="w-full h-8 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                        Reveal Answer
                    </button>
                )}
            </div>

            {/* Nav */}
            <div className="border-t border-border/40 px-4 py-2.5 flex items-center justify-between">
                <button onClick={() => { setCurrentQ(q => Math.max(0, q - 1)); setRevealed(false); }}
                    disabled={currentQ === 0}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all">
                    <ChevronLeft size={14} /> Prev
                </button>
                <button onClick={() => { setCurrentQ(q => Math.min(MOCK_QUIZ.length - 1, q + 1)); setRevealed(false); }}
                    disabled={currentQ === MOCK_QUIZ.length - 1}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-all">
                    Next <ChevronRight size={14} />
                </button>
            </div>
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

    const options = [
        { key: 'scan' as AIMode, icon: Scan, label: 'AI Scan', color: '#7C3AED' },
        { key: 'prompt' as AIMode, icon: MessageSquare, label: 'AI Prompt', color: '#DA7756' },
        { key: 'quiz' as AIMode, icon: HelpCircle, label: 'Quiz', color: '#059669' },
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
                                    <Icon size={13} />
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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setDoc({ name: file.name, url, type: file.type });
        setCurrentPage(1);
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

    const [splitRatio, setSplitRatio] = useState(65); // 65% doc, 35% AI
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
        // Save state before drawing
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
            // Fit to page after drag
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
            {/* Header — fullscreen mein hide */}
            {!isFullscreen && (
                <div className="shrink-0 px-1 pb-2">
                    <div className="flex items-center justify-between">
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
                                    <Upload size={13} /> Load Document <ChevronDown size={11} />
                                </button>
                                <AnimatePresence>
                                    {showLoadMenu && (
                                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 top-10 z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[180px]">
                                            <button onClick={() => { router.push('/teacher/blackboard/storage'); setShowLoadMenu(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted transition-colors">
                                                <FolderOpen size={13} className="text-amber-500" /> From Storage
                                            </button>
                                            <button onClick={() => { fileInputRef.current?.click(); setShowLoadMenu(false); }}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted transition-colors">
                                                <Upload size={13} className="text-primary" /> From Computer
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <input ref={fileInputRef} type="file" accept=".pdf,.ppt,.pptx,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                        </div>
                    </div>
                    <div className="h-px bg-border/60 mt-2" />
                </div>

            )}

            {/* Main blackboard box */}
            <div ref={containerRef}
                onMouseMove={handleMouseMove}
                className="flex-1 flex min-h-0 overflow-hidden bg-black border border-border/50 rounded-2xl shadow-md shadow-black/20 relative">

                {/* Doc Viewer — shrinks when AI active */}
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
                        /* Empty state */
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                            <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center">
                                <Monitor size={36} className="text-muted-foreground/40" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">No document loaded</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Upload a PDF, PPT, or Word document to start</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Doc area */}
                            <div ref={viewerRef} className="flex-1 bg-zinc-900 flex items-center justify-center overflow-hidden relative">
                                {doc.type === 'application/pdf' ? (
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
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-3 text-white/60">
                                        <Monitor size={28} className="text-white/60" />
                                        <p className="text-sm font-medium text-white/80">{doc.name}</p>
                                        <p className="text-xs text-white/40">PDF format recommended</p>
                                    </div>
                                )}
                            </div>

                            {/*center bottom floating */}
                            {doc && (
                                <motion.div
                                    drag
                                    dragMomentum={false}
                                    dragConstraints={docViewerRef}
                                    style={{ x: barX, y: barY, background: 'rgba(0,0,0,0.6)', maxWidth: 'calc(100% - 2rem)' }}
                                    animate={{ opacity: showControls ? 1 : 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-white/10 overflow-hidden cursor-default">
                                    {/* Drag handle */}
                                    <div className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 transition-colors shrink-0 pr-1">
                                        <GripVertical size={14} />
                                    </div>

                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    {/* Rotate */}
                                    <button onClick={() => setRotation(r => (r + 90) % 360)}
                                        className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-all">
                                        <RotateCw size={13} />
                                    </button>

                                    <div className="w-px h-4 bg-white/10" />

                                    {/* Fit buttons */}
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

                                    <div className="w-px h-4 bg-white/10" />

                                    {/* Zoom out */}
                                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                                        className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-all">
                                        <ZoomOut size={13} />
                                    </button>

                                    <span className="text-xs text-white/60 text-center shrink-0">
                                        {Math.round(scale * 100)}%
                                    </span>

                                    <button onClick={() => setScale(s => Math.min(3, s + 0.1))}
                                        className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-all">
                                        <ZoomIn size={13} />
                                    </button>

                                    <div className="w-px h-4 bg-white/10" />

                                    {/* Page nav */}
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                        className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-20 transition-all">
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span className="text-xs text-white/60 text-center shrink-0">{currentPage} / {totalPages}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                        className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-20 transition-all">
                                        <ChevronRight size={14} />
                                    </button>

                                    <div className="w-px h-4 bg-white/10 shrink-0" />
                                    <button
                                        onClick={() => setDrawingMode(v => !v)}
                                        className={`w-6 h-6 flex items-center justify-center transition-all shrink-0 rounded-md ${drawingMode ? 'text-white bg-white/20' : 'text-white/50 hover:text-white'}`}>
                                        <Pencil size={13} />
                                    </button>

                                </motion.div>
                            )}

                            {drawingMode && doc && (
                                <motion.div
                                    drag
                                    dragMomentum={false}
                                    dragConstraints={containerRef}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-white/10 cursor-default"
                                    style={{ background: 'rgba(0,0,0,0.85)' }}>

                                    {/* Drag handle */}
                                    <GripVertical size={14} className="text-white/30 cursor-grab active:cursor-grabbing shrink-0" />
                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    {/* Tools */}
                                    {([
                                        { key: 'pen' as const, icon: Pen, title: 'Pen' },
                                        { key: 'highlighter' as const, icon: Highlighter, title: 'Highlighter' },
                                        { key: 'eraser' as const, icon: Eraser, title: 'Eraser' },
                                    ]).map(tool => (
                                        <button key={tool.key}
                                            title={tool.title}
                                            onClick={() => setActiveTool(tool.key)}
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${activeTool === tool.key ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}>
                                            <tool.icon size={13} />
                                        </button>
                                    ))}

                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    {/* Colors */}
                                    {['#FF0000', '#FFFF00', '#00FF00', '#0099FF', '#FFFFFF'].map(color => (
                                        <button key={color}
                                            onClick={() => setDrawColor(color)}
                                            className={`w-5 h-5 rounded-full transition-all shrink-0 ${drawColor === color ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                                            style={{ background: color }} />
                                    ))}

                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    {/* Size */}
                                    <input type="range" min={1} max={10} value={drawSize}
                                        onChange={e => setDrawSize(Number(e.target.value))}
                                        className="w-16 accent-white h-1 cursor-pointer" />
                                    <span className="text-[10px] text-white/50 w-4 shrink-0">{drawSize}</span>

                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    <button onClick={undo}
                                        title="Undo"
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-all shrink-0">
                                        <Undo2 size={13} />
                                    </button>
                                    <button onClick={redo}
                                        title="Redo"
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-all shrink-0">
                                        <Redo2 size={13} />
                                    </button>

                                    <div className="w-px h-4 bg-white/10 shrink-0" />

                                    {/* Clear */}
                                    <button onClick={clearCanvas}
                                        className="text-[10px] text-red-400 hover:text-red-300 font-medium px-1 transition-all shrink-0">
                                        Clear All
                                    </button>

                                    {/* Close draw */}
                                    <button onClick={() => setDrawingMode(false)}
                                        title="Close Draw"
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-all shrink-0">
                                        <X size={13} />
                                    </button>


                                </motion.div>
                            )}

                        </>
                    )}
                </div>

                {/* AI Panel — absolute right side */}
                <AnimatePresence>
                    {activeMode && (
                        <>
                            {/* Drag divider */}
                            <div
                                onMouseDown={handleDividerMouseDown}
                                className="w-1 cursor-col-resize hover:bg-white/20 bg-white/10 transition-colors shrink-0 z-20 relative group">
                                <div className="absolute inset-y-0 -left-1 -right-1" />
                            </div>

                            {/* AI Panel */}
                            <motion.div
                                className="flex flex-col overflow-hidden z-10 min-w-0"
                                style={{ flex: 1, background: '#000' }}>
                                {activeMode === 'scan' && <AIScanPanel onClose={() => setActiveMode(null)} />}
                                {activeMode === 'prompt' && <AIPromptPanel onClose={() => setActiveMode(null)} />}
                                {activeMode === 'quiz' && <AIQuizPanel onClose={() => setActiveMode(null)} />}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>


            </div>

        </motion.div>
    );
}