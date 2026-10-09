'use client';

// Magic Chalk: the teacher writes a word ("apple"), draws a shape, writes a sum
// ("1 + 1") or a formula ("H2O") with the pen and double-clicks it.
// - word / drawing / science term -> the chalk turns into the real picture (+ name read aloud)
// - maths -> the answer is written next to it in chalk handwriting
// The board canvas only stores pixels, so we keep a bounding box per pen stroke;
// a double-click groups the strokes around the click point and sends just that
// crop to POST /teacher/blackboard/ai/magic.
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Volume2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { blackboardMemory, setBlackboardValue } from '@/store/blackboardMemory';
import { recognizeShape, shapeName, type Shape } from './shapeMagic';
import { ShapeChalk } from './ShapeChalk';
import { MoleculeChalk, type Molecule } from './MoleculeChalk';
import { ReactionChalk, type Reaction } from './ReactionChalk';
import { DiagramChalk, diagramTitle, isDiagramId } from './DiagramChalk';

export type MagicBox = { x1: number; y1: number; x2: number; y2: number; pts?: { x: number; y: number }[] };
type MagicResult = {
    kind: 'object' | 'math' | 'science' | 'graph' | 'shape' | 'reaction' | 'unknown';
    label: string; localLabel?: string; display: string; answer?: string | null; emoji?: string; fact?: string;
    confidence: number; alternatives: string[];
    picture?: { url: string; caption: string } | null;
    formula?: string;
    molecule?: Molecule;
    graph?: MagicGraph;
    reaction?: Reaction;
    shape?: Shape;
    diagram?: string; // id of a ready-made animated diagram (water cycle, heart...)
};
export type MagicLang = 'en' | 'hi' | 'mr';
const REACTION_NAME: Record<MagicLang, string> = { en: 'Chemical reaction', hi: 'रासायनिक अभिक्रिया', mr: 'रासायनिक अभिक्रिया' };
type MagicGraph = {
    expr: string;
    points: ([number, number] | null)[];
    xmin: number; xmax: number; ymin: number; ymax: number;
    roots: number[]; yInt: number | null;
};
type MagicItem = {
    id: string; box: MagicBox;
    bounds: { w: number; h: number }; // board size when it was made, to keep the card on the board
    status: 'loading' | 'picture' | 'sparkle' | 'unknown';
    result?: MagicResult;
    saved?: { png: string; x: number; y: number; w: number; h: number; boxes: MagicBox[] }; // erased chalk, to bring back
    ui?: { size: number; off: { x: number; y: number } }; // how the teacher resized / moved the card
};

let shapeHintShown = false; // the how-to toast shows once per page load
const NEAR = 36;   // click must land this close to a stroke
const GAP = 38;    // strokes this close belong to the same word / drawing
const CROP_PAD = 14;
const CROP_MAX = 384;

const dist = (p: { x: number; y: number }, b: MagicBox) =>
    Math.hypot(Math.max(b.x1 - p.x, 0, p.x - b.x2), Math.max(b.y1 - p.y, 0, p.y - b.y2));
const grow = (b: MagicBox, g: number): MagicBox => ({ x1: b.x1 - g, y1: b.y1 - g, x2: b.x2 + g, y2: b.y2 + g });
const hits = (a: MagicBox, b: MagicBox) => a.x1 <= b.x2 && b.x1 <= a.x2 && a.y1 <= b.y2 && b.y1 <= a.y2;
const union = (a: MagicBox, b: MagicBox): MagicBox => ({ x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) });

/** Strokes around the click, grown outwards while neighbours are within GAP. */
function clusterAt(boxes: MagicBox[], p: { x: number; y: number }): { box: MagicBox; members: number[] } | null {
    const seed = boxes.map((b, i) => ({ b, i })).filter(({ b }) => dist(p, b) <= NEAR);
    if (!seed.length) return null;
    const members = new Set(seed.map(s => s.i));
    let box = seed.map(s => s.b).reduce(union);
    for (let changed = true; changed;) {
        changed = false;
        const zone = grow(box, GAP);
        boxes.forEach((b, i) => {
            if (!members.has(i) && hits(zone, b)) { members.add(i); box = union(box, b); changed = true; }
        });
    }
    return { box, members: [...members] };
}

/** Dark strokes on white, scaled to <= CROP_MAX - whatever colour the teacher used. */
// The board canvas is drawn at a higher pixel density than its on-screen size (so fullscreen stays sharp);
// every coordinate in this file is in on-screen (CSS) pixels, and these two convert to canvas pixels.
const cssSize = (c: HTMLCanvasElement) => ({ w: c.clientWidth || c.width, h: c.clientHeight || c.height });
const pxPerCss = (c: HTMLCanvasElement) => c.width / (c.clientWidth || c.width);

