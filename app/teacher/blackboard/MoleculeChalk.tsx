'use client';

// A small molecule drawn in chalk: atoms as coloured rings with their symbol, bonds as (double / triple) lines.
import { motion } from 'framer-motion';

export type Molecule = { atoms: { el: string; x: number; y: number }[]; bonds: [number, number, number][] };

const ATOM_COLOR: Record<string, string> = {
    H: '#F4F1E8', C: '#F4F1E8', O: '#F87171', N: '#7DB4FF', Cl: '#86EFAC', F: '#86EFAC',
    S: '#FDE047', P: '#FDBA74', Na: '#D8B4FE', K: '#D8B4FE', Ca: '#D8B4FE', Mg: '#D8B4FE', Fe: '#FDBA74', Br: '#FCA5A5', I: '#C4B5FD',
};
const CHALK = '#F4F1E8';

export function MoleculeChalk({ molecule, width }: { molecule: Molecule; width: number }) {
    const { atoms, bonds } = molecule;
    const xs = atoms.map(a => a.x), ys = atoms.map(a => a.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 0.001), spanY = Math.max(maxY - minY, 0.001);
    const pad = 0.45;
    const unit = Math.min(110, (width - 20) / (spanX + pad * 2)); // px per bond length
    const W = (spanX + pad * 2) * unit, H = (spanY + pad * 2) * unit;
    const px = (a: { x: number; y: number }) => ({ x: (a.x - minX + pad) * unit, y: (a.y - minY + pad) * unit });
    const r = Math.max(12, Math.min(24, unit * 0.26));
    const stroke = Math.max(2.5, unit * 0.045);
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible" aria-hidden>
            {bonds.map(([i, j, order], k) => {
                const a = px(atoms[i]), b = px(atoms[j]);
                const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
                const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len; // normal, to offset double/triple lines
                const gap = stroke * 2.4;
                const offsets = order === 1 ? [0] : order === 2 ? [-gap / 2, gap / 2] : [-gap, 0, gap];
                return offsets.map((o, n) => (
                    <motion.line key={`${k}-${n}`}
                        x1={a.x + nx * o} y1={a.y + ny * o} x2={b.x + nx * o} y2={b.y + ny * o}
                        stroke={CHALK} strokeWidth={stroke} strokeLinecap="round" opacity={0.92}
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                        transition={{ duration: 0.35, delay: 0.1 + k * 0.08, ease: 'easeOut' }} />
                ));
            })}
            {atoms.map((a, i) => {
                const p = px(a);
                const col = ATOM_COLOR[a.el] ?? '#FDBA74';
                return (
                    <motion.g key={i} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                        transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.25 + bonds.length * 0.08 + i * 0.05 }}>
                        <circle cx={p.x} cy={p.y} r={r} fill="#2D4B3C" stroke={col} strokeWidth={stroke} />
                        <circle cx={p.x} cy={p.y} r={r} fill={col} opacity={0.16} />
                        <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                            style={{ fontFamily: 'Caveat, cursive', fontWeight: 700, fontSize: r * (a.el.length > 1 ? 1.15 : 1.4), fill: col }}>
                            {a.el}
                        </text>
                    </motion.g>
                );
            })}
        </svg>
    );
}

