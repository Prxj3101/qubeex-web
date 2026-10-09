'use client';

// KBT - Kaun Banega Topper: the Blackboard AI Quiz as a TV quiz-show.
// One question at a time, a different student in the hot seat each time (picked by roll number),
// a points ladder with safe checkpoints, a 30-second clock, and four lifelines the whole class shares:
// 50-50, Audience Poll, Phone a Friend and Double Dip. All sounds are made in the browser.
import { useId, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Users, Volume2, VolumeX, Maximize2, Minimize2, ChevronLeft, ChevronRight, History, RotateCcw, ArrowRight, Check } from 'lucide-react';

export type KbtQuestion = { question: string; options: string[]; answer: number; explanation?: string };

const QUESTION_SECONDS = 30;
const CALL_SECONDS = 30;
const LEVELS = [100, 200, 300, 500, 1000, 2000, 5000, 10000, 25000, 50000];
const GOLD = '#F5C84B';
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ── Ladder ─────────────────────────────────────────────────────────────────────

/** `n` steps spread over the ten prize levels, always ending at the top one. */
function buildLadder(n: number): number[] {
    return Array.from({ length: n }, (_, i) => LEVELS[n === 1 ? 9 : Math.round((i * 9) / (n - 1))]);
}
/** Safe steps: about 30% and 60% of the way up (never the last step). */
function buildCheckpoints(n: number): Set<number> {
    const cps = new Set<number>();
    if (n >= 4) {
        for (const f of [0.3, 0.6]) {
            const i = Math.round(n * f) - 1;
            if (i >= 0 && i < n - 1) cps.add(i);
        }
    }
    return cps;
}
const LIFE_NAMES = { fifty: '50:50', poll: 'Audience Poll', call: 'Phone a Friend', dip: 'Double Dip' } as const;
// Lifelines are never free: each one eats a share of that question's points.
const LIFE_COST = { fifty: 0.2, poll: 0.25, call: 0.3, dip: 0.4 } as const;
const short = (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v));
const pts = (v: number) => v.toLocaleString('en-IN');

// ── Sounds (all synthesised) ───────────────────────────────────────────────────

function useKbtAudio(volume: number) {
    const ctxRef = useRef<AudioContext | null>(null);
    const volRef = useRef(volume);
    useEffect(() => { volRef.current = volume; }, [volume]);
    useEffect(() => () => { ctxRef.current?.close().catch(() => {}); ctxRef.current = null; }, []);

    const ensure = useCallback((): AudioContext | null => {
        if (volRef.current <= 0) return null;
        try {
            if (!ctxRef.current) {
                const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                ctxRef.current = new Ctx();
            }
            if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {});
            return ctxRef.current;
        } catch { return null; }
    }, []);

    const note = useCallback((ctx: AudioContext, f: number, at: number, dur: number, type: OscillatorType, g: number, f2?: number) => {
        const o = ctx.createOscillator(), a = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, ctx.currentTime + at);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime + at + dur);
        const peak = g * volRef.current;
        a.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        a.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), ctx.currentTime + at + 0.02);
        a.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
        o.connect(a); a.connect(ctx.destination);
        o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + dur + 0.05);
    }, []);

    return useMemo(() => ({
        unlock: () => { ensure(); },
        tick: () => { const c = ensure(); if (c) note(c, 900, 0, 0.05, 'square', 0.05); },
        spin: () => { const c = ensure(); if (c) note(c, 520 + Math.random() * 300, 0, 0.06, 'triangle', 0.09); },
        land: () => { const c = ensure(); if (!c) return; note(c, 660, 0, 0.18, 'sine', 0.2); note(c, 990, 0.1, 0.3, 'sine', 0.2); },
        lock: () => { const c = ensure(); if (!c) return; note(c, 440, 0, 0.12, 'triangle', 0.22); note(c, 660, 0.1, 0.25, 'triangle', 0.22); },
        lifeline: () => { const c = ensure(); if (!c) return; [523, 659, 784].forEach((f, i) => note(c, f, i * 0.08, 0.2, 'sine', 0.18)); },
        correct: () => { const c = ensure(); if (!c) return; [523, 659, 784, 1047].forEach((f, i) => { note(c, f, i * 0.11, 0.5, 'triangle', 0.22); note(c, f * 2, i * 0.11, 0.4, 'sine', 0.08); }); },
        wrong: () => { const c = ensure(); if (!c) return; note(c, 220, 0, 0.9, 'sawtooth', 0.16, 70); note(c, 165, 0.05, 0.9, 'square', 0.1, 55); },
        buzzer: () => { const c = ensure(); if (!c) return; note(c, 130, 0, 0.8, 'square', 0.2); note(c, 98, 0, 0.8, 'sawtooth', 0.16); },
        fanfare: () => {
            const c = ensure(); if (!c) return;
            [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => note(c, f, i * 0.16, 0.45, 'triangle', 0.22));
        },
        /** A tense heartbeat-and-drone; returns a function that stops it. */
        suspense: (sec: number) => {
            const c = ensure(); if (!c) return () => {};
            const stops: (() => void)[] = [];
            const drone = c.createOscillator(), dg = c.createGain();
            drone.type = 'sawtooth'; drone.frequency.value = 55;
            dg.gain.setValueAtTime(0.0001, c.currentTime);
            dg.gain.exponentialRampToValueAtTime(0.06 * volRef.current + 0.0002, c.currentTime + sec * 0.8);
            drone.connect(dg); dg.connect(c.destination); drone.start();
            stops.push(() => { try { dg.gain.cancelScheduledValues(c.currentTime); dg.gain.setTargetAtTime(0.0001, c.currentTime, 0.05); drone.stop(c.currentTime + 0.3); } catch { /* already stopped */ } });
            for (let t = 0; t < sec; t += 0.55 - Math.min(0.3, t * 0.1)) { note(c, 70, t, 0.18, 'sine', 0.35); note(c, 62, t + 0.17, 0.18, 'sine', 0.25); }
            return () => stops.forEach(s => s());
        },
    }), [ensure, note]);
}

function speakQuestion(text: string, volume: number, onDone: () => void): () => void {
    let finished = false;
    const done = () => { if (!finished) { finished = true; onDone(); } };
    try {
        if (volume <= 0 || typeof window === 'undefined' || !('speechSynthesis' in window)) { const t = setTimeout(done, 1200); return () => clearTimeout(t); }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = /[ऀ-ॿ]/.test(text) ? 'hi-IN' : 'en-IN';
        u.rate = 0.95; u.volume = volume;
        u.onend = done; u.onerror = done;
        window.speechSynthesis.speak(u);
        const guard = setTimeout(done, 9000);
        return () => { clearTimeout(guard); window.speechSynthesis.cancel(); };
    } catch { const t = setTimeout(done, 1200); return () => clearTimeout(t); }
}