function cropStrokes(canvas: HTMLCanvasElement, box: MagicBox): string {
    const cs = pxPerCss(canvas), size = cssSize(canvas);
    const sx = Math.max(0, Math.floor(box.x1 - CROP_PAD)), sy = Math.max(0, Math.floor(box.y1 - CROP_PAD));
    const w = Math.min(size.w - sx, Math.ceil(box.x2 - box.x1 + CROP_PAD * 2));
    const h = Math.min(size.h - sy, Math.ceil(box.y2 - box.y1 + CROP_PAD * 2));
    const k = Math.min(2, CROP_MAX / Math.max(w, h));
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(w * k)); out.height = Math.max(1, Math.round(h * k));
    const ctx = out.getContext('2d')!;
    ctx.drawImage(canvas, sx * cs, sy * cs, w * cs, h * cs, 0, 0, out.width, out.height);
    // Solid strokes -> dark ink, everything else (incl. the soft golden glow) -> white paper.
    const px = ctx.getImageData(0, 0, out.width, out.height);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
        const ink = d[i + 3] > 170;
        d[i] = d[i + 1] = d[i + 2] = ink ? 17 : 255;
        d[i + 3] = 255;
    }
    ctx.putImageData(px, 0, 0);
    return out.toDataURL('image/png');
}

const VOICE_LANG: Record<MagicLang, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
// Narration loudness (0 = muted), set from the board's sound menu.
const narration = { volume: 1 };
function speak(text: string, lang: MagicLang = 'en') {
    try {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        if (narration.volume <= 0) return;
        const u = new SpeechSynthesisUtterance(text);
        u.volume = narration.volume;
        u.lang = VOICE_LANG[lang];
        u.rate = 0.9; u.pitch = 1.1;
        window.speechSynthesis.speak(u);
    } catch { /* no voice available */ }
}
const title = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

// ── Keeping the board across a refresh ─────────────────────────────────────────
// The canvas snapshot only holds pixels. The placed pictures / graphs / shapes and
// the stroke outlines (needed to double-click old drawings) are saved here, per board.
type StoredState = { items: MagicItem[]; strokes: MagicBox[] };
const stateKey = (k: string) => `magicState_${k}`;

function thin(boxes: MagicBox[]): MagicBox[] {
    return boxes.map(b => ({
        x1: Math.round(b.x1), y1: Math.round(b.y1), x2: Math.round(b.x2), y2: Math.round(b.y2),
        pts: b.pts?.filter((_, i, a) => i % 2 === 0 || i === a.length - 1).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    }));
}
function toStored(items: MagicItem[], strokes: MagicBox[]): StoredState {
    return {
        items: items.filter(i => i.status === 'picture' && i.result).map(i => ({
            ...i, saved: i.saved ? { ...i.saved, boxes: thin(i.saved.boxes) } : undefined,
        })),
        strokes: thin(strokes),
    };
}
function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

