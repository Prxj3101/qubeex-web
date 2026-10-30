'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { HAND, INK, TERRA } from './paper';

// A school building that draws itself in pencil, then gets a soft crayon colour.
type Stroke = { d: string; fill?: string; delay: number; dur?: number };

const STROKES: Stroke[] = [
    { d: 'M20 362 Q140 354 260 360 T500 362', delay: 0.1, dur: 0.8 },                           // ground
    { d: 'M112 360 V196 H408 V360', fill: '#FCE6D7', delay: 0.4, dur: 1 },                      // walls
    { d: 'M92 198 L260 108 L428 198 Z', fill: TERRA, delay: 0.9, dur: 0.9 },                    // roof
    { d: 'M260 108 V54', delay: 1.4, dur: 0.3 },                                                // flag pole
    { d: 'M260 56 Q282 58 302 66 Q282 72 260 80 Z', fill: '#F6C453', delay: 1.6, dur: 0.4 },   // flag
    { d: 'M240 172 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', fill: '#FFFDF7', delay: 1.4, dur: 0.6 }, // clock
    { d: 'M260 172 V160 M260 172 L269 177', delay: 1.9, dur: 0.3 },                            // hands
    { d: 'M234 360 V302 Q260 278 286 302 V360', fill: '#F6C453', delay: 1.5, dur: 0.6 },       // door
    { d: 'M140 222 h50 v40 h-50 Z M165 222 v40 M140 242 h50', fill: '#DCEBFF', delay: 1.7, dur: 0.6 },
    { d: 'M330 222 h50 v40 h-50 Z M355 222 v40 M330 242 h50', fill: '#DCEBFF', delay: 1.8, dur: 0.6 },
    { d: 'M140 288 h50 v40 h-50 Z M165 288 v40 M140 308 h50', fill: '#DCEBFF', delay: 1.9, dur: 0.6 },
    { d: 'M330 288 h50 v40 h-50 Z M355 288 v40 M330 308 h50', fill: '#DCEBFF', delay: 2.0, dur: 0.6 },
    { d: 'M60 360 V300', delay: 2.1, dur: 0.3 },                                                // tree trunks
    { d: 'M60 304 C24 304 26 252 52 254 C54 230 92 236 88 258 C110 262 102 304 60 304 Z', fill: '#BFE3C0', delay: 2.2, dur: 0.6 },
    { d: 'M466 360 V306', delay: 2.2, dur: 0.3 },
    { d: 'M466 310 C436 310 436 266 458 266 C462 246 494 252 490 272 C508 278 500 310 466 310 Z', fill: '#BFE3C0', delay: 2.3, dur: 0.6 },
    { d: 'M448 74 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0', fill: '#FFE08A', delay: 2.4, dur: 0.5 }, // sun
    { d: 'M470 40 V30 M470 118 V108 M436 74 H426 M514 74 H504 M446 50 L439 43 M494 98 L501 105 M494 50 L501 43 M446 98 L439 105', delay: 2.7, dur: 0.5 },
    { d: 'M70 92 C58 92 58 74 72 76 C76 60 100 62 102 76 C116 74 118 92 104 92 Z', fill: '#FFFFFF', delay: 2.5, dur: 0.5 }, // cloud
    { d: 'M246 360 Q250 384 226 410 M274 360 Q280 384 304 410', delay: 2.6, dur: 0.5 },        // path
];

export default function SchoolDrawing({ className }: { className?: string }) {
    const still = useReducedMotion();
    return (
        <svg viewBox="0 0 520 420" className={className} role="img" aria-label="A school, drawn in pencil">
            <defs>
                {/* a tiny wobble so lines look hand drawn */}
                <filter id="pencil">
                    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" />
                    <feDisplacementMap in="SourceGraphic" scale="2.2" />
                </filter>
            </defs>
            <g filter="url(#pencil)">
                {STROKES.map((s, i) => (
                    <g key={i}>
                        {s.fill && (
                            <motion.path
                                d={s.d}
                                fill={s.fill}
                                stroke="none"
                                initial={still ? false : { opacity: 0 }}
                                animate={{ opacity: s.fill === TERRA ? 0.85 : 1 }}
                                transition={{ delay: 2.8 + i * 0.03, duration: 0.6 }}
                            />
                        )}
                        <motion.path
                            d={s.d}
                            fill="none"
                            stroke={INK}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={still ? false : { pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ delay: s.delay, duration: s.dur ?? 0.6, ease: 'easeInOut' }}
                        />
                    </g>
                ))}
            </g>
            <motion.text
                x={260}
                y={286}
                textAnchor="middle"
                style={HAND}
                fontSize={19}
                fill={INK}
                initial={still ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 3.2, duration: 0.6 }}
            >
                your school
            </motion.text>
            {/* paper plane, drifting across the sky */}
            {!still && (
                <motion.g
                    initial={{ x: -40, y: 140, opacity: 0, rotate: -8 }}
                    animate={{ x: [-40, 160, 330], y: [140, 90, 120], opacity: [0, 1, 0], rotate: [-8, 6, -4] }}
                    transition={{ delay: 3.4, duration: 6, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
                >
                    <path d="M0 0 L26 8 L0 16 L6 8 Z M6 8 L26 8" fill="#FFFFFF" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
                </motion.g>
            )}
        </svg>
    );
}