// KBT's own emblem: a game-show marquee - a ring of chasing bulbs around a dark stage disc,
// an orbit of the four answer letters, and a big glossy gold "KBT" with a lightning spark.
function KbtLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
    const id = useId().replace(/:/g, '');
    const BULBS = 24;
    return (
        <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label="KBT" style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fffbe0" /><stop offset="0.42" stopColor="#FFD54A" /><stop offset="0.58" stopColor="#E09A12" /><stop offset="1" stopColor="#7a4a00" />
                </linearGradient>
                <radialGradient id={`d${id}`} cx="0.5" cy="0.38" r="0.65">
                    <stop offset="0" stopColor="#3b1fb0" /><stop offset="0.6" stopColor="#170a55" /><stop offset="1" stopColor="#06021f" />
                </radialGradient>
                <linearGradient id={`kf${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ffffff" /><stop offset="0.6" stopColor="#eef1f6" /><stop offset="1" stopColor="#b8c0cf" />
                </linearGradient>
                <radialGradient id={`sy${id}`} cx="0.5" cy="0.45" r="0.6">
                    <stop offset="0" stopColor="#fff6c2" /><stop offset="0.5" stopColor="#FFD54A" /><stop offset="1" stopColor="#E09A12" />
                </radialGradient>
                <linearGradient id={`wg${id}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#F5C84B" />
                </linearGradient>
                <linearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ff4fd8" /><stop offset="0.5" stopColor="#7c5cff" /><stop offset="1" stopColor="#22d3ee" />
                </linearGradient>
            </defs>

            {/* marquee ring */}
            <circle cx="50" cy="50" r="48" fill="#0b0533" stroke={`url(#g${id})`} strokeWidth="2.4" />
            {Array.from({ length: BULBS }, (_, i) => {
                const a = (i / BULBS) * Math.PI * 2;
                return (
                    <circle key={i} cx={50 + 43.5 * Math.cos(a)} cy={50 + 43.5 * Math.sin(a)} r="2" fill="#fff3b0">
                        <animate attributeName="opacity" values="1;0.2;0.2;1" dur="1.2s" begin={`${-(i % 3) * 0.4}s`} repeatCount="indefinite" />
                    </circle>
                );
            })}
            <circle cx="50" cy="50" r="39" fill={`url(#d${id})`} stroke={`url(#g${id})`} strokeWidth="1.4" />

            {/* dashed orbit ring */}
            <g>
                <circle cx="50" cy="50" r="33" fill="none" stroke={`url(#wg${id})`} strokeWidth="1.5" strokeDasharray="5 3.5" />
                <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="14s" repeatCount="indefinite" />
            </g>

            {/* golden star inside the badge, above KBT (emoji-style: fat, rounded, yellow with orange edge) */}
            <polygon points="50.00,8.90 52.53,14.02 58.18,14.84 54.09,18.83 55.05,24.46 50.00,21.80 44.95,24.46 45.91,18.83 41.82,14.84 47.47,14.02" fill={`url(#sy${id})`} stroke={`url(#sy${id})`} strokeWidth="2" strokeLinejoin="round" />
            <polygon points="31.50,15.00 33.12,18.28 36.73,18.80 34.12,21.35 34.73,24.95 31.50,23.25 28.27,24.95 28.88,21.35 26.27,18.80 29.88,18.28" transform="rotate(-18 31.5 20.5)" fill={`url(#sy${id})`} stroke={`url(#sy${id})`} strokeWidth="1.4" strokeLinejoin="round" />
            <polygon points="68.50,15.00 70.12,18.28 73.73,18.80 71.12,21.35 71.73,24.95 68.50,23.25 65.27,24.95 65.88,21.35 63.27,18.80 66.88,18.28" transform="rotate(18 68.5 20.5)" fill={`url(#sy${id})`} stroke={`url(#sy${id})`} strokeWidth="1.4" strokeLinejoin="round" />
            {/* KBT wordmark: flat white face with a gold border */}
            <text x="50" y="59" textAnchor="middle" fontSize="34.5" fontWeight="900" fontFamily="Georgia, 'Times New Roman', serif" fill={`url(#kf${id})`} stroke={`url(#g${id})`} strokeWidth="2" strokeLinejoin="round" paintOrder="stroke" letterSpacing="0.5">KBT</text>
            <path id={`arc${id}`} d="M20 50 A30 30 0 0 0 80 50" fill="none" />
            <text fontSize="8.5" fontWeight="900" fontFamily="Georgia, 'Times New Roman', serif" fill="#ffffff" letterSpacing="2.2">
                <textPath href={`#arc${id}`} startOffset="50%" textAnchor="middle">TOPPER</textPath>
            </text>
        </svg>
    );
}

// ── Small visual parts ─────────────────────────────────────────────────────────

const HEX = 'polygon(3.5% 0, 96.5% 0, 100% 50%, 96.5% 100%, 3.5% 100%, 0 50%)';
type OptState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim' | 'gone';

const FILL: Record<OptState, string> = {
    idle: 'linear-gradient(180deg,#2433a8 0%,#0d1455 100%)',
    selected: 'linear-gradient(180deg,#f59e0b 0%,#b45309 100%)',
    correct: 'linear-gradient(180deg,#22c55e 0%,#047857 100%)',
    wrong: 'linear-gradient(180deg,#ef4444 0%,#991b1b 100%)',
    dim: 'linear-gradient(180deg,#1b2370 0%,#0a0f3d 100%)',
    gone: 'linear-gradient(180deg,#1b2370 0%,#0a0f3d 100%)',
};

function Hex({ children, state = 'idle', onClick, disabled, className = '', height }: {
    children: React.ReactNode; state?: OptState; onClick?: () => void; disabled?: boolean; className?: string; height?: string;
}) {
    const pulse = state === 'selected';
    return (
        <motion.button type="button" onClick={onClick} disabled={disabled || state === 'gone'}
            animate={{ opacity: state === 'gone' ? 0 : state === 'dim' ? 0.55 : 1, scale: pulse ? [1, 1.02, 1] : 1 }}
            transition={pulse ? { repeat: Infinity, duration: 0.7 } : { duration: 0.35 }}
            whileHover={!disabled && state === 'idle' ? { scale: 1.02 } : undefined}
            className={`relative block w-full text-left ${className}`}
            style={{ height: height ?? '100%', pointerEvents: state === 'gone' ? 'none' : undefined, filter: state === 'correct' ? 'drop-shadow(0 0 14px rgba(34,197,94,0.9))' : pulse ? 'drop-shadow(0 0 12px rgba(245,158,11,0.8))' : state === 'wrong' ? 'drop-shadow(0 0 12px rgba(239,68,68,0.8))' : undefined }}>
            <span className="absolute inset-0" style={{ clipPath: HEX, background: 'linear-gradient(180deg,#fff3b0,#c9a24a 45%,#7a5a14)' }} />
            <span className="absolute flex items-center" style={{ inset: 3, clipPath: HEX, background: FILL[state] }}>
                <span className="px-[4%] w-full">{children}</span>
            </span>
        </motion.button>
    );
}

// Half-round countdown gauge that sits on the top edge of the question card.
function TimerRing({ left, total }: { left: number; total: number }) {
    const id = useId().replace(/:/g, '');
    const LEN = Math.PI * 35;
    const frac = Math.max(0, Math.min(1, left / total));
    const color = left > 15 ? '#4ADE80' : left > 8 ? '#FBBF24' : '#F87171';
    const tx = 50 - 35 * Math.cos(Math.PI * frac);
    const ty = 54 - 35 * Math.sin(Math.PI * frac);
    return (
        <motion.div animate={left <= 8 && left > 0 ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ repeat: Infinity, duration: 0.6 }}
            style={{ width: 'clamp(100px,min(13.5vw,21vh),190px)', transformOrigin: '50% 100%', filter: `drop-shadow(0 -2px 14px ${color}66)` }}>
            <svg viewBox="0 0 100 54" className="w-full block" style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id={`tg${id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#fffbe0" /><stop offset="0.45" stopColor="#F5C84B" /><stop offset="1" stopColor="#8a5a00" />
                    </linearGradient>
                    <radialGradient id={`tb${id}`} cx="0.5" cy="1" r="1">
                        <stop offset="0" stopColor="#3a22a8" /><stop offset="0.6" stopColor="#120a45" /><stop offset="1" stopColor="#04021a" />
                    </radialGradient>
                    <linearGradient id={`tk${id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#ffffff" /><stop offset="0.6" stopColor="#eef1f6" /><stop offset="1" stopColor="#b8c0cf" />
                    </linearGradient>
                </defs>
                {/* metal rim (double ring) */}
                <path d="M0 54 A50 50 0 0 1 100 54 Z" fill={`url(#tg${id})`} />
                <path d="M3 54 A47 47 0 0 1 97 54 Z" fill="#0b0533" />
                <path d="M5 54 A45 45 0 0 1 95 54 Z" fill={`url(#tb${id})`} />
                <g transform="translate(0 -4)">
                {/* track + progress */}
                <path d="M15 54 A35 35 0 0 1 85 54" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5.5" strokeLinecap="round" />
                <path d="M15 54 A35 35 0 0 1 85 54" fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round"
                    strokeDasharray={LEN} strokeDashoffset={LEN * (1 - frac)} style={{ transition: 'stroke-dashoffset 0.2s linear, stroke 0.3s' }} />
                {frac > 0 && <circle cx={tx} cy={ty} r="3.2" fill="#fff" style={{ transition: 'cx 0.2s linear, cy 0.2s linear' }} />}
                <text x="50" y="49" textAnchor="middle" fontSize="25" fontWeight="900" fill={`url(#tk${id})`} stroke={`url(#tg${id})`} strokeWidth="1.5" strokeLinejoin="round" paintOrder="stroke"
                    fontFamily="Georgia, 'Times New Roman', serif" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.ceil(left)}</text>
                </g>
            </svg>
        </motion.div>
    );
}