export function useMagicChalk({ canvasRef, undoStack, color, onCanvasChanged, topic, lang = 'en', voiceVolume = 1, storageKey }: {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    undoStack: MutableRefObject<ImageData[]>;
    color: string;
    onCanvasChanged: () => void;
    topic?: string;
    lang?: MagicLang;
    voiceVolume?: number;
    /** Identifies the open board; its placed items + strokes are saved under it and come back after a refresh. */
    storageKey?: string;
}) {
    useEffect(() => { narration.volume = voiceVolume; }, [voiceVolume]);
    const strokeBoxes = useRef<MagicBox[]>([]);
    const cur = useRef<MagicBox | null>(null);
    const [items, setItems] = useState<MagicItem[]>([]);
    const keyRef = useRef<string | undefined>(undefined);
    const itemsRef = useRef<MagicItem[]>([]);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const persistNow = useCallback(() => {
        const key = keyRef.current;
        if (!key) return;
        setBlackboardValue(stateKey(key), toStored(itemsRef.current, strokeBoxes.current));
    }, []);
    const schedulePersist = useCallback(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(persistNow, 300);
    }, [persistNow]);

    // A different board: forget the old one's strokes and bring back this one's saved items + strokes.
    useEffect(() => {
        keyRef.current = storageKey;
        const saved = storageKey ? (blackboardMemory[stateKey(storageKey)] as StoredState | undefined) : undefined;
        strokeBoxes.current = saved?.strokes ?? [];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(saved?.items ?? []);
    }, [storageKey]);
    useEffect(() => {
        itemsRef.current = items;
        schedulePersist();
    }, [items, schedulePersist]);
    useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

    const patch = (id: string, p: Partial<MagicItem>) => setItems(list => list.map(i => (i.id === id ? { ...i, ...p } : i)));
    const drop = (id: string) => setItems(list => list.filter(i => i.id !== id));

    const beginStroke = (p: { x: number; y: number }) => { cur.current = { x1: p.x, y1: p.y, x2: p.x, y2: p.y, pts: [{ x: p.x, y: p.y }] }; };
    const extendStroke = (p: { x: number; y: number }) => {
        const b = cur.current;
        if (b) { b.pts?.push({ x: p.x, y: p.y }); b.x1 = Math.min(b.x1, p.x); b.y1 = Math.min(b.y1, p.y); b.x2 = Math.max(b.x2, p.x); b.y2 = Math.max(b.y2, p.y); }
    };
    const endStroke = () => {
        const b = cur.current;
        cur.current = null;
        if (b && (b.x2 - b.x1 > 1 || b.y2 - b.y1 > 1)) { strokeBoxes.current.push(b); schedulePersist(); }
    };
    const reset = useCallback(() => { strokeBoxes.current = []; setItems([]); }, []);

    const writeAnswer = (box: MagicBox, answer: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        const size = Math.max(24, Math.min(96, (box.y2 - box.y1) * 0.95));
        ctx.save();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.font = `700 ${size}px Caveat, 'Patrick Hand', cursive`;
        ctx.fillStyle = color; ctx.textBaseline = 'middle';
        ctx.fillText(`= ${answer}`, box.x2 + size * 0.35, (box.y1 + box.y2) / 2);
        ctx.restore();
        onCanvasChanged();
    };

    const showPicture = (id: string, box: MagicBox, members: number[], r: MagicResult) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const cs = pxPerCss(canvas), size = cssSize(canvas);
        const x = Math.max(0, Math.floor(box.x1 - 6)), y = Math.max(0, Math.floor(box.y1 - 6));
        const w = Math.min(size.w - x, Math.ceil(box.x2 - box.x1 + 12)), h = Math.min(size.h - y, Math.ceil(box.y2 - box.y1 + 12));
        // Lift the chalk off the board (kept so it can be brought back).
        const image = ctx.getImageData(Math.round(x * cs), Math.round(y * cs), Math.max(1, Math.round(w * cs)), Math.max(1, Math.round(h * cs)));
        const boxes = members.map(i => strokeBoxes.current[i]);
        strokeBoxes.current = strokeBoxes.current.filter((_, i) => !members.includes(i));
        ctx.clearRect(x, y, w, h);
        const tmp = document.createElement('canvas');
        tmp.width = image.width; tmp.height = image.height;
        tmp.getContext('2d')!.putImageData(image, 0, 0);
        patch(id, { status: 'picture', result: r, saved: { png: tmp.toDataURL('image/png'), x, y, w, h, boxes } });
        onCanvasChanged(); // so a refresh doesn't bring the lifted chalk back under the picture
        speak(r.graph ? 'Graph' : isDiagramId(r.diagram) ? diagramTitle(r.diagram, lang) : r.reaction ? REACTION_NAME[lang] : r.shape ? (r.localLabel ?? r.label) : (lang !== 'en' && r.localLabel) || r.label, r.graph ? 'en' : lang);
    };

    const onDoubleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // The double-click's two mouse-downs each saved an undo step without drawing anything.
        undoStack.current.splice(-2, 2);
        const rect = canvas.getBoundingClientRect();
        const found = clusterAt(strokeBoxes.current, { x: e.clientX - rect.left, y: e.clientY - rect.top });
        if (!found) { toast('Write or draw something with Magic Chalk, then double-click it ✨'); return; }
        const { box, members } = found;
        const id = `${Date.now()}-${Math.round(box.x1)}`;
        // A clean figure (triangle, rectangle, circle...) is tidied up right here - no AI, no wait.
        // Hold Alt while double-clicking to skip this and ask the AI what the drawing is.
        if (!e.altKey) {
            const shape = recognizeShape(members.map(i => strokeBoxes.current[i].pts ?? []));
            if (shape) {
                setItems(list => [...list.filter(i => i.status === 'picture' || !hits(i.box, box)), { id, box, bounds: cssSize(canvas), status: 'loading' }]);
                const name = shapeName(shape, lang);
                showPicture(id, box, members, {
                    kind: 'shape', label: shapeName(shape, 'en'), localLabel: name, display: '', confidence: 1, alternatives: [], shape,
                });
                if (!shapeHintShown) {
                    shapeHintShown = true;
                    toast('Snapped to a clean shape ✨ Tap a ? to solve it · Alt + double-click asks the AI instead');
                }
                return;
            }
        }
        setItems(list => [...list.filter(i => i.status === 'picture' || !hits(i.box, box)), { id, box, bounds: cssSize(canvas), status: 'loading' }]);
        try {
            const res = await api.post('/teacher/blackboard/ai/magic', { image: cropStrokes(canvas, box), topic: topic?.slice(0, 120), lang });
            const r: MagicResult = res.data.data;
            if (r.kind === 'math' && r.answer != null) {
                writeAnswer(box, r.answer);
                patch(id, { status: 'sparkle', result: r });
                speak(`${r.display.replace(/\*/g, ' times ')} equals ${r.answer}`);
                setTimeout(() => drop(id), 1100);
            } else if (r.kind === 'unknown') {
                patch(id, { status: 'unknown', result: r });
                setTimeout(() => drop(id), 2600);
            } else {
                showPicture(id, box, members, r);
            }
        } catch (err) {
            drop(id);
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ? `Magic Chalk: ${msg}` : 'Magic Chalk could not read that. Please try again.');
        }
    };

    const restore = async (item: MagicItem) => {
        const canvas = canvasRef.current;
        const sv = item.saved;
        if (canvas && sv) {
            const image = await loadImage(sv.png);
            if (image) {
                // Drawn (not pasted) so it lands right whatever the canvas density is now.
                canvas.getContext('2d')!.drawImage(image, sv.x, sv.y, sv.w, sv.h);
                strokeBoxes.current.push(...sv.boxes);
                onCanvasChanged();
            }
        }
        drop(item.id);
    };

    const pickAlternative = async (item: MagicItem, label: string) => {
        patch(item.id, { status: 'loading' });
        try {
            const res = await api.post('/teacher/blackboard/ai/magic', { label, lang });
            const r: MagicResult = res.data.data;
            patch(item.id, { status: 'picture', result: { ...r, alternatives: [] } });
            speak(r.label);
        } catch {
            patch(item.id, { status: 'picture' });
            toast.error('Could not fetch that picture');
        }
    };

    const layer = (
        <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
            <AnimatePresence>
                {items.map(item => (
                    <MagicItemView key={item.id} item={item} bounds={item.bounds}
                        onRestore={() => restore(item)} onClose={() => drop(item.id)} onPick={l => pickAlternative(item, l)} lang={lang}
                        onUi={ui => patch(item.id, { ui })} />
                ))}
            </AnimatePresence>
        </div>
    );

    return { beginStroke, extendStroke, endStroke, reset, onDoubleClick, layer };
}

