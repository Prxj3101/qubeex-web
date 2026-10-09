'use client';

// A tidied-up figure on the classroom board. The teacher draws a rough triangle /
// rectangle / circle...; Magic Chalk redraws it clean, labels the corners (A, B, C...)
// and lets the teacher tap a "?" to type in a known angle or side - the rest is solved
// on the spot (angle sum, equal base angles, Pythagoras, perimeter and area, circle).
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    type Shape, type Pt, fmt, solveAngles, solveRightTriangle, solveRect, solveCircle,
} from './shapeMagic';

const CHALK = '#F4F1E8';
const PINK = '#F9A8D4';   // typed in by the teacher
const CYAN = '#7DD3FC';   // worked out
const FONT = 'Caveat, Kalam, cursive';

type Edit = { kind: 'angle' | 'side' | 'radius'; i: number } | null;

export function ShapeChalk({ shape, width }: { shape: Shape; width: number }) {
    const [angleVals, setAngleVals] = useState<(number | undefined)[]>([]);
    const [sideVals, setSideVals] = useState<(number | undefined)[]>([]);
    const [edit, setEdit] = useState<Edit>(null);

    const W = Math.max(200, width);
    const PAD = Math.round(W * 0.13);
    const inner = W - PAD * 2;
    const circle = shape.kind === 'circle';
    const H = Math.round(PAD * 2 + (circle ? 1 : shape.aspect) * inner);
    const px = (p: Pt) => ({ x: PAD + p.x * inner, y: PAD + p.y * inner });
    const fs = Math.max(13, Math.min(24, W / 15));

    const V = circle ? [] : shape.pts.map(px);
    const centroid = circle ? { x: W / 2, y: H / 2 } : { x: V.reduce((s, p) => s + p.x, 0) / V.length, y: V.reduce((s, p) => s + p.y, 0) / V.length };
    const toward = (p: Pt, to: Pt, d: number): Pt => {
        const dx = to.x - p.x, dy = to.y - p.y, l = Math.hypot(dx, dy) || 1;
        return { x: p.x + (dx / l) * d, y: p.y + (dy / l) * d };
    };

    const angles = circle ? [] : solveAngles(shape, angleVals);
    const rightTri = shape.kind === 'triangle' && shape.sub === 'right' ? solveRightTriangle(shape, sideVals) : null;
    const rect = shape.kind === 'quad' && (shape.sub === 'rectangle' || shape.sub === 'square') ? solveRect(shape, sideVals) : null;
    const circ = circle ? solveCircle(sideVals[0]) : null;

    const commit = (raw: string) => {
        const v = parseFloat(raw);
        const e = edit;
        setEdit(null);
        if (!e || !Number.isFinite(v) || v <= 0) return;
        if (e.kind === 'angle') {
            setAngleVals(a => { const n = [...a]; n[e.i] = v < 180 ? v : undefined; return n; });
        } else {
            setSideVals(a => { const n = [...a]; n[e.i] = v; return n; });
        }
    };
    const clear = (kind: 'angle' | 'side', i: number) => {
        if (kind === 'angle') setAngleVals(a => { const n = [...a]; n[i] = undefined; return n; });
        else setSideVals(a => { const n = [...a]; n[i] = undefined; return n; });
    };

    const chip = (key: string, at: Pt, text: string | null, color: string, opts: { onClick?: () => void; onClear?: () => void; title?: string; editing?: boolean; unit?: string; fixed?: boolean }) => (
        <div key={key} className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: at.x, top: at.y }}>
            {opts.editing ? (
                <input autoFocus type="number" inputMode="decimal" step="any" min={0}
                    onPointerDown={e => e.stopPropagation()}
                    onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); if (e.key === 'Escape') setEdit(null); }}
                    onBlur={e => commit(e.target.value)}
                    className="text-center rounded-md bg-black/70 outline-none"
                    style={{ width: fs * 3.4, fontFamily: FONT, fontSize: fs, fontWeight: 700, color: PINK, border: `1.5px solid ${PINK}` }} />
            ) : (
                <button type="button" title={opts.title} onClick={opts.fixed ? undefined : opts.onClick}
                    onContextMenu={e => { if (opts.onClear) { e.preventDefault(); opts.onClear(); } }}
                    className="px-1.5 rounded-md leading-tight whitespace-nowrap"
                    style={{
                        fontFamily: FONT, fontSize: fs, fontWeight: 700, color: text === null ? '#FCD34D' : color,
                        background: 'rgba(0,0,0,0.28)', cursor: opts.fixed ? 'default' : 'pointer',
                        border: text === null ? '1.5px dashed rgba(252,211,77,0.7)' : '1.5px solid transparent',
                    }}>
                    {text === null ? '?' : `${text}${opts.unit ?? ''}`}
                </button>
            )}
        </div>
    );

    // ── Drawing ───────────────────────────────────────────────────────────────
    const outline = circle
        ? null
        : V.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + 'Z';
    const r = circle ? inner / 2 : 0;

    // Right-angle corner squares (any vertex whose angle is exactly 90).
    const rightMarks = circle ? [] : V.map((p, i) => {
        if (angles[i]?.value !== 90) return null;
        const a = V[(i + V.length - 1) % V.length], b = V[(i + 1) % V.length];
        const m = Math.max(10, W * 0.045);
        const pa = toward(p, a, m), pb = toward(p, b, m);
        const pc = { x: pa.x + pb.x - p.x, y: pa.y + pb.y - p.y };
        return `M${pa.x} ${pa.y}L${pc.x} ${pc.y}L${pb.x} ${pb.y}`;
    });

    const label = (i: number) => String.fromCharCode(65 + i);
    const notes: { text: string; color: string }[] = [];
    if (!circle) {
        angles.forEach((a, i) => { if (a.how === 'solved' && a.note) notes.push({ text: `∠${label(i)} = ${a.note} = ${fmt(a.value!)}°`, color: CYAN }); });
    }
    rightTri?.forEach(s => { if (s.how === 'solved' && s.note) notes.push({ text: `${s.label} = ${s.note} = ${fmt(s.value!)}`, color: CYAN }); });
    if (rect?.perimeter !== undefined) {
        notes.push({ text: `Perimeter = 2(${fmt(rect.w!)} + ${fmt(rect.h!)}) = ${fmt(rect.perimeter)}`, color: CYAN });
        notes.push({ text: `Area = ${fmt(rect.w!)} × ${fmt(rect.h!)} = ${fmt(rect.area!)}`, color: CYAN });
    }
    if (circ) {
        notes.push({ text: `Circumference = 2πr = 2 × ${circ.pi} × ${fmt(circ.r)} = ${fmt(circ.circumference)}`, color: CYAN });
        notes.push({ text: `Area = πr² = ${circ.pi} × ${fmt(circ.r)}² = ${fmt(circ.area)}`, color: CYAN });
    }

    const edgeMid = (i: number) => {
        const a = V[i], b = V[(i + 1) % V.length];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const out = toward(mid, centroid, -Math.max(16, W * 0.06)); // pushed outward
        return out;
    };

    return (
        <div className="w-full" style={{ userSelect: 'none' }}>
            <div className="relative mx-auto" style={{ width: W, height: H }}>
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible" aria-hidden>
                    {circle ? (
                        <>
                            <motion.circle cx={W / 2} cy={H / 2} r={r} fill="rgba(244,241,232,0.04)" stroke={CHALK} strokeWidth={3.2}
                                initial={{ pathLength: 0, rotate: -90 }} animate={{ pathLength: 1, rotate: -90 }} style={{ transformOrigin: `${W / 2}px ${H / 2}px` }}
                                transition={{ duration: 0.9, ease: 'easeInOut' }} />
                            <motion.line x1={W / 2} y1={H / 2} x2={W / 2 + r} y2={H / 2} stroke={CYAN} strokeWidth={2.4} strokeDasharray="6 5"
                                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.4 }} />
                            <circle cx={W / 2} cy={H / 2} r={3.5} fill={CHALK} />
                        </>
                    ) : (
                        <>
                            <motion.path d={outline!} fill="rgba(244,241,232,0.05)" stroke={CHALK} strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round"
                                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeInOut' }} />
                            {rightMarks.map((d, i) => d && (
                                <motion.path key={i} d={d} fill="none" stroke={CHALK} strokeWidth={2} initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ delay: 0.9 }} />
                            ))}
                        </>
                    )}
                </svg>

                {!circle && V.map((p, i) => {
                    const out = toward(p, centroid, -Math.max(14, W * 0.055));
                    return (
                        <motion.span key={`v${i}`} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ left: out.x, top: out.y, fontFamily: FONT, fontSize: fs * 1.15, fontWeight: 700, color: CHALK }}
                            initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 + i * 0.08, type: 'spring', stiffness: 300, damping: 16 }}>
                            {label(i)}
                        </motion.span>
                    );
                })}

                {/* Angles: tap a ? to type a known angle; right-click a typed one to clear it. */}
                {!circle && angles.map((a, i) => {
                    if (a.value === 90 && a.how === 'exact') return null; // the corner mark already says it
                    const at = toward(V[i], centroid, Math.max(26, W * 0.1));
                    const editing = edit?.kind === 'angle' && edit.i === i;
                    return chip(`a${i}`, at, a.value === null ? null : fmt(a.value), a.how === 'given' ? PINK : a.how === 'solved' ? CYAN : CHALK, {
                        editing, unit: '°', fixed: a.how === 'exact',
                        title: a.how === 'solved' ? a.note : a.how === 'given' ? 'Right-click to clear' : 'Tap to type this angle',
                        onClick: () => setEdit({ kind: 'angle', i }), onClear: () => clear('angle', i),
                    });
                })}

                {/* Sides: right triangle (a, b, c), rectangle (length, breadth) */}
                {rightTri?.map(s => {
                    const at = edgeMid(s.index);
                    const editing = edit?.kind === 'side' && edit.i === s.index;
                    return chip(`s${s.index}`, at, s.value === null ? null : `${s.label} = ${fmt(s.value)}`, s.how === 'given' ? PINK : CYAN, {
                        editing, title: s.how === 'solved' ? s.note : 'Tap to type this side',
                        onClick: () => setEdit({ kind: 'side', i: s.index }), onClear: () => clear('side', s.index),
                    });
                })}
                {rect && [0, 1].map(i => {
                    if (shape.sub === 'square' && i === 1) return null;
                    const at = edgeMid(i);
                    const v = i === 0 ? rect.w : rect.h;
                    const editing = edit?.kind === 'side' && edit.i === i;
                    return chip(`r${i}`, at, v === undefined ? null : fmt(v), PINK, {
                        editing, title: 'Tap to type this side', onClick: () => setEdit({ kind: 'side', i }), onClear: () => clear('side', i),
                    });
                })}
                {circle && chip('rad', { x: W / 2 + r / 2, y: H / 2 - fs * 0.9 }, sideVals[0] === undefined ? null : `r = ${fmt(sideVals[0])}`, PINK, {
                    editing: edit?.kind === 'radius', title: 'Tap to type the radius',
                    onClick: () => setEdit({ kind: 'radius', i: 0 }), onClear: () => clear('side', 0),
                })}
            </div>

            {notes.length > 0 && (
                <div className="mt-2 text-center leading-snug">
                    {notes.map((n, i) => (
                        <motion.p key={n.text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                            style={{ fontFamily: FONT, fontSize: fs, color: n.color, fontWeight: 700 }}>
                            {n.text}
                        </motion.p>
                    ))}
                </div>
            )}
        </div>
    );
}