function Confetti() {
    const bits = useMemo(() => Array.from({ length: 70 }, (_, i) => {
        const r = (k: number) => Math.abs(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
        return { x: r(1) * 100, d: 2.4 + r(2) * 2.2, delay: r(3) * 1.8, rot: r(4) * 720 - 360, s: 6 + r(5) * 8, c: ['#F5C84B', '#F472B6', '#60A5FA', '#34D399', '#FB923C', '#A78BFA'][i % 6] };
    }), []);
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {bits.map((b, i) => (
                <motion.span key={i} className="absolute rounded-sm" style={{ left: `${b.x}%`, top: -20, width: b.s, height: b.s * 0.6, background: b.c }}
                    initial={{ y: -30, rotate: 0, opacity: 1 }} animate={{ y: '110vh', rotate: b.rot, opacity: [1, 1, 0.8] }}
                    transition={{ duration: b.d, delay: b.delay, ease: 'easeIn', repeat: Infinity, repeatDelay: 0.5 }} />
            ))}
        </div>
    );
}

// Sweeping stage spotlights from the top of the stage.
function StageLights() {
    const beams = [
        { x: 12, c: '255,214,102', from: -28, to: 22, d: 7, delay: 0 },
        { x: 32, c: '150,130,255', from: 18, to: -24, d: 9, delay: 1.2 },
        { x: 68, c: '255,120,190', from: -20, to: 26, d: 8, delay: 0.6 },
        { x: 88, c: '110,200,255', from: 24, to: -22, d: 10, delay: 2 },
    ];
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ mixBlendMode: 'screen' }}>
            {beams.map((b, i) => (
                <motion.div key={i} className="absolute top-[-4%]"
                    style={{
                        left: `${b.x}%`, width: '22vw', height: '120%', marginLeft: '-11vw', transformOrigin: '50% 0%',
                        background: `linear-gradient(180deg, rgba(${b.c},0.55) 0%, rgba(${b.c},0.16) 45%, rgba(${b.c},0) 85%)`,
                        clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)', filter: 'blur(5px)',
                    }}
                    animate={{ rotate: [b.from, b.to, b.from], opacity: [0.55, 1, 0.55] }}
                    transition={{ duration: b.d, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }} />
            ))}
            {beams.map((b, i) => (
                <motion.span key={`l${i}`} className="absolute rounded-full"
                    style={{ left: `${b.x}%`, top: 0, width: 26, height: 26, marginLeft: -13, marginTop: -13, background: `rgba(${b.c},0.95)`, boxShadow: `0 0 30px 12px rgba(${b.c},0.6)` }}
                    animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2 + i * 0.4, repeat: Infinity }} />
            ))}
        </div>
    );
}

function Stars() {
    const dots = useMemo(() => Array.from({ length: 46 }, (_, i) => {
        const r = (k: number) => Math.abs(Math.sin(i * 91.3458 + k * 47.233) * 24634.6345) % 1;
        return { x: r(1) * 100, y: r(2) * 100, s: 1 + r(3) * 2.2, d: 2 + r(4) * 3, o: r(5) };
    }), []);
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {dots.map((d, i) => (
                <motion.span key={i} className="absolute rounded-full bg-white" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s }}
                    animate={{ opacity: [0.15, 0.9, 0.15] }} transition={{ duration: d.d, repeat: Infinity, delay: d.o * 3 }} />
            ))}
            <StageLights />
        </div>
    );
}

// ── The game ───────────────────────────────────────────────────────────────────

type Stage = 'intro' | 'spin' | 'seat' | 'asking' | 'suspense' | 'reveal' | 'end';
type Outcome = 'right' | 'wrong' | 'time';
type Lifelines = { fifty: boolean; poll: boolean; call: boolean; dip: boolean };

const CHEER = ['Bilkul sahi! 🎉', 'Shandar jawab! 👏', 'Kya baat hai! 🌟', 'Topper wali baat! 🏆'];
const OOPS = ['Koi baat nahi, koshish achhi thi! 💪', 'Bas thoda sa chook gaye! 🙂', 'Agli baar pakka! 👍'];