const SPARKS = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return { dx: Math.cos(a), dy: Math.sin(a), d: 0.05 * (i % 3) };
});

function Sparks({ size }: { size: number }) {
    return (
        <>
            {SPARKS.map((s, i) => (
                <motion.span key={i} className="absolute left-1/2 top-1/2 text-amber-300 pointer-events-none select-none"
                    style={{ fontSize: 14 + (i % 3) * 4, textShadow: '0 0 8px rgba(252,211,77,0.9)' }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
                    animate={{ x: s.dx * size * 0.75, y: s.dy * size * 0.75, opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.9, delay: s.d, ease: 'easeOut' }}>
                    ✦
                </motion.span>
            ))}
        </>
    );
}

function MagicItemView({ item, bounds, onRestore, onClose, onPick, lang, onUi }: {
    item: MagicItem; bounds: { w: number; h: number };
    onRestore: () => void; onClose: () => void; onPick: (label: string) => void; lang: MagicLang;
    onUi: (ui: NonNullable<MagicItem['ui']>) => void;
}) {
    const { box, status, result: r } = item;
    const bw = box.x2 - box.x1, bh = box.y2 - box.y1;

    if (status === 'loading' || status === 'sparkle' || status === 'unknown') {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute"
                style={{ left: box.x1 - 10, top: box.y1 - 10, width: bw + 20, height: bh + 20 }}>
                {status === 'loading' && (
                    <>
                        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-amber-300/80 animate-pulse"
                            style={{ boxShadow: '0 0 18px rgba(252,211,77,0.45), inset 0 0 18px rgba(252,211,77,0.25)' }} />
                        <Sparkles size={18} className="absolute -top-3 -right-3 text-amber-300 animate-spin" style={{ animationDuration: '2.2s' }} />
                    </>
                )}
                {status === 'sparkle' && <Sparks size={Math.max(bw, bh, 80)} />}
                {status === 'unknown' && (
                    <div className="absolute left-0 -top-9 whitespace-nowrap text-[12px] font-medium px-2.5 py-1 rounded-lg bg-black/80 text-white border border-white/10">
                        Hmm, couldn&apos;t read that. Try writing a little bigger ✏️
                    </div>
                )}
            </motion.div>
        );
    }

    if (status !== 'picture' || !r) return null;
    return <PlacedPicture box={box} bounds={bounds} r={r} onRestore={onRestore} onClose={onClose} onPick={onPick} lang={lang} ui={item.ui} onUi={onUi} />;
}

