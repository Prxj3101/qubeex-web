'use client';

// A chemical equation on the classroom board. It is written the way the teacher wrote it,
// then the balancing numbers pop in (pink), molecules for every species appear, and a replay
// button makes the reactant molecules rearrange into the products. A small atom count shows
// that nothing was lost: the same atoms on both sides.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw } from 'lucide-react';
import { MoleculeChalk, type Molecule } from './MoleculeChalk';

export type Reaction = {
    reactants: string[];
    products: string[];
    inferred?: boolean;
    coeffs: number[];
    balanced: boolean;
    atoms: { el: string; left: number; right: number }[];
    molecules: Record<string, Molecule>;
};

const CHALK = '#F4F1E8';
const PINK = '#F9A8D4';
const CYAN = '#7DD3FC';
const FONT = 'Caveat, Kalam, cursive';

/** H2O -> H<sub>2</sub>O (digits after a symbol or a bracket become subscripts). */
function Formula({ f }: { f: string }) {
    const parts = f.match(/\d+|[^\d]+/g) ?? [f];
    return (
        <span>
            {parts.map((p, i) => (/^\d+$/.test(p) && i > 0 ? <sub key={i} style={{ fontSize: '0.65em' }}>{p}</sub> : <span key={i}>{p}</span>))}
        </span>
    );
}

/** A stand-in drawing for a formula we have no fixed layout for: atoms spread round the first/central one. */
function genericMolecule(formula: string): Molecule {
    const counts: [string, number][] = [];
    const re = /([A-Z][a-z]?)(\d*)|(\()|(\))(\d*)/g;
    // Expand brackets: keep it simple by flattening "Ca(OH)2" with a stack.
    const stack: [string, number][][] = [[]];
    let m: RegExpExecArray | null;
    while ((m = re.exec(formula))) {
        if (m[1]) stack[stack.length - 1].push([m[1], m[2] ? parseInt(m[2], 10) : 1]);
        else if (m[3]) stack.push([]);
        else if (m[4] !== undefined) {
            const inner = stack.pop() ?? [];
            const mult = m[5] ? parseInt(m[5], 10) : 1;
            inner.forEach(([e, c]) => stack[stack.length - 1].push([e, c * mult]));
        }
    }
    stack[0].forEach(([e, c]) => { const ex = counts.find(x => x[0] === e); if (ex) ex[1] += c; else counts.push([e, c]); });
    const list = counts.flatMap(([e, c]) => Array<string>(c).fill(e));
    if (list.length === 1) return { atoms: [{ el: list[0], x: 0, y: 0 }], bonds: [] };
    if (list.length > 8) return { atoms: [{ el: formula.length <= 6 ? formula : list[0], x: 0, y: 0 }], bonds: [] };
    // The element appearing once (or the first) sits in the middle; the others circle it.
    const centreEl = counts.find(x => x[1] === 1)?.[0] ?? counts[0][0];
    const ci = list.indexOf(centreEl);
    const others = list.filter((_, i) => i !== ci);
    if (list.length === 2) return { atoms: [{ el: list[0], x: -0.6, y: 0 }, { el: list[1], x: 0.6, y: 0 }], bonds: [[0, 1, list[0] === list[1] ? 2 : 1]] };
    const atoms = [{ el: centreEl, x: 0, y: 0 }, ...others.map((el, i) => {
        const a = (-Math.PI / 2) + (i * 2 * Math.PI) / others.length;
        return { el, x: Math.cos(a) * 1.05, y: Math.sin(a) * 1.05 };
    })];
    return { atoms, bonds: others.map((_, i) => [0, i + 1, 1] as [number, number, number]) };
}