export function KBTQuiz({ questions: rawQuestions, totalStudents, narrationVolume, onClose }: {
    questions: KbtQuestion[]; totalStudents: number; narrationVolume: number; onClose: () => void;
}) {
    // Every question in the game has exactly 4 options: extras are dropped (the right answer is always kept),
    // and any question with fewer than 4 options is skipped.
    const questions = useMemo<KbtQuestion[]>(() => rawQuestions.filter(q => q.options.length >= 4).map(q => {
        const opts = [...q.options];
        let ans = q.answer;
        if (ans >= 4) { [opts[3], opts[ans]] = [opts[ans], opts[3]]; ans = 3; }
        return { ...q, options: opts.slice(0, 4), answer: ans };
    }), [rawQuestions]);
    const n = questions.length;
    const ladder = useMemo(() => buildLadder(n), [n]);
    const checkpoints = useMemo(() => buildCheckpoints(n), [n]);
    const [sfx, setSfx] = useState({ volume: 0.7, muted: false });
    const audio = useKbtAudio(sfx.muted ? 0 : sfx.volume);

    const [stage, setStage] = useState<Stage>('intro');
    const [qi, setQi] = useState(0);
    const [roll, setRoll] = useState<number | null>(null);
    const [used, setUsed] = useState<number[]>([]);
    const [absent, setAbsent] = useState<number[]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [hidden, setHidden] = useState<number[]>([]);
    const [wrongPicks, setWrongPicks] = useState<number[]>([]);
    const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
    const [ready, setReady] = useState(false);
    const [modal, setModal] = useState<'poll' | 'call' | null>(null);
    const [poll, setPoll] = useState<number[]>([]);
    const [pollPhase, setPollPhase] = useState<'vote' | 'result'>('vote');
    const [pollVotes, setPollVotes] = useState<number[]>([0, 0, 0, 0]); // how many students picked each option
    const [callLeft, setCallLeft] = useState(CALL_SECONDS);
    const [life, setLife] = useState<Lifelines>({ fifty: false, poll: false, call: false, dip: false });
    const [dipActive, setDipActive] = useState(false);
    const [pot, setPot] = useState(0);
    const [safe, setSafe] = useState(0);
    const [results, setResults] = useState<Outcome[]>([]);
    const [outcome, setOutcome] = useState<Outcome | null>(null);
    const [msg, setMsg] = useState('');
    const [mounted, setMounted] = useState(false);
    const [full, setFull] = useState(false);
    // Review of answered questions: who answered, what they picked, what was right.
    type Rec = { qi: number; roll: number | null; pick: number | null; outcome: Outcome; lives: (keyof Lifelines)[] };
    const [history, setHistory] = useState<Rec[]>([]);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [pendingLife, setPendingLife] = useState<keyof Lifelines | null>(null);
    const [lifeThisQ, setLifeThisQ] = useState<(keyof Lifelines)[]>([]); // lifelines used on the current question
    const [reviewIdx, setReviewIdx] = useState(0);
    // The stage sits below the top bar + nav: it fills exactly the page's <main> area.
    const [box, setBox] = useState<{ top: number; left: number; right: number; bottom: number; headTop: number }>({ top: 0, left: 0, right: 0, bottom: 0, headTop: 0 });
    useEffect(() => {
        const measure = () => {
            const m = document.querySelector('main');
            const r = m?.getBoundingClientRect();
            const h = document.querySelector('header')?.getBoundingClientRect();
            setBox({ top: r ? Math.max(0, r.top) : 0, left: 0, right: 0, bottom: 0, headTop: h ? Math.max(0, h.bottom + 8) : r ? Math.max(0, r.top) : 0 });
        };
        measure();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    const q = questions[qi];
    const running = stage === 'asking' && ready && !modal && !pendingLife && !reviewOpen;

    // ── clock ──────────────────────────────────────────────────────────────────
    const timeUpRef = useRef<() => void>(() => {});
    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => {
            setTimeLeft(t => {
                const next = Math.max(0, +(t - 0.1).toFixed(1));
                if (next <= 0) setTimeout(() => timeUpRef.current(), 0);
                return next;
            });
        }, 100);
        return () => clearInterval(id);
    }, [running]);
    useEffect(() => {
        if (!running || timeLeft > 10 || timeLeft <= 0) return;
        if (Math.abs(timeLeft - Math.round(timeLeft)) < 0.06) audio.tick();
    }, [timeLeft, running, audio]);

    // ── phone-a-friend clock ───────────────────────────────────────────────────
    useEffect(() => {
        if (modal !== 'call') return;
        const id = setInterval(() => setCallLeft(t => Math.max(0, t - 1)), 1000);
        return () => clearInterval(id);
    }, [modal]);

    // ── narration of the question ──────────────────────────────────────────────
    useEffect(() => {
        if (stage !== 'asking' || ready || !q) return;
        return speakQuestion(q.question, narrationVolume, () => setReady(true));
    }, [stage, ready, q, narrationVolume]);

    useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* none */ } }, []);

    // ── roll-number picker ─────────────────────────────────────────────────────
    const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (spinTimer.current) clearTimeout(spinTimer.current); }, []);

    const spin = (extraAbsent?: number) => {
        const gone = new Set([...absent, ...(extraAbsent ? [extraAbsent] : [])]);
        let pool = Array.from({ length: totalStudents }, (_, i) => i + 1).filter(r => !gone.has(r) && !used.includes(r));
        if (pool.length === 0) { // everyone has had a turn - start another round (absentees still skipped)
            setUsed([]);
            pool = Array.from({ length: totalStudents }, (_, i) => i + 1).filter(r => !gone.has(r));
        }
        if (pool.length === 0) { setMsg('All roll numbers are marked absent.'); return; }
        const target = pool[Math.floor(Math.random() * pool.length)];
        setStage('spin');
        let i = 0;
        const steps = 22;
        const step = () => {
            i++;
            if (i >= steps) {
                setRoll(target);
                audio.land();
                setStage('seat');
                return;
            }
            setRoll(pool[Math.floor(Math.random() * pool.length)]);
            audio.spin();
            spinTimer.current = setTimeout(step, 55 + i * i * 0.55);
        };
        step();
    };

    // ── asking ─────────────────────────────────────────────────────────────────
    const beginQuestion = () => {
        if (roll !== null) setUsed(u => (u.includes(roll) ? u : [...u, roll]));
        setSelected(null); setHidden([]); setWrongPicks([]); setDipActive(false); setLifeThisQ([]);
        setTimeLeft(QUESTION_SECONDS); setReady(false); setOutcome(null); setMsg('');
        setStage('asking');
    };

    const stopSuspense = useRef<() => void>(() => {});
    const resolve = useCallback((pick: number | null, timedOut: boolean) => {
        stopSuspense.current();
        const right = !timedOut && pick === q.answer;
        // Double Dip: a first wrong answer gets a second chance.
        if (!right && !timedOut && dipActive && pick !== null) {
            setWrongPicks(w => [...w, pick]);
            setDipActive(false); setSelected(null);
            setMsg('Double Dip! Ek aur mauka — dusra option chuniye ✌️');
            audio.wrong();
            setStage('asking');
            return;
        }
        const o: Outcome = right ? 'right' : timedOut ? 'time' : 'wrong';
        setOutcome(o);
        setHistory(h => [...h.filter(r => r.qi !== qi), { qi, roll, pick: timedOut ? null : pick, outcome: o, lives: lifeThisQ }]);
        setResults(r => [...r, o]);
        if (right) {
            const penalty = Math.min(1, lifeThisQ.reduce((a, k) => a + LIFE_COST[k], 0));
            const earned = Math.max(safe, Math.round(ladder[qi] * (1 - penalty)));
            setPot(earned);
            if (checkpoints.has(qi)) setSafe(earned);
            const lost = ladder[qi] - earned;
            setMsg(CHEER[qi % CHEER.length] + (lost > 0 ? ` · lifelines cost ${pts(lost)} pts` : ''));
            audio.correct();
        } else {
            setPot(safe);
            setMsg(timedOut ? "Time's up! ⏰" : OOPS[qi % OOPS.length]);
            if (timedOut) audio.buzzer(); else audio.wrong();
        }
        setStage('reveal');
    }, [q, dipActive, ladder, qi, checkpoints, safe, audio, roll, lifeThisQ]);

    useEffect(() => { timeUpRef.current = () => { if (stage === 'asking') resolve(null, true); }; }, [stage, resolve]);

    const lockIn = () => {
        if (selected === null) return;
        audio.lock();
        setStage('suspense');
        stopSuspense.current = audio.suspense(3);
        setTimeout(() => resolve(selected, false), 3000);
    };

    const next = () => {
        if (qi + 1 >= n) { setStage('end'); audio.fanfare(); return; }
        setQi(i => i + 1);
        spin();
    };

    const restart = () => {
        setStage('intro'); setQi(0); setRoll(null); setUsed([]); setAbsent([]); setSelected(null); setHidden([]); setWrongPicks([]);
        setLife({ fifty: false, poll: false, call: false, dip: false }); setDipActive(false); setPot(0); setSafe(0); setResults([]); setOutcome(null); setMsg(''); setHistory([]); setReviewOpen(false); setPendingLife(null); setLifeThisQ([]);
    };

    // ── lifelines ──────────────────────────────────────────────────────────────
    const canUseLife = stage === 'asking' && !modal;
    const useFifty = () => {
        if (!canUseLife || lifeThisQ.includes('fifty')) return;
        const wrongs = q.options.map((_, i) => i).filter(i => i !== q.answer && !hidden.includes(i) && !wrongPicks.includes(i));
        const pick = wrongs.sort(() => Math.random() - 0.5).slice(0, 2);
        setHidden(h => [...h, ...pick]); setLife(l => ({ ...l, fifty: true })); setLifeThisQ(l => [...l, 'fifty']); audio.lifeline();
        if (selected !== null && pick.includes(selected)) setSelected(null);
    };
    const usePoll = () => {
        if (!canUseLife || lifeThisQ.includes('poll')) return;
        setPollVotes([0, 0, 0, 0]); setPollPhase('vote');
        setLife(l => ({ ...l, poll: true })); setLifeThisQ(l => [...l, 'poll']); setModal('poll'); audio.lifeline();
    };
    const pollAlive = (i: number) => !hidden.includes(i) && !wrongPicks.includes(i);
    const setVote = (i: number, v: number) => setPollVotes(arr => arr.map((x, k) => (k === i ? v : x)));
    const showPollResult = () => {
        const total = pollVotes.reduce((a, b) => a + b, 0);
        if (total <= 0) return;
        const shares = pollVotes.map(v => Math.round((v / total) * 100));
        const diff = 100 - shares.reduce((a, b) => a + b, 0);
        if (diff !== 0) { const top = shares.indexOf(Math.max(...shares)); shares[top] += diff; }
        setPoll(shares); setPollPhase('result'); audio.lifeline();
    };
    const useCall = () => {
        if (!canUseLife || lifeThisQ.includes('call')) return;
        setCallLeft(CALL_SECONDS); setLife(l => ({ ...l, call: true })); setLifeThisQ(l => [...l, 'call']); setModal('call'); audio.lifeline();
    };
    const useDip = () => {
        if (!canUseLife || lifeThisQ.includes('dip') || dipActive) return;
        setDipActive(true); setLife(l => ({ ...l, dip: true })); setLifeThisQ(l => [...l, 'dip']); setMsg('Double Dip chalu! Is sawal par do mauke ✌️'); audio.lifeline();
    };

    // ── keyboard: A-D choose, Enter locks ──────────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (stage !== 'asking' || !ready || modal || pendingLife || !q) return;
            const idx = OPTION_LABELS.indexOf(e.key.toUpperCase());
            if (idx >= 0 && idx < q.options.length && !hidden.includes(idx) && !wrongPicks.includes(idx)) { setSelected(idx); }
            if (e.key === 'Enter' && selected !== null) lockIn();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const optState = (i: number): OptState => {
        if (hidden.includes(i)) return 'gone';
        if (stage === 'reveal') return i === q.answer ? 'correct' : i === selected ? 'wrong' : 'dim';
        if (stage === 'suspense') return i === selected ? 'selected' : 'dim';
        if (wrongPicks.includes(i)) return 'wrong';
        return i === selected ? 'selected' : 'idle';
    };

    const rightCount = results.filter(r => r === 'right').length;
    const pct = n ? Math.round((rightCount / n) * 100) : 0;
    const lifeUsed = Object.values(life).filter(Boolean).length;

    if (!mounted) return null;

    const lifeBtn = (key: keyof Lifelines, label: string, icon: React.ReactNode, onClick: () => void, active?: boolean) => {
        const usedHere = lifeThisQ.includes(key); // each lifeline can be used once per question
        return (
            <button key={key} type="button" onClick={() => setPendingLife(key)} disabled={usedHere || !canUseLife} title={`${label} (costs ${Math.round(LIFE_COST[key] * 100)}% of the question's points)`}
                className="relative rounded-full flex flex-col items-center justify-center transition-all disabled:cursor-not-allowed"
                style={{
                    width: 'clamp(58px,5.8vw,82px)', height: 'clamp(58px,5.8vw,82px)',
                    background: active ? 'linear-gradient(180deg,#f59e0b,#b45309)' : 'radial-gradient(circle at 35% 30%, #3a46c8, #0d1455)',
                    border: `2.5px solid ${usedHere ? '#555' : GOLD}`, color: usedHere ? '#666' : '#fff', opacity: !canUseLife && !usedHere ? 0.6 : 1,
                    boxShadow: usedHere ? 'none' : '0 0 14px rgba(245,200,75,0.35)',
                }}>
                {icon}
                {usedHere && <span className="absolute inset-0 flex items-center justify-center text-red-500 font-black" style={{ fontSize: 'clamp(38px,4.2vw,58px)', lineHeight: 1 }}>✕</span>}
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 rounded-full text-[10px] font-black leading-[16px] whitespace-nowrap"
                    style={{ background: '#0b0533', border: `1px solid ${GOLD}88`, color: '#fca5a5' }}>−{Math.round(LIFE_COST[key] * 100)}%</span>
            </button>
        );
    };

    return createPortal(
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed text-white select-none overflow-hidden"
            style={{ zIndex: 60, top: full ? box.headTop : box.top, left: box.left, right: box.right, bottom: box.bottom, background: 'radial-gradient(ellipse at 50% 25%, #35208a 0%, #150c45 42%, #05031a 100%)', fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            <Stars />

            {/* hot seat tag + question counter: top-left corner on the question screens */}
            {(stage === 'asking' || stage === 'suspense' || stage === 'reveal') && (
                <div className="absolute left-4 top-3 z-20 flex flex-col items-start gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${GOLD}66` }}>
                        <span className="text-[10px] uppercase tracking-widest text-white/90">Hot seat</span>
                        <span className="font-black" style={{ color: GOLD, fontSize: 'clamp(14px,1.5vw,22px)' }}>Roll No. {roll}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)' }}>
                        Question {qi + 1}/{n} · <span style={{ color: GOLD }}>{pts(ladder[qi])} pts</span>
                    </div>
                </div>
            )}

            {/* top bar: title centred, close/sound/points on the right */}
            <div className="relative z-10 flex items-center justify-end gap-3 px-4 pt-3" style={{ minHeight: 52 }}>
                <div className="absolute left-1/2 -translate-x-1/2 top-5 flex items-center gap-2 pointer-events-none">
                    <KbtLogo size={38} className="relative -top-[5px]" />
                    <div className="leading-none text-center">
                        <p className="font-black tracking-wide whitespace-nowrap" style={{ fontSize: 'clamp(15px,1.9vw,28px)', background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                            KAUN BANEGA TOPPER
                        </p>
                        <p className="text-[10px] tracking-[0.3em] text-white/50 mt-1 relative -left-[23px]">K · B · T</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {stage !== 'intro' && (
                        <div className="text-right leading-tight px-3 py-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${GOLD}55` }}>
                            <p className="text-[9px] uppercase tracking-widest text-white/90">Class points</p>
                            <p className="font-black tabular-nums" style={{ color: GOLD, fontSize: 'clamp(16px,1.8vw,26px)' }}>{pts(pot)}</p>
                        </div>
                    )}
                    <button type="button" onClick={() => setFull(f => !f)} title={full ? 'Show nav' : 'Hide nav (expand)'}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20">
                        {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                    <button type="button" onClick={() => setSfx(s => ({ ...s, muted: !s.muted }))} title={sfx.muted ? 'Sound on' : 'Sound off'}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20">
                        {sfx.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    </button>
                    <button type="button" onClick={onClose} title="Close" className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-red-500/70"><X size={15} /></button>
                </div>
            </div>

            {/* lifelines: vertical column on the left */}
            {stage !== 'intro' && stage !== 'end' && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-[1.6vh]">
                    {lifeBtn('fifty', '50-50', <span className="font-black leading-none" style={{ fontSize: 'clamp(14px,1.45vw,20px)' }}>50:50</span>, useFifty)}
                    {lifeBtn('poll', 'Audience Poll', <Users size={26} />, usePoll)}
                    {lifeBtn('call', 'Phone a Friend', <Phone size={25} />, useCall)}
                    {lifeBtn('dip', 'Double Dip', <span className="font-black leading-none" style={{ fontSize: 'clamp(15px,1.5vw,21px)' }}>2×</span>, useDip, dipActive)}
                </div>
            )}

            {/* body */}
            <div className="relative z-10 h-[calc(100%-64px)] grid overflow-hidden" style={{ gridTemplateRows: 'minmax(0,1fr)', gridTemplateColumns: stage === 'intro' || stage === 'end' ? '1fr' : 'minmax(0,1fr) clamp(74px,7.8vw,114px)' }}>
                <div className="relative min-w-0 min-h-0 flex flex-col px-4 pb-3"
                    style={stage !== 'intro' && stage !== 'end' ? { paddingLeft: 'clamp(82px,7.6vw,108px)' } : undefined}>
                    <AnimatePresence mode="wait">
                        {stage === 'intro' && (
                            <motion.div key="intro" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="m-auto text-center max-w-2xl max-h-full">
                                <div className="flex justify-center"><KbtLogo size={110} className="h-[16vh] w-[16vh] max-h-[150px] max-w-[150px]" /></div>
                                <h1 className="font-black mt-1" style={{ fontSize: 'clamp(26px,8.5vh,68px)', lineHeight: 1.05, background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                                    Kaun Banega<br />Topper?
                                </h1>
                                <p className="mt-[2vh] text-white/70" style={{ fontSize: 'clamp(12px,2.2vh,18px)' }}>
                                    {n === 0 ? 'No questions with 4 options were found. Please generate again.' : `${n} questions`}{n > 0 && ' · 30 seconds per question · 4 lifelines · a new student in the hot seat every time!'}
                                </p>
                                <button type="button" disabled={n === 0} onClick={() => { audio.unlock(); audio.land(); spin(); }}
                                    className="mt-[3.5vh] px-9 py-[1.4vh] rounded-full font-black text-[#2a1a00] hover:scale-105 transition-transform disabled:opacity-40 disabled:hover:scale-100"
                                    style={{ fontSize: 'clamp(14px,2.4vh,22px)', background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)', boxShadow: '0 0 30px rgba(245,200,75,0.55)' }}>
                                    Let&apos;s play KBT ▶
                                </button>
                            </motion.div>
                        )}

                        {(stage === 'spin' || stage === 'seat') && (
                            <motion.div key="seat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="m-auto text-center">
                                <p className="uppercase tracking-[0.35em] text-white/95" style={{ fontSize: 'clamp(11px,1.1vw,15px)' }}>
                                    Question {qi + 1} / {n} · Who takes the hot seat?
                                </p>
                                <div className="mt-4 mx-auto flex items-center justify-center rounded-[28px]"
                                    style={{ width: 'clamp(150px,36vh,320px)', height: 'clamp(120px,30vh,260px)', background: 'linear-gradient(180deg,#2433a8,#0d1455)', border: `4px solid ${GOLD}`, boxShadow: `0 0 40px ${stage === 'seat' ? 'rgba(245,200,75,0.7)' : 'rgba(120,100,255,0.5)'}` }}>
                                    <div className="text-center">
                                        <p className="text-white/60 uppercase tracking-widest" style={{ fontSize: 'clamp(10px,1vw,14px)' }}>Roll No.</p>
                                        <motion.p key={roll} initial={{ y: -18, opacity: 0.2 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.08 }}
                                            className="font-black tabular-nums" style={{ fontSize: 'clamp(50px,15vh,130px)', lineHeight: 1, color: stage === 'seat' ? GOLD : '#fff' }}>
                                            {roll ?? '–'}
                                        </motion.p>
                                    </div>
                                </div>
                                {stage === 'seat' && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex items-center justify-center gap-3 flex-wrap">
                                        <button type="button" onClick={beginQuestion}
                                            className="px-7 py-3 rounded-full font-black text-[#052e16] hover:scale-105 transition-transform"
                                            style={{ background: 'linear-gradient(180deg,#86efac,#22c55e 60%,#15803d)', fontSize: 'clamp(14px,1.3vw,19px)' }}>
                                            Roll No. {roll} – Come to the hot seat ✓
                                        </button>
                                        <button type="button" onClick={() => { if (roll !== null) { setAbsent(a => [...a, roll]); spin(roll); } }}
                                            className="px-5 py-3 rounded-full font-bold bg-white/10 hover:bg-white/20 border border-white/20 flex items-center gap-2" style={{ fontSize: 'clamp(12px,1.1vw,16px)' }}>
                                            <RotateCcw size={14} /> Absent – spin again
                                        </button>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}

                        {(stage === 'asking' || stage === 'suspense' || stage === 'reveal') && q && (
                            <motion.div key={`q${qi}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
                                {/* question */}
                                <div className="flex-1 min-h-0 flex flex-col justify-center gap-[1.4vh] pt-2">
                                    <div className="shrink-0 flex items-center justify-center" style={{ height: 'clamp(24px,4vh,36px)' }}>
                                    <AnimatePresence>
                                        {msg && (
                                            <motion.p key={msg} initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                                                className="text-center font-black" style={{ fontSize: 'clamp(15px,1.8vw,26px)', color: stage === 'reveal' && outcome === 'right' ? '#86efac' : stage === 'reveal' ? '#fca5a5' : GOLD }}>
                                                {msg}
                                            </motion.p>
                                        )}
                                    </AnimatePresence>
                                    </div>
                                    <div className="shrink-0 relative" style={{ height: 'clamp(78px,17.5vh,160px)', marginTop: 'clamp(54px,min(7.3vw,11.4vh),103px)' }}>
                                        <div className="absolute left-1/2 top-[3px] -translate-x-1/2 -translate-y-full z-10">
                                            <TimerRing left={timeLeft} total={QUESTION_SECONDS} />
                                        </div>
                                        <Hex height="100%">
                                            <p className="text-center font-bold leading-snug line-clamp-4 overflow-hidden" style={{ fontSize: q.question.length > 170 ? 'clamp(11px,min(1.3vw,2.4vh),20px)' : q.question.length > 100 ? 'clamp(12px,min(1.7vw,3vh),26px)' : 'clamp(13px,min(2vw,3.4vh),30px)' }}>{q.question}</p>
                                        </Hex>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-[2vw] gap-y-[1.2vh] shrink-0" style={{ height: 'clamp(96px,18.5vh,172px)', gridTemplateRows: 'repeat(2, minmax(0,1fr))' }}>
                                        {q.options.map((opt, i) => (
                                            <div key={i} className="min-h-0">
                                                <Hex state={optState(i)} disabled={stage !== 'asking' || !ready || !!modal || wrongPicks.includes(i)}
                                                    onClick={() => { setSelected(i); audio.tick(); }}>
                                                    <span className="flex items-center gap-3 font-semibold" style={{ fontSize: opt.length > 60 ? 'clamp(10px,min(1.15vw,2vh),16px)' : opt.length > 32 ? 'clamp(11px,min(1.35vw,2.3vh),19px)' : 'clamp(12px,min(1.6vw,2.8vh),23px)' }}>
                                                        <span className="font-black" style={{ color: GOLD }}>{OPTION_LABELS[i]}:</span>
                                                        <span className="leading-snug line-clamp-2 overflow-hidden">{opt}</span>
                                                    </span>
                                                </Hex>
                                            </div>
                                        ))}
                                    </div>

                                    {/* lock / next */}
                                    <div className="shrink-0 flex items-center justify-center gap-3" style={{ height: 44 }}>
                                        {stage === 'asking' && selected !== null && (
                                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
                                                <span className="text-white/80 font-semibold" style={{ fontSize: 'clamp(13px,1.3vw,18px)' }}>Option {OPTION_LABELS[selected]} — lock kiya jaye?</span>
                                                <button type="button" onClick={lockIn} className="px-6 py-2 rounded-full font-black text-[#2a1a00] hover:scale-105 transition-transform"
                                                    style={{ background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)', fontSize: 'clamp(13px,1.3vw,18px)' }}>
                                                    Lock kijiye 🔒
                                                </button>
                                            </motion.div>
                                        )}
                                        {stage === 'asking' && selected === null && ready && (
                                            <span className="text-white/45" style={{ fontSize: 'clamp(11px,1.1vw,15px)' }}>Choose an option (A / B / C / D) · Press Enter to lock</span>
                                        )}
                                        {stage === 'asking' && !ready && <span className="text-white/45 animate-pulse" style={{ fontSize: 'clamp(11px,1.1vw,15px)' }}>🎙️ Reading the question…</span>}
                                        {stage === 'suspense' && <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.8 }} className="font-black tracking-widest" style={{ color: GOLD, fontSize: 'clamp(14px,1.6vw,22px)' }}>LOCKED…</motion.span>}
                                        {stage === 'reveal' && (
                                            <div className="flex items-center gap-2.5 relative -left-3">
                                            {qi > 0 && (
                                                <button type="button" onClick={() => { setReviewIdx(Math.max(0, history.filter(r => r.qi < qi).length - 1)); setReviewOpen(true); }}
                                                    className="px-4 py-2 rounded-full font-bold flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/25 transition-colors" style={{ fontSize: 'clamp(11px,1.05vw,15px)' }}>
                                                    <History size={14} /> Previous questions
                                                </button>
                                            )}
                                            <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} type="button" onClick={next}
                                                className="px-5 py-2 rounded-full font-black flex items-center gap-1.5 hover:scale-105 transition-transform"
                                                style={{ background: 'linear-gradient(180deg,#a5b4fc,#6366f1 60%,#3730a3)', fontSize: 'clamp(11px,1.05vw,15px)' }}>
                                                {qi + 1 >= n ? 'See result' : 'Next question'} <ArrowRight size={14} />
                                            </motion.button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="shrink-0 px-6 flex items-start justify-center" style={{ height: 'clamp(30px,5vh,46px)' }}>
                                        {stage === 'reveal' && q.explanation && (
                                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-white/70 line-clamp-2" style={{ fontSize: 'clamp(11px,1.1vw,15px)' }}>
                                                💡 {q.explanation}
                                            </motion.p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {stage === 'end' && (
                            <motion.div key="end" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="m-auto text-center max-w-xl">
                                <Confetti />
                                <div className="flex justify-center"><KbtLogo size={120} className="h-[18vh] w-[18vh] max-h-[150px] max-w-[150px]" /></div>
                                <h2 className="font-black" style={{ fontSize: 'clamp(26px,4vw,56px)', background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                                    {pct >= 80 ? 'Class Topper! 🌟' : pct >= 50 ? 'Shandar khel! 👏' : 'Achhi koshish! 💪'}
                                </h2>
                                <div className="mt-5 mx-auto rounded-3xl px-8 py-5 inline-block" style={{ background: 'rgba(0,0,0,0.4)', border: `2px solid ${GOLD}` }}>
                                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Class final points</p>
                                    <p className="font-black tabular-nums" style={{ color: GOLD, fontSize: 'clamp(36px,5vw,70px)', lineHeight: 1.1 }}>{pts(pot)}</p>
                                    <div className="flex items-center justify-center gap-6 mt-2 text-white/80" style={{ fontSize: 'clamp(12px,1.2vw,17px)' }}>
                                        <span><Check size={14} className="inline -mt-0.5 text-green-400" /> {rightCount}/{n} correct ({pct}%)</span>
                                        <span>🛟 {lifeUsed}/4 lifelines used</span>
                                    </div>
                                </div>
                                <div className="mt-7 flex items-center justify-center gap-3">
                                    <button type="button" onClick={restart} className="px-6 py-2.5 rounded-full font-bold bg-white/10 hover:bg-white/20 border border-white/20 flex items-center gap-2"><RotateCcw size={14} /> Play again</button>
                                    <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-full font-black text-[#2a1a00]" style={{ background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)' }}>Close</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ladder */}
                {stage !== 'intro' && stage !== 'end' && (
                    <div className="relative pr-3 pb-4 pt-2 flex flex-col justify-center gap-[0.8vh] min-h-0">
                        {[...ladder].map((p, i) => ({ p, i })).reverse().map(({ p, i }) => {
                            const cp = checkpoints.has(i);
                            const cur = i === qi;
                            const done = results[i] !== undefined && i < qi + (stage === 'reveal' ? 1 : 0);
                            return (
                                <div key={i} className="flex items-center justify-between rounded-lg px-3 font-black tabular-nums"
                                    style={{
                                        height: 'clamp(22px,4.6vh,40px)', fontSize: 'clamp(11px,1.25vw,18px)',
                                        background: cur ? 'linear-gradient(90deg,#f59e0b,#b45309)' : 'rgba(0,0,0,0.3)',
                                        border: `1px solid ${cur ? '#fde68a' : cp ? GOLD + '88' : 'rgba(255,255,255,0.08)'}`,
                                        color: cur ? '#fff' : done ? (results[i] === 'right' ? '#86efac' : '#fca5a5') : cp ? GOLD : 'rgba(255,255,255,0.65)',
                                        boxShadow: cur ? '0 0 14px rgba(245,158,11,0.7)' : undefined,
                                    }}>
                                    <span className="opacity-70 text-[0.8em]">{i + 1}</span>
                                    <span>{cp ? '◆ ' : ''}{short(p)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* lifeline modals */}
            <AnimatePresence>
                {modal === 'poll' && (
                    <motion.div key="poll" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center px-4" style={{ background: 'rgba(5,3,26,0.82)' }}>
                        <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} className="rounded-3xl px-7 py-6 w-[min(560px,94vw)]" style={{ background: 'linear-gradient(180deg,#1b2370,#0a0f3d)', border: `3px solid ${GOLD}` }}>
                            <p className="text-center font-black text-xl" style={{ color: GOLD, fontFamily: "Georgia, 'Times New Roman', serif" }}>Audience Poll</p>
                            {pollPhase === 'vote' ? (() => {
                                const total = pollVotes.reduce((x, y) => x + y, 0);
                                return (
                                    <>
                                        <p className="text-center text-white/75 text-xs mt-1 leading-snug">Ask the class for each option: &quot;How many chose this one?&quot; Set the number with the slider.</p>
                                        <div className="mt-4 flex flex-col gap-2.5">
                                            {q.options.map((o, i) => {
                                                const on = pollAlive(i);
                                                return (
                                                    <div key={i} className="rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', opacity: on ? 1 : 0.35 }}>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-black w-6 text-lg" style={{ color: GOLD, fontFamily: "Georgia, 'Times New Roman', serif" }}>{OPTION_LABELS[i]}</span>
                                                            <span className="flex-1 text-sm leading-snug line-clamp-1">{o}</span>
                                                            <span className="font-black tabular-nums text-xl w-10 text-right" style={{ color: GOLD }}>{pollVotes[i]}</span>
                                                        </div>
                                                        <input type="range" min={0} max={Math.max(1, totalStudents)} step={1} value={pollVotes[i]} disabled={!on}
                                                            onChange={e => setVote(i, Number(e.target.value))} className="mt-1.5 w-full cursor-pointer" style={{ accentColor: GOLD }} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-3 text-center text-xs text-white/60">Total votes: <b className="text-white">{total}</b> of {totalStudents} students</p>
                                        <button type="button" disabled={total === 0} onClick={showPollResult}
                                            className="mt-3 w-full py-2.5 rounded-full font-black text-[#2a1a00] disabled:opacity-40" style={{ background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)' }}>Show result</button>
                                    </>
                                );
                            })() : (
                                <>
                                    <p className="text-center text-white/60 text-xs mt-1">Here is how the class voted</p>
                                    <div className="mt-5 flex items-end justify-center gap-5" style={{ height: 190 }}>
                                        {q.options.map((_, i) => (
                                            <div key={i} className="flex flex-col items-center justify-end h-full w-14">
                                                <span className="font-black mb-1 tabular-nums" style={{ color: GOLD }}>{poll[i] ?? 0}%</span>
                                                <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(2, (poll[i] ?? 0) * 1.45)}%` }} transition={{ duration: 1.2, delay: 0.2 + i * 0.15, ease: 'easeOut' }}
                                                    className="w-full rounded-t-lg" style={{ background: hidden.includes(i) || wrongPicks.includes(i) ? 'rgba(255,255,255,0.12)' : 'linear-gradient(180deg,#fde68a,#f59e0b)' }} />
                                                <span className="mt-1 font-black">{OPTION_LABELS[i]}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => setModal(null)} className="mt-5 w-full py-2.5 rounded-full font-black text-[#2a1a00]" style={{ background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)' }}>Continue</button>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
                {modal === 'call' && (
                    <motion.div key="call" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(5,3,26,0.82)' }}>
                        <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} className="rounded-3xl px-8 py-6 w-[min(520px,92vw)] text-center" style={{ background: 'linear-gradient(180deg,#1b2370,#0a0f3d)', border: `3px solid ${GOLD}` }}>
                            <motion.div animate={{ rotate: [-14, 14, -14] }} transition={{ repeat: Infinity, duration: 0.5 }} className="inline-block" style={{ fontSize: 56 }}>📞</motion.div>
                            <p className="font-black text-xl" style={{ color: GOLD }}>Phone a Friend</p>
                            <p className="text-white/70 text-sm mt-1">Ask another student or a teacher for help with this question:</p>
                            <p className="mt-2 font-semibold text-white/90 text-sm leading-snug">{q.question}</p>
                            <p className="mt-4 font-black tabular-nums" style={{ fontSize: 54, color: callLeft <= 8 ? '#f87171' : '#fff' }}>{callLeft}</p>
                            <p className="text-white/40 text-xs">The question timer is paused</p>
                            <button type="button" onClick={() => setModal(null)} className="mt-4 w-full py-2.5 rounded-full font-black text-[#2a1a00]" style={{ background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)' }}>
                                {callLeft > 0 ? 'End call' : "Time's up – back to the game"}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
                {pendingLife && (() => {
                    const info: Record<keyof Lifelines, { name: string; desc: string; icon: React.ReactNode; run: () => void }> = {
                        fifty: { name: '50:50', desc: 'Two wrong options will be removed, leaving the right answer and one wrong option.', icon: <span className="font-black" style={{ fontSize: 40 }}>50:50</span>, run: useFifty },
                        poll: { name: 'Audience Poll', desc: 'The class votes. The result is shown as bars for each option.', icon: <Users size={56} />, run: usePoll },
                        call: { name: 'Phone a Friend', desc: 'Get 30 seconds to ask a friend or another student. The question timer is paused.', icon: <Phone size={54} />, run: useCall },
                        dip: { name: 'Double Dip', desc: 'You get two chances to answer this question. If the first answer is wrong, you can choose again.', icon: <span className="font-black" style={{ fontSize: 48 }}>2×</span>, run: useDip },
                    };
                    const it = info[pendingLife];
                    return (
                        <motion.div key="lifeconfirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center px-4" style={{ background: 'rgba(5,3,26,0.85)' }}
                            onClick={() => setPendingLife(null)}>
                            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
                                className="rounded-3xl px-8 py-6 w-[min(440px,92vw)] text-center" style={{ background: 'linear-gradient(180deg,#1b2370,#0a0f3d)', border: `3px solid ${GOLD}`, boxShadow: '0 0 40px rgba(245,200,75,0.35)' }}>
                                <div className="mx-auto rounded-full flex items-center justify-center text-white" style={{ width: 124, height: 124, background: 'radial-gradient(circle at 35% 30%, #3a46c8, #0d1455)', border: `3px solid ${GOLD}`, boxShadow: '0 0 20px rgba(245,200,75,0.45)' }}>
                                    {it.icon}
                                </div>
                                <p className="mt-4 font-black text-2xl" style={{ background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)', WebkitBackgroundClip: 'text', color: 'transparent', fontFamily: "Georgia, 'Times New Roman', serif" }}>{it.name}</p>
                                <p className="mt-2 text-sm text-white/80 leading-snug">{it.desc}</p>
                                <p className="mt-3 inline-block px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' }}>
                                    Cost: {Math.round(LIFE_COST[pendingLife] * 100)}% of this question&apos;s points (−{pts(Math.round(ladder[qi] * LIFE_COST[pendingLife]))} pts)
                                </p>
                                <div className="mt-5 flex items-center justify-center gap-3">
                                    <button type="button" onClick={() => setPendingLife(null)} className="px-5 py-2 rounded-full font-bold bg-white/10 hover:bg-white/20 border border-white/20">Cancel</button>
                                    <button type="button" onClick={() => { setPendingLife(null); it.run(); }} className="px-6 py-2 rounded-full font-black text-[#2a1a00] hover:scale-105 transition-transform"
                                        style={{ background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)' }}>Use {it.name}</button>
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
                {reviewOpen && (() => {
                    const list = history.filter(r => r.qi < qi).sort((a, b) => a.qi - b.qi);
                    const rec = list[Math.min(reviewIdx, list.length - 1)];
                    const rq = rec ? questions[rec.qi] : null;
                    if (!rec || !rq) return null;
                    const tone = rec.outcome === 'right' ? { c: '#86efac', t: 'Correct' } : rec.outcome === 'time' ? { c: '#fcd34d', t: 'Time up' } : { c: '#fca5a5', t: 'Wrong' };
                    return (
                        <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center px-4" style={{ background: 'rgba(5,3,26,0.88)' }}>
                            <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} className="rounded-3xl px-6 py-5 w-[min(720px,96vw)] max-h-[92%] overflow-y-auto" style={{ background: 'linear-gradient(180deg,#1b2370,#0a0f3d)', border: `3px solid ${GOLD}` }}>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-black" style={{ color: GOLD }}>Previous questions · {Math.min(reviewIdx, list.length - 1) + 1} / {list.length}</p>
                                    <button type="button" onClick={() => setReviewOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 hover:bg-red-500/70"><X size={14} /></button>
                                </div>
                                <div className="flex items-center gap-2 mt-3 flex-wrap text-[11px] font-bold">
                                    <span className="px-3 py-1 rounded-full bg-black/40 border border-white/15">Question {rec.qi + 1}</span>
                                    <span className="px-3 py-1 rounded-full bg-black/40" style={{ border: `1px solid ${GOLD}66`, color: GOLD }}>Roll No. {rec.roll}</span>
                                    <span className="px-3 py-1 rounded-full bg-black/40" style={{ border: `1px solid ${tone.c}66`, color: tone.c }}>{tone.t}</span>
                                </div>
                                <p className="mt-3 font-bold leading-snug" style={{ fontSize: 'clamp(14px,1.5vw,20px)' }}>{rq.question}</p>
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {rq.options.map((o, i) => {
                                        const isRight = i === rq.answer, isPick = i === rec.pick;
                                        const st = isRight ? { b: '#22c55e', bg: 'rgba(34,197,94,0.18)' } : isPick ? { b: '#ef4444', bg: 'rgba(239,68,68,0.18)' } : { b: 'rgba(255,255,255,0.15)', bg: 'rgba(0,0,0,0.25)' };
                                        return (
                                            <div key={i} className="rounded-xl px-3 py-2 text-sm flex items-start gap-2" style={{ border: `1.5px solid ${st.b}`, background: st.bg }}>
                                                <span className="font-black" style={{ color: GOLD }}>{OPTION_LABELS[i]}:</span>
                                                <span className="flex-1 leading-snug">{o}</span>
                                                {isRight && <Check size={16} className="text-green-400 shrink-0 mt-0.5" />}
                                                {isPick && !isRight && <X size={16} className="text-red-400 shrink-0 mt-0.5" />}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
                                    <span className="text-white/60 uppercase tracking-widest text-[10px]">Lifelines used</span>
                                    {rec.lives.length === 0
                                        ? <span className="px-2.5 py-1 rounded-full bg-black/40 border border-white/15 text-white/70">None</span>
                                        : rec.lives.map(k => <span key={k} className="px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(245,200,75,0.14)', border: `1px solid ${GOLD}88`, color: GOLD }}>{LIFE_NAMES[k]}</span>)}
                                </div>
                                {rec.pick === null && <p className="mt-2 text-xs text-amber-300">No answer was given (time ran out).</p>}
                                {rq.explanation && <p className="mt-3 text-sm text-white/75">💡 {rq.explanation}</p>}
                                <div className="mt-4 flex items-center justify-between gap-2">
                                    <button type="button" disabled={reviewIdx <= 0} onClick={() => setReviewIdx(i => Math.max(0, i - 1))}
                                        className="px-4 py-2 rounded-full font-bold flex items-center gap-1 bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-35 disabled:cursor-not-allowed"><ChevronLeft size={16} /> Previous</button>
                                    <button type="button" onClick={() => setReviewOpen(false)} className="px-5 py-2 rounded-full font-black text-[#2a1a00]" style={{ background: 'linear-gradient(180deg,#fff3b0,#F5C84B 55%,#b8860b)' }}>Back to game</button>
                                    <button type="button" disabled={reviewIdx >= list.length - 1} onClick={() => setReviewIdx(i => Math.min(list.length - 1, i + 1))}
                                        className="px-4 py-2 rounded-full font-bold flex items-center gap-1 bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-35 disabled:cursor-not-allowed">Next <ChevronRight size={16} /></button>
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </motion.div>,
        document.body,
    );
}