/**
 * A picture placed on the board. Drag it to move, drag the corner handle (or
 * use + / -) to make it bigger or smaller - the name and fact grow with it.
 */
function PlacedPicture({ box, bounds, r, onRestore, onClose, onPick, lang, ui, onUi }: {
    box: MagicBox; bounds: { w: number; h: number }; r: MagicResult;
    onRestore: () => void; onClose: () => void; onPick: (label: string) => void; lang: MagicLang;
    ui?: MagicItem['ui']; onUi: (ui: NonNullable<MagicItem['ui']>) => void;
}) {
    const shownName = r.graph ? `y = ${r.graph.expr}` : isDiagramId(r.diagram) ? diagramTitle(r.diagram, lang) : r.reaction ? REACTION_NAME[lang] : r.shape ? shapeName(r.shape, lang) : (lang !== 'en' && r.localLabel) || title(r.label);
    const bw = box.x2 - box.x1, bh = box.y2 - box.y1;
    const base = isDiagramId(r.diagram) ? Math.min(560, Math.max(360, bw, bh)) : r.reaction ? Math.min(520, Math.max(340, bw)) : Math.min(300, Math.max(150, bw, bh));
    const maxSize = Math.max(base, Math.min(bounds.w, bounds.h) * 0.9);
    // Size and position live on the item (so they survive a refresh), not in local state.
    const size = ui?.size ?? base;
    const off = ui?.off ?? { x: 0, y: 0 };
    const setSize = (v: number | ((cur: number) => number)) => onUi({ size: typeof v === 'function' ? v(size) : v, off });
    const setOff = (o: { x: number; y: number }) => onUi({ size, off: o });
    const clampSize = (v: number) => Math.max(80, Math.min(maxSize, v));
    const k = size / 200; // text grows with the picture
    const cx = box.x1 + bw / 2, cy = box.y1 + bh / 2;
    const left = Math.max(-size / 2, Math.min(cx - size / 2 + off.x, bounds.w - size / 2));
    const top = Math.max(-size / 3, Math.min(cy - size / 2 + off.y, bounds.h - 60));
    const showAlts = r.confidence < 0.6 && r.alternatives.length > 0;

    // Drag helpers: pointer capture keeps the gesture alive even if the pointer leaves the element.
    const startDrag = (e: React.PointerEvent, onMove: (dx: number, dy: number) => void) => {
        e.preventDefault(); e.stopPropagation();
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture(e.pointerId);
        const sx = e.clientX, sy = e.clientY;
        const move = (ev: PointerEvent) => onMove(ev.clientX - sx, ev.clientY - sy);
        const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    };
    const onMoveStart = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button, input')) return;
        const o = off;
        startDrag(e, (dx, dy) => setOff({ x: o.x + dx, y: o.y + dy }));
    };
    const onResizeStart = (e: React.PointerEvent) => {
        const s0 = size;
        startDrag(e, (dx, dy) => setSize(clampSize(s0 + Math.max(dx, dy) * 2)));
    };
    const ctrl = 'w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black';

    return (
        <motion.div className="absolute pointer-events-auto group touch-none cursor-grab active:cursor-grabbing"
            style={{ left, top, width: size }}
            onPointerDown={onMoveStart}
            initial={{ opacity: 0, scale: 0.35, rotate: -10, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.6, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
            <Sparks size={base} />
            {/* Straight on the board: just the thing, its name in chalk below - no card. */}
            <div className="relative">
                <div className="relative w-full flex items-end justify-center" style={r.shape || r.reaction || isDiagramId(r.diagram) ? { minHeight: 48 } : { maxHeight: size, minHeight: 48 }}>
                    {isDiagramId(r.diagram) ? (
                        <DiagramChalk id={r.diagram} lang={lang} width={size} />
                    ) : r.reaction ? (
                        <ReactionChalk reaction={r.reaction} width={size} />
                    ) : r.shape ? (
                        <ShapeChalk shape={r.shape} width={size} />
                    ) : r.graph ? (
                        <GraphChalk graph={r.graph} width={size} />
                    ) : r.molecule ? (
                        <MoleculeChalk molecule={r.molecule} width={size} />
                    ) : r.picture ? (
                        <BoardPicture url={r.picture.url} alt={r.label} maxHeight={size} />
                    ) : (
                        <span style={{ fontSize: size * 0.55, lineHeight: 1, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.35))' }}>{r.emoji ?? '✨'}</span>
                    )}
                </div>
                <p className="text-center leading-tight mt-0.5 select-none" style={{ fontFamily: CHALK_FONT, fontSize: Math.round(34 * Math.max(0.75, Math.min(1.8, k))), fontWeight: 700, color: '#F4F1E8', textShadow: '0 0 1px rgba(244,241,232,0.6)' }}>
                    {shownName}{r.molecule && r.formula ? <span style={{ fontSize: '0.7em', opacity: 0.8 }}> ({r.formula})</span> : null}
                </p>
                {r.fact && (
                    <p className="text-center leading-snug px-1 select-none" style={{ fontFamily: CHALK_FONT, fontSize: Math.round(19 * Math.max(0.8, Math.min(1.7, k))), color: 'rgba(244,241,232,0.78)' }}>
                        {r.fact}
                    </p>
                )}

                {/* controls */}
                <div className="absolute -top-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setSize(v => clampSize(v - 40))} title="Smaller" className={ctrl}><ZoomOut size={13} /></button>
                    <button onClick={() => setSize(v => clampSize(v + 40))} title="Bigger" className={ctrl}><ZoomIn size={13} /></button>
                    <button onClick={() => speak(r.graph ? shownName.replace('=', 'equals').replace('^', ' to the power ') : shownName, r.graph ? 'en' : lang)} title="Say it" className={ctrl}><Volume2 size={13} /></button>
                    <button onClick={onRestore} title="Back to chalk" className={ctrl}><Undo2 size={13} /></button>
                    <button onClick={onClose} title="Remove" className={ctrl}><X size={13} /></button>
                </div>
                {/* resize handle (drag) */}
                <span onPointerDown={onResizeStart} title="Drag to resize"
                    className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-black/70 border border-white/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-nwse-resize flex items-center justify-center">
                    <span className="w-2 h-2 border-r-2 border-b-2 border-white/80" />
                </span>
            </div>
            {showAlts && (
                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
                    <span className="text-[11px] text-white/80">Not it?</span>
                    {r.alternatives.map(a => (
                        <button key={a} onClick={() => onPick(a)}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/75 text-white border border-white/15 hover:bg-black">
                            {title(a)}
                        </button>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

/**
 * Cut a photo out of its background so only the thing sits on the board.
 * Works for the usual "object on a plain backdrop" photo: if the four corners
 * share one plain colour, flood-fill it away from the edges and soften the cut.
 * Returns null when the background isn't plain (or the image can't be read).
 */
function cutoutBackground(img: HTMLImageElement): string | null {
    const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    let data: ImageData;
    try { data = ctx.getImageData(0, 0, w, h); } catch { return null; } // cross-origin image
    const d = data.data;
    const at = (x: number, y: number) => (y * w + x) * 4;
    // Average + spread of a 6x6 patch in each corner.
    const patch = (x0: number, y0: number) => {
        let r = 0, g = 0, b = 0, n = 0;
        const px: number[][] = [];
        for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 6; x++) {
            const i = at(x, y); px.push([d[i], d[i + 1], d[i + 2]]); r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
        const m = [r / n, g / n, b / n];
        const spread = Math.max(...px.map(p => Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2])));
        return { m, spread };
    };
    if (w < 24 || h < 24) return null;
    const corners = [patch(0, 0), patch(w - 6, 0), patch(0, h - 6), patch(w - 6, h - 6)];
    const bg = [0, 1, 2].map(ch => corners.reduce((s, c2) => s + c2.m[ch], 0) / 4);
    const dist = (i: number) => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
    const plain = corners.every(c2 => c2.spread < 30 && Math.hypot(c2.m[0] - bg[0], c2.m[1] - bg[1], c2.m[2] - bg[2]) < 36);
    if (!plain) return null;
    const TOL = 48;
    const gone = new Uint8Array(w * h);
    const stack: number[] = [];
    for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
    for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
    let removed = 0;
    while (stack.length) {
        const p = stack.pop()!;
        if (gone[p]) continue;
        if (dist(p * 4) > TOL) continue;
        gone[p] = 1; removed++;
        const x = p % w, y = (p - x) / w;
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - w);
        if (y < h - 1) stack.push(p + w);
    }
    const frac = removed / (w * h);
    if (frac < 0.06 || frac > 0.93) return null; // nothing to cut, or it ate the subject
    // Soft edge: alpha = share of kept pixels in the 3x3 neighbourhood.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (gone[p]) { d[p * 4 + 3] = 0; continue; }
        let keep = 0, tot = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            tot++; if (!gone[yy * w + xx]) keep++;
        }
        if (keep < tot) d[p * 4 + 3] = Math.round(255 * (keep / tot));
    }
    ctx.putImageData(data, 0, 0);
    // Trim to what's left, so no empty transparent band sits between the picture and its name.
    let x1 = w, y1 = h, x2 = -1, y2 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 20) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
    }
    if (x2 < x1 || y2 < y1) return null;
    const out = document.createElement('canvas');
    out.width = x2 - x1 + 1; out.height = y2 - y1 + 1;
    out.getContext('2d')!.drawImage(c, x1, y1, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
}

/**
 * Diagrams (Wikipedia's SVG drawings - molecules, shapes, maps) are dark lines
 * meant for white paper and vanish on a green board. Redraw them as chalk:
 * white paper -> see-through, dark grey/black ink -> chalk white; coloured
 * marks (e.g. red angle labels) stay as they are. Trimmed to the drawing.
 */
function chalkifyDiagram(img: HTMLImageElement): string | null {
    const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    let data: ImageData;
    try { data = ctx.getImageData(0, 0, w, h); } catch { return null; }
    const d = data.data;
    let x1 = w, y1 = h, x2 = -1, y2 = -1;
    for (let p = 0; p < w * h; p++) {
        const i = p * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        if (d[i + 3] < 12 || (luma > 225 && sat < 28)) { d[i + 3] = 0; continue; } // paper
        if (sat < 70) {
            // grey ink -> chalk; lighter grey becomes fainter chalk
            const a = d[i + 3] * Math.min(1, (255 - luma) / 160 + 0.25);
            d[i] = 244; d[i + 1] = 241; d[i + 2] = 232; d[i + 3] = Math.round(a);
        }
        const x = p % w, y = (p - x) / w;
        if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
    }
    if (x2 < x1 || y2 < y1) return null;
    ctx.putImageData(data, 0, 0);
    const out = document.createElement('canvas');
    out.width = x2 - x1 + 1; out.height = y2 - y1 + 1;
    out.getContext('2d')!.drawImage(c, x1, y1, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
}
const isDiagram = (url: string) => /\.svg(\/|\.png|$|\?)/i.test(url);

const EDGE_FADE = 'linear-gradient(to right, transparent, #000 5%, #000 95%, transparent), linear-gradient(to bottom, transparent, #000 5%, #000 95%, transparent)';

/** The real picture placed on the board: a clean cut-out when possible, else the photo fading softly into the slate. */
function BoardPicture({ url, alt, maxHeight }: { url: string; alt: string; maxHeight: number }) {
    const [view, setView] = useState<{ url: string; src: string; cut: boolean; chalk?: boolean } | null>(null);
    useEffect(() => {
        let live = true;
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (!live) return;
            const cut = isDiagram(url) ? chalkifyDiagram(img) : cutoutBackground(img);
            setView({ url, src: cut ?? url, cut: !!cut, chalk: isDiagram(url) && !!cut });
        };
        img.onerror = () => { if (live) setView({ url, src: url, cut: false }); };
        img.src = url;
        return () => { live = false; };
    }, [url]);
    if (!view || view.url !== url) return <Sparkles size={22} className="text-amber-200/80 animate-pulse" />;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={view.src} alt={alt} draggable={false}
            className="max-w-full w-auto h-auto block"
            style={view.cut
                ? { maxHeight, filter: view.chalk ? 'drop-shadow(0 0 1px rgba(244,241,232,0.5))' : 'drop-shadow(0 10px 14px rgba(0,0,0,0.45))' }
                : {
                    maxHeight,
                    // Only the outer ~5% of each edge melts into the slate; the photo itself stays whole.
                    WebkitMaskImage: EDGE_FADE, maskImage: EDGE_FADE,
                    WebkitMaskComposite: 'source-in', maskComposite: 'intersect',
                    borderRadius: 6,
                }} />
    );
}

// Atom colours (CPK), toned for a green board; carbon/hydrogen are plain chalk.
const CHALK = '#F4F1E8';
// Caveat has no Devanagari glyphs; Kalam fills in for Hindi / Marathi text.
const CHALK_FONT = "Caveat, Kalam, cursive";

/** A molecule drawn on the board in chalk: bonds sketch themselves in, then the atoms pop on. */
/** A graph drawn in chalk: faint grid, white axes, a coloured curve that draws itself, roots and y-intercept marked. */
function GraphChalk({ graph, width }: { graph: MagicGraph; width: number }) {
    const W = Math.max(160, width), H = Math.round(W * 0.78);
    const m = { l: 26, r: 14, t: 12, b: 24 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const { xmin, xmax, ymin, ymax } = graph;
    const X = (x: number) => m.l + ((x - xmin) / (xmax - xmin)) * iw;
    const Y = (y: number) => m.t + ((ymax - y) / (ymax - ymin)) * ih;
    // Nice tick spacing (1, 2, 5 x 10^n) for roughly 5 ticks.
    const step = (span: number) => {
        const raw = span / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
        return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
    };
    const ticks = (lo: number, hi: number) => {
        const st = step(hi - lo), out: number[] = [];
        for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(Math.abs(v) < st / 1e6 ? 0 : v);
        return out;
    };
    const xt = ticks(xmin, xmax), yt = ticks(ymin, ymax);
    const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toExponential(0) : String(Math.round(v * 100) / 100));
    // Break the curve wherever the function is undefined or jumps off the screen (e.g. 1/x, tan x).
    const segs: string[] = [];
    let cur = '', prevY: number | null = null;
    for (const p of graph.points) {
        if (!p) { if (cur) segs.push(cur); cur = ''; prevY = null; continue; }
        const px = X(p[0]), py = Y(Math.max(ymin - (ymax - ymin), Math.min(ymax + (ymax - ymin), p[1])));
        if (prevY !== null && Math.abs(py - prevY) > ih * 1.5) { if (cur) segs.push(cur); cur = ''; }
        cur += `${cur ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
        prevY = py;
    }
    if (cur) segs.push(cur);
    const label = { fontFamily: 'Caveat, cursive', fontSize: 13, fill: 'rgba(244,241,232,0.7)' } as const;
    const x0 = Y(0) >= m.t && Y(0) <= H - m.b ? Y(0) : H - m.b;
    const y0 = X(0) >= m.l && X(0) <= W - m.r ? X(0) : m.l;
    const clipId = `gclip-${Math.round(W)}-${segs.length}`;
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible" aria-hidden>
            <defs><clipPath id={clipId}><rect x={m.l} y={m.t} width={iw} height={ih} /></clipPath></defs>
            {xt.map(v => <line key={`gx${v}`} x1={X(v)} x2={X(v)} y1={m.t} y2={H - m.b} stroke={CHALK} strokeOpacity={0.1} />)}
            {yt.map(v => <line key={`gy${v}`} x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} stroke={CHALK} strokeOpacity={0.1} />)}
            <motion.line x1={m.l} x2={W - m.r} y1={x0} y2={x0} stroke={CHALK} strokeWidth={2} strokeLinecap="round" opacity={0.9}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
            <motion.line x1={y0} x2={y0} y1={H - m.b} y2={m.t} stroke={CHALK} strokeWidth={2} strokeLinecap="round" opacity={0.9}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.1 }} />
            {xt.filter(v => v !== 0).map(v => <text key={`tx${v}`} x={X(v)} y={Math.min(H - 6, x0 + 14)} textAnchor="middle" style={label}>{fmt(v)}</text>)}
            {yt.filter(v => v !== 0).map(v => <text key={`ty${v}`} x={Math.max(2, y0 - 4)} y={Y(v) + 4} textAnchor="end" style={label}>{fmt(v)}</text>)}
            <g clipPath={`url(#${clipId})`}>
                {segs.map((d, i) => (
                    <motion.path key={i} d={d} fill="none" stroke="#F9A8D4" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                        style={{ filter: 'drop-shadow(0 0 3px rgba(249,168,212,0.55))' }}
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, delay: 0.45, ease: 'easeInOut' }} />
                ))}
            </g>
            {graph.roots.map(r => (
                <motion.g key={`r${r}`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ transformOrigin: `${X(r)}px ${x0}px` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 1.5 }}>
                    <circle cx={X(r)} cy={x0} r={4.5} fill="#7DD3FC" />
                    <text x={X(r)} y={x0 - 8} textAnchor="middle" style={{ ...label, fill: '#7DD3FC', fontSize: 14, fontWeight: 700 }}>{fmt(r)}</text>
                </motion.g>
            ))}
            {graph.yInt !== null && graph.yInt >= ymin && graph.yInt <= ymax && graph.yInt !== 0 && (
                <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ transformOrigin: `${y0}px ${Y(graph.yInt)}px` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 1.6 }}>
                    <circle cx={y0} cy={Y(graph.yInt)} r={4.5} fill="#FDBA74" />
                    <text x={y0 + 8} y={Y(graph.yInt) + 4} style={{ ...label, fill: '#FDBA74', fontSize: 14, fontWeight: 700 }}>{fmt(graph.yInt)}</text>
                </motion.g>
            )}
        </svg>
    );
}

/** Toolbar icon: a tilted stick of chalk with sparkles coming off its tip. */
export function MagicChalkIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1}
            strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
            {/* chalk stick, tip pointing down-left */}
            <path d="M10.2 13.8 L17.6 6.4 a2.1 2.1 0 0 1 3 3 L13.2 16.8 Z" />
            <path d="M15.6 8.4 l3 3" opacity={0.55} />
            {/* worn tip */}
            <path d="M10.2 13.8 L8.6 16.9 L13.2 16.8" />
            {/* sparkles at the tip */}
            <path d="M4.5 15.2 v3.2 M2.9 16.8 h3.2" />
            <path d="M8 20 v2 M7 21 h2" />
            <circle cx="3.6" cy="21" r="0.5" fill="currentColor" stroke="none" />
        </svg>
    );
}