export function ReactionChalk({ reaction, width }: { reaction: Reaction; width: number }) {
    const { reactants, products, coeffs, atoms } = reaction;
    const [reacted, setReacted] = useState(false);

    const W = Math.max(280, width);
    const fs = Math.max(20, Math.min(40, W / 11));
    const mol = (f: string) => reaction.molecules[f] ?? genericMolecule(f);
    const cell = Math.max(54, Math.min(86, W / (Math.max(reactants.length, products.length) * 2 + 2.4)));

    // Equation line: coefficient (pink, pops in once balanced) + formula, "+" between, arrow in the middle.
    const eq = (list: string[], offset: number) => list.map((f, i) => (
        <span key={`${offset}-${i}`} className="inline-flex items-baseline">
            {i > 0 && <span className="mx-2" style={{ color: 'rgba(244,241,232,0.7)' }}>+</span>}
            {coeffs[offset + i] > 1 && (
                <motion.span key={`c${offset + i}`} initial={{ opacity: 0, scale: 0.2, y: -14 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.9 + (offset + i) * 0.18, type: 'spring', stiffness: 360, damping: 14 }}
                    className="mr-0.5" style={{ color: PINK, fontWeight: 700 }}>
                    {coeffs[offset + i]}
                </motion.span>
            )}
            <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * (offset + i) }}>
                <Formula f={f} />
            </motion.span>
        </span>
    ));

    // One lane of molecules: `coeffs[...]` copies of each species (at most 4 drawn; the rest shown as ×N).
    const lane = (list: string[], offset: number, isProduct: boolean) => (
        <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1">
            {list.map((f, i) => {
                const n = coeffs[offset + i];
                const shown = Math.min(n, 4);
                return (
                    <div key={`${f}-${i}`} className="flex items-center gap-1">
                        {i > 0 && <span style={{ fontFamily: FONT, color: 'rgba(244,241,232,0.6)', fontSize: fs * 0.7 }}>+</span>}
                        <div className="flex items-center">
                            {Array.from({ length: shown }, (_, k) => (
                                <motion.div key={k}
                                    initial={{ opacity: isProduct ? 0 : 1, scale: isProduct ? 0.2 : 1 }}
                                    animate={isProduct
                                        ? { opacity: reacted ? 1 : 0.12, scale: reacted ? 1 : 0.5, x: 0 }
                                        : { opacity: reacted ? 0.25 : 1, scale: reacted ? 0.7 : 1, x: reacted ? 18 : 0 }}
                                    transition={{ type: 'spring', stiffness: 160, damping: 15, delay: reacted ? k * 0.09 : 0 }}
                                    style={{ marginLeft: k ? -cell * 0.12 : 0 }}>
                                    <MoleculeChalk molecule={mol(f)} width={cell} />
                                </motion.div>
                            ))}
                            {n > shown && <span style={{ fontFamily: FONT, color: PINK, fontSize: fs * 0.7, fontWeight: 700 }}>×{n}</span>}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="w-full select-none" style={{ width: W }}>
            {/* the equation */}
            <div className="flex items-baseline justify-center flex-wrap" style={{ fontFamily: FONT, fontSize: fs, fontWeight: 700, color: CHALK, lineHeight: 1.25 }}>
                {eq(reactants, 0)}
                <motion.span initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} style={{ transformOrigin: 'left', color: CHALK }}
                    transition={{ delay: 0.25 + reactants.length * 0.08, duration: 0.35 }} className="mx-3">
                    →
                </motion.span>
                {eq(products, reactants.length)}
            </div>
            <p className="text-center" style={{ fontFamily: FONT, fontSize: fs * 0.55, color: reaction.balanced ? CYAN : '#FCA5A5', fontWeight: 700, minHeight: fs * 0.7 }}>
                {reaction.balanced
                    ? (reaction.inferred ? 'Balanced — products were predicted, please check them' : 'Balanced ✓')
                    : "Couldn't balance this one — check the formulas"}
            </p>

            {/* molecules before → after */}
            <div className="mt-2 flex items-center justify-center gap-2">
                <div className="flex-1 min-w-0">{lane(reactants, 0, false)}</div>
                <div className="shrink-0 flex flex-col items-center gap-1">
                    <button type="button" title={reacted ? 'Back to reactants' : 'Watch it react'} onPointerDown={e => e.stopPropagation()}
                        onClick={() => { setReacted(v => !v); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{ background: 'rgba(249,168,212,0.28)', border: `1.5px solid ${PINK}` }}>
                        {reacted ? <RotateCcw size={14} /> : <Play size={14} />}
                    </button>
                </div>
                <div className="flex-1 min-w-0">{lane(products, reactants.length, true)}</div>
            </div>

            {/* atoms in = atoms out */}
            {reaction.balanced && (
                <motion.div animate={{ opacity: reacted ? 1 : 0.55 }} className="mt-2 flex items-center justify-center flex-wrap gap-x-3 gap-y-0.5"
                    style={{ fontFamily: FONT, fontSize: fs * 0.6, fontWeight: 700 }}>
                    {atoms.map(a => (
                        <span key={a.el} style={{ color: a.left === a.right ? CYAN : '#FCA5A5' }}>
                            {a.el}: {a.left} = {a.right} ✓
                        </span>
                    ))}
                </motion.div>
            )}
        </div>
    );
}
