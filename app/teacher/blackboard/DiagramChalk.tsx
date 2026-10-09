'use client';

// Ready-made animated chalk diagrams for the topics teachers draw all the time
// (water cycle, solar system, photosynthesis, butterfly life cycle, food chain, human heart).
// Everything is drawn in code - no picture downloads - so it matches the chalkboard, animates,
// and the labels come in English, Hindi or Marathi. "Hide labels" turns it into a quiz.
import { useId, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

type Lang = 'en' | 'hi' | 'mr';
export type DiagramId = 'water-cycle' | 'solar-system' | 'photosynthesis' | 'butterfly-life-cycle' | 'food-chain' | 'heart';

const CHALK = '#F4F1E8';
const CYAN = '#7DD3FC';
const PINK = '#F9A8D4';
const GREEN = '#86EFAC';
const SUN = '#FCD34D';
const PEACH = '#FDBA74';
const RED = '#F87171';
const FONT = 'Caveat, Kalam, cursive';

type Tri = [string, string, string]; // en, hi, mr
const T: Record<DiagramId, Record<string, Tri>> = {
    'water-cycle': {
        title: ['Water cycle', 'जल चक्र', 'जलचक्र'],
        evap: ['Evaporation', 'वाष्पीकरण', 'बाष्पीभवन'],
        cond: ['Condensation', 'संघनन', 'संघनन'],
        precip: ['Precipitation', 'वर्षा', 'पर्जन्य'],
        collect: ['Collection', 'संग्रहण', 'संचय'],
        runoff: ['Run-off', 'अपवाह', 'अपवाह'],
    },
    'solar-system': {
        title: ['Solar system', 'सौरमंडल', 'सूर्यमाला'],
        sun: ['Sun', 'सूर्य', 'सूर्य'],
        mercury: ['Mercury', 'बुध', 'बुध'], venus: ['Venus', 'शुक्र', 'शुक्र'], earth: ['Earth', 'पृथ्वी', 'पृथ्वी'], mars: ['Mars', 'मंगल', 'मंगळ'],
        jupiter: ['Jupiter', 'बृहस्पति', 'गुरू'], saturn: ['Saturn', 'शनि', 'शनी'], uranus: ['Uranus', 'अरुण', 'अरुण'], neptune: ['Neptune', 'वरुण', 'वरुण'],
    },
    photosynthesis: {
        title: ['Photosynthesis', 'प्रकाश संश्लेषण', 'प्रकाशसंश्लेषण'],
        sun: ['Sunlight', 'सूर्य का प्रकाश', 'सूर्यप्रकाश'],
        co2: ['Carbon dioxide (CO₂)', 'कार्बन डाइऑक्साइड (CO₂)', 'कार्बन डायऑक्साइड (CO₂)'],
        o2: ['Oxygen (O₂)', 'ऑक्सीजन (O₂)', 'ऑक्सिजन (O₂)'],
        water: ['Water (H₂O)', 'जल (H₂O)', 'पाणी (H₂O)'],
        glucose: ['Glucose (food)', 'ग्लूकोज़ (भोजन)', 'ग्लुकोज (अन्न)'],
    },
    'butterfly-life-cycle': {
        title: ['Life cycle of a butterfly', 'तितली का जीवन चक्र', 'फुलपाखराचे जीवनचक्र'],
        egg: ['Egg', 'अंडा', 'अंडी'],
        larva: ['Larva (caterpillar)', 'इल्ली (लार्वा)', 'अळी'],
        pupa: ['Pupa', 'प्यूपा', 'कोष'],
        adult: ['Adult butterfly', 'वयस्क तितली', 'प्रौढ फुलपाखरू'],
    },
    'food-chain': {
        title: ['Food chain', 'खाद्य श्रृंखला', 'अन्नसाखळी'],
        sun: ['Energy from the Sun', 'सूर्य से ऊर्जा', 'सूर्याकडून ऊर्जा'],
        grass: ['Grass', 'घास', 'गवत'], hopper: ['Grasshopper', 'टिड्डा', 'टोळ'], frog: ['Frog', 'मेंढक', 'बेडूक'], snake: ['Snake', 'साँप', 'साप'], eagle: ['Eagle', 'चील', 'गरुड'],
        producer: ['Producer', 'उत्पादक', 'उत्पादक'], herb: ['Herbivore', 'शाकाहारी', 'शाकाहारी'], carn: ['Carnivore', 'मांसाहारी', 'मांसाहारी'], top: ['Top carnivore', 'शीर्ष मांसाहारी', 'सर्वोच्च मांसाहारी'],
        note: ['Arrows show the flow of energy', 'तीर ऊर्जा का प्रवाह दिखाते हैं', 'बाण ऊर्जेचा प्रवाह दर्शवतात'],
    },
    heart: {
        title: ['Human heart', 'मानव हृदय', 'मानवी हृदय'],
        ra: ['Right atrium', 'दायां आलिंद', 'उजवा अलिंद'], rv: ['Right ventricle', 'दायां निलय', 'उजवा निलय'],
        la: ['Left atrium', 'बायां आलिंद', 'डावा अलिंद'], lv: ['Left ventricle', 'बायां निलय', 'डावा निलय'],
        fromBody: ['From body', 'शरीर से', 'शरीराकडून'], toLungs: ['To lungs', 'फेफड़ों को', 'फुफ्फुसांकडे'],
        fromLungs: ['From lungs', 'फेफड़ों से', 'फुफ्फुसांकडून'], toBody: ['To body', 'शरीर को', 'शरीराकडे'],
    },
};
const idx = (l: Lang) => (l === 'hi' ? 1 : l === 'mr' ? 2 : 0);
export function diagramTitle(id: string, lang: Lang): string {
    return T[id as DiagramId]?.title[idx(lang)] ?? id;
}

// ── tiny drawing helpers ───────────────────────────────────────────────────────

function Draw({ d, color = CHALK, w = 3, delay = 0, dur = 0.8, fill = 'none', op = 1 }: { d: string; color?: string; w?: number; delay?: number; dur?: number; fill?: string; op?: number }) {
    return (
        <motion.path d={d} stroke={color} strokeWidth={w} fill={fill} strokeLinecap="round" strokeLinejoin="round" opacity={op}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: dur, delay, ease: 'easeInOut' }} />
    );
}

/** An arrow whose body draws itself, then keeps flowing (moving dashes) so you can see the direction. */
function Arrow({ d, color, delay = 0, mk }: { d: string; color: string; delay?: number; mk: string }) {
    return (
        <g>
            <motion.path d={d} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" markerEnd={`url(#${mk}-${color.slice(1)})`}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay, ease: 'easeOut' }} />
            <motion.path d={d} stroke={CHALK} strokeOpacity={0.55} strokeWidth={1.6} fill="none" strokeDasharray="3 11" strokeLinecap="round"
                initial={{ strokeDashoffset: 0, opacity: 0 }} animate={{ strokeDashoffset: -56, opacity: 1 }}
                transition={{ strokeDashoffset: { duration: 2.2, repeat: Infinity, ease: 'linear', delay }, opacity: { delay: delay + 0.7 } }} />
        </g>
    );
}

function Lab({ x, y, text, color = CHALK, size = 15, anchor = 'middle', delay = 0.9, show }: {
    x: number; y: number; text: string; color?: string; size?: number; anchor?: 'start' | 'middle' | 'end'; delay?: number; show: boolean;
}) {
    if (!show) return null;
    const lines = text.split('\n');
    return (
        <motion.text x={x} y={y} textAnchor={anchor} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, type: 'spring', stiffness: 260, damping: 16 }} style={{ transformOrigin: `${x}px ${y}px`, fontFamily: FONT, fontSize: size, fontWeight: 700, fill: color }}>
            {lines.map((ln, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : size * 1.05}>{ln}</tspan>)}
        </motion.text>
    );
}

function Sun({ cx, cy, r = 16 }: { cx: number; cy: number; r?: number }) {
    return (
        <g>
            <motion.g animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: `${cx}px ${cy}px` }}>
                {Array.from({ length: 10 }, (_, i) => {
                    const a = (i / 10) * Math.PI * 2;
                    return <line key={i} x1={cx + Math.cos(a) * (r + 5)} y1={cy + Math.sin(a) * (r + 5)} x2={cx + Math.cos(a) * (r + 12)} y2={cy + Math.sin(a) * (r + 12)} stroke={SUN} strokeWidth={2.4} strokeLinecap="round" />;
                })}
            </motion.g>
            <motion.circle cx={cx} cy={cy} r={r} fill={SUN} fillOpacity={0.9} stroke="#FEF3C7" strokeWidth={2}
                initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ transformOrigin: `${cx}px ${cy}px`, filter: 'drop-shadow(0 0 8px rgba(252,211,77,0.7))' }} transition={{ type: 'spring', stiffness: 200, damping: 12 }} />
        </g>
    );
}

// ── the diagrams ───────────────────────────────────────────────────────────────

type P = { l: Lang; show: boolean; mk: string };
const tx = (id: DiagramId, key: string, l: Lang) => T[id][key][idx(l)];

function WaterCycle({ l, show, mk }: P) {
    const t = (k: string) => tx('water-cycle', k, l);
    return (
        <g>
            <Sun cx={52} cy={46} r={16} />
            <rect x={0} y={232} width={178} height={34} fill="rgba(125,211,252,0.14)" />
            <Draw d="M0 232 q12 -9 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0" color={CYAN} delay={0.2} />
            <Draw d="M0 246 q12 -9 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0" color={CYAN} op={0.5} delay={0.35} />
            <Draw d="M175 245 L255 118 L292 168 L322 142 L400 245" delay={0.1} />
            <Arrow mk={mk} d="M40 222 C 32 182, 48 150, 40 124" color={PEACH} delay={0.8} />
            <Arrow mk={mk} d="M82 224 C 74 182, 90 150, 82 118" color={PEACH} delay={0.95} />
            <Arrow mk={mk} d="M124 222 C 116 182, 132 150, 124 120" color={PEACH} delay={1.1} />
            <Draw d="M222 98 C 202 98, 202 66, 226 66 C 230 44, 264 40, 274 58 C 294 48, 318 68, 304 86 C 322 94, 314 110, 296 106 L 232 106 C 222 106, 218 100, 222 98 Z" fill="rgba(244,241,232,0.09)" delay={1.3} dur={1} />
            {[250, 272, 294].map((x, i) => (
                <motion.line key={x} x1={x} y1={116} x2={x - 4} y2={134} stroke={CYAN} strokeWidth={3} strokeLinecap="round"
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: [0, 1, 0], y: [-4, 10, 18] }} transition={{ duration: 1.1, repeat: Infinity, delay: 2 + i * 0.3 }} />
            ))}
            <Arrow mk={mk} d="M238 152 C 214 202, 190 226, 160 240" color={CYAN} delay={2} />
            <Lab show={show} x={82} y={100} text={t('evap')} color={PEACH} delay={1.5} />
            <Lab show={show} x={268} y={28} text={t('cond')} delay={2.1} />
            <Lab show={show} x={352} y={122} text={t('precip')} color={CYAN} delay={2.3} />
            <Lab show={show} x={228} y={212} text={t('runoff')} color={CYAN} size={13} anchor="start" delay={2.6} />
            <Lab show={show} x={88} y={276} text={t('collect')} color={CYAN} delay={2.8} />
        </g>
    );
}

function SolarSystem({ l, show }: P) {
    const t = (k: string) => tx('solar-system', k, l);
    const planets = [
        { k: 'mercury', r: 28, c: '#A8A29E', s: 3, d: 6 }, { k: 'venus', r: 40, c: '#FDE68A', s: 4.5, d: 9 },
        { k: 'earth', r: 53, c: CYAN, s: 5, d: 12 }, { k: 'mars', r: 66, c: RED, s: 4, d: 16 },
        { k: 'jupiter', r: 82, c: PEACH, s: 9, d: 24 }, { k: 'saturn', r: 100, c: '#FEF3C7', s: 7, d: 32 },
        { k: 'uranus', r: 114, c: '#A5F3FC', s: 6, d: 42 }, { k: 'neptune', r: 127, c: '#93C5FD', s: 6, d: 52 },
    ];
    const cx = 200, cy = 140;
    return (
        <g>
            {planets.map((p, i) => (
                <motion.circle key={p.k} cx={cx} cy={cy} r={p.r} fill="none" stroke={CHALK} strokeOpacity={0.28} strokeWidth={1.4}
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.1 + i * 0.1 }} />
            ))}
            {planets.map((p, i) => (
                <motion.g key={`pl-${p.k}`} initial={{ rotate: i * 47, opacity: 0 }} animate={{ rotate: i * 47 + 360, opacity: 1 }}
                    transition={{ rotate: { duration: p.d, repeat: Infinity, ease: 'linear' }, opacity: { delay: 0.6 + i * 0.1 } }} style={{ transformOrigin: `${cx}px ${cy}px` }}>
                    <circle cx={cx + p.r} cy={cy} r={p.s} fill={p.c} />
                    {p.k === 'saturn' && <ellipse cx={cx + p.r} cy={cy} rx={p.s * 1.9} ry={p.s * 0.55} fill="none" stroke="#FEF3C7" strokeWidth={1.4} />}
                </motion.g>
            ))}
            <motion.circle cx={cx} cy={cy} r={15} fill={SUN} stroke="#FEF3C7" strokeWidth={2} style={{ transformOrigin: `${cx}px ${cy}px`, filter: 'drop-shadow(0 0 10px rgba(252,211,77,0.8))' }}
                animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 2.4, repeat: Infinity }} />
            {show && planets.map((p, i) => {
                const left = i < 4;
                const y = 62 + (i % 4) * 54;
                return (
                    <g key={`lg-${p.k}`}>
                        <motion.circle cx={left ? 12 : 388} cy={y - 5} r={4.5} fill={p.c} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 + i * 0.1 }} />
                        <Lab show x={left ? 22 : 378} y={y} text={t(p.k)} anchor={left ? 'start' : 'end'} size={14} delay={1 + i * 0.1} />
                    </g>
                );
            })}
            <Lab show={show} x={cx} y={cy + 32} text={t('sun')} color={SUN} size={13} delay={1.2} />
        </g>
    );
}

function Photosynthesis({ l, show, mk }: P) {
    const t = (k: string) => tx('photosynthesis', k, l);
    return (
        <g>
            <Sun cx={336} cy={44} r={15} />
            <Draw d="M14 205 L386 205" color={PEACH} op={0.8} />
            {[40, 90, 150, 250, 310, 360].map(x => <Draw key={x} d={`M${x} 214 l8 6`} color={PEACH} op={0.4} w={2} delay={0.3} />)}
            <Draw d="M200 205 L200 120" color={GREEN} w={4} delay={0.2} />
            <Draw d="M200 152 C 150 152, 120 122, 118 92 C 160 94, 195 117, 200 152 Z" color={GREEN} fill="rgba(134,239,172,0.22)" delay={0.5} />
            <Draw d="M200 132 C 250 132, 280 102, 282 72 C 240 74, 205 97, 200 132 Z" color={GREEN} fill="rgba(134,239,172,0.22)" delay={0.7} />
            <Draw d="M200 205 Q 184 235 160 252" color={PEACH} w={2.5} delay={0.4} />
            <Draw d="M200 205 Q 200 240 200 268" color={PEACH} w={2.5} delay={0.45} />
            <Draw d="M200 205 Q 216 235 240 252" color={PEACH} w={2.5} delay={0.5} />
            <Arrow mk={mk} d="M312 66 C 296 74, 280 80, 262 88" color={SUN} delay={1.1} />
            <Arrow mk={mk} d="M24 150 C 54 150, 90 132, 122 118" color={PEACH} delay={1.3} />
            <Arrow mk={mk} d="M136 96 C 116 76, 88 60, 62 52" color={CYAN} delay={1.6} />
            <Arrow mk={mk} d="M236 248 C 218 220, 214 176, 206 142" color={CYAN} delay={1.9} />
            <Lab show={show} x={344} y={96} text={t('sun')} color={SUN} anchor="middle" delay={1.5} size={14} />
            <Lab show={show} x={12} y={140} text={t('co2')} color={PEACH} anchor="start" delay={1.7} size={13} />
            <Lab show={show} x={14} y={42} text={t('o2')} color={CYAN} anchor="start" delay={2} size={13} />
            <Lab show={show} x={252} y={252} text={t('water')} color={CYAN} anchor="start" delay={2.3} size={14} />
            <Lab show={show} x={184} y={182} text={t('glucose')} color={GREEN} anchor="end" delay={2.6} size={14} />
        </g>
    );
}

function Butterfly({ l, show, mk }: P) {
    const t = (k: string) => tx('butterfly-life-cycle', k, l);
    const R = 82, cx = 200, cy = 140;
    const pt = (deg: number) => { const a = (deg * Math.PI) / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
    const arc = (a0: number, a1: number) => { const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    const stage = (emoji: string, x: number, y: number, d: number) => (
        <motion.text key={emoji} x={x} y={y + 12} textAnchor="middle" fontSize={36} initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: d, type: 'spring', stiffness: 240, damping: 13 }} style={{ transformOrigin: `${x}px ${y}px` }}>
            {emoji}
        </motion.text>
    );
    return (
        <g>
            <Arrow mk={mk} d={arc(-68, -22)} color={PINK} delay={0.7} />
            <Arrow mk={mk} d={arc(22, 68)} color={PINK} delay={1.2} />
            <Arrow mk={mk} d={arc(112, 158)} color={PINK} delay={1.7} />
            <Arrow mk={mk} d={arc(202, 248)} color={PINK} delay={2.2} />
            {stage('🥚', cx, cy - R, 0.2)}
            {stage('🐛', cx + R, cy, 0.5)}
            {stage('🦋', cx - R, cy, 1.5)}
            <motion.g initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, type: 'spring', stiffness: 220, damping: 14 }} style={{ transformOrigin: `${cx}px ${cy + R}px` }}>
                <line x1={cx} y1={cy + R - 28} x2={cx} y2={cy + R - 18} stroke={CHALK} strokeWidth={2} />
                <ellipse cx={cx} cy={cy + R} rx={11} ry={19} fill="rgba(134,239,172,0.3)" stroke={GREEN} strokeWidth={2.4} />
                <path d={`M${cx - 9} ${cy + R - 6} q9 5 18 0 M${cx - 10} ${cy + R + 3} q10 5 20 0 M${cx - 8} ${cy + R + 12} q8 4 16 0`} stroke={GREEN} strokeWidth={1.6} fill="none" />
            </motion.g>
            <Lab show={show} x={cx} y={cy - R - 32} text={t('egg')} color={SUN} delay={0.5} />
            <Lab show={show} x={cx + R} y={cy + 40} text={t('larva')} color={GREEN} delay={0.8} />
            <Lab show={show} x={cx} y={cy + R + 36} text={t('pupa')} color={PEACH} delay={1.3} />
            <Lab show={show} x={cx - R} y={cy + 40} text={t('adult')} color={PINK} delay={1.8} />
            <motion.g animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: `${cx}px ${cy}px` }} opacity={0.35}>
                <circle cx={cx} cy={cy - 18} r={2.5} fill={PINK} />
            </motion.g>
        </g>
    );
}

function FoodChain({ l, show, mk }: P) {
    const t = (k: string) => tx('food-chain', k, l);
    const items = [
        { e: '🌿', n: 'grass', role: 'producer', c: GREEN }, { e: '🦗', n: 'hopper', role: 'herb', c: SUN },
        { e: '🐸', n: 'frog', role: 'carn', c: PEACH }, { e: '🐍', n: 'snake', role: 'carn', c: PINK }, { e: '🦅', n: 'eagle', role: 'top', c: RED },
    ];
    const xs = [42, 121, 200, 279, 358];
    return (
        <g>
            <motion.text x={42} y={62} textAnchor="middle" fontSize={32} initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }} style={{ transformOrigin: '42px 50px' }}>☀️</motion.text>
            <Arrow mk={mk} d="M42 72 L42 106" color={SUN} delay={0.4} />
            <Lab show={show} x={74} y={58} text={t('sun')} color={SUN} anchor="start" size={13} delay={0.9} />
            {items.map((it, i) => (
                <g key={it.n}>
                    <motion.text x={xs[i]} y={152} textAnchor="middle" fontSize={38} initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6 + i * 0.45, type: 'spring', stiffness: 240, damping: 13 }} style={{ transformOrigin: `${xs[i]}px 140px` }}>{it.e}</motion.text>
                    {i < 4 && <Arrow mk={mk} d={`M${xs[i] + 26} 140 L${xs[i + 1] - 28} 140`} color={PINK} delay={0.9 + i * 0.45} />}
                    <Lab show={show} x={xs[i]} y={196} text={t(it.n)} size={15} delay={0.9 + i * 0.45} />
                    <Lab show={show} x={xs[i]} y={214} text={t(it.role)} color={it.c} size={12.5} delay={1.1 + i * 0.45} />
                </g>
            ))}
            <Lab show={show} x={200} y={258} text={t('note')} color="rgba(244,241,232,0.7)" size={14} delay={3} />
        </g>
    );
}

function Heart({ l, show, mk }: P) {
    const t = (k: string) => tx('heart', k, l);
    const clip = useId().replace(/:/g, '');
    const heart = 'M200 245 C 120 190, 100 140, 110 105 C 120 70, 175 68, 200 100 C 225 68, 280 70, 290 105 C 300 140, 280 190, 200 245 Z';
    return (
        <g>
            <defs><clipPath id={`hc-${clip}`}><path d={heart} /></clipPath></defs>
            <motion.g animate={{ scale: [1, 1.035, 1, 1.02, 1] }} transition={{ duration: 1.1, repeat: Infinity, times: [0, 0.18, 0.4, 0.55, 1] }} style={{ transformOrigin: '200px 170px' }}>
                <g clipPath={`url(#hc-${clip})`}>
                    <rect x={90} y={60} width={110} height={200} fill="rgba(125,211,252,0.28)" />
                    <rect x={200} y={60} width={110} height={200} fill="rgba(248,113,113,0.32)" />
                    <line x1={200} y1={90} x2={200} y2={250} stroke={CHALK} strokeWidth={2.4} />
                    <line x1={100} y1={152} x2={300} y2={152} stroke={CHALK} strokeWidth={2.4} />
                </g>
                <Draw d={heart} w={3.6} />
                <Arrow mk={mk} d="M160 128 L160 170" color={CYAN} delay={1.4} />
                <Arrow mk={mk} d="M240 128 L240 170" color={RED} delay={1.8} />
            </motion.g>
            <Arrow mk={mk} d="M28 62 C 78 56, 120 72, 150 106" color={CYAN} delay={0.8} />
            <Arrow mk={mk} d="M138 196 C 98 196, 62 176, 36 154" color={CYAN} delay={1.2} />
            <Arrow mk={mk} d="M372 128 C 340 120, 300 116, 268 122" color={RED} delay={1.6} />
            <Arrow mk={mk} d="M266 200 C 306 208, 340 220, 370 238" color={RED} delay={2} />
            <Lab show={show} x={160} y={118} text={t('ra')} size={11.5} delay={1} />
            <Lab show={show} x={160} y={200} text={t('rv')} size={11.5} delay={1.1} />
            <Lab show={show} x={240} y={118} text={t('la')} size={11.5} delay={1.2} />
            <Lab show={show} x={240} y={200} text={t('lv')} size={11.5} delay={1.3} />
            <Lab show={show} x={14} y={48} text={t('fromBody')} color={CYAN} anchor="start" size={14} delay={1.5} />
            <Lab show={show} x={14} y={144} text={t('toLungs')} color={CYAN} anchor="start" size={14} delay={1.7} />
            <Lab show={show} x={386} y={108} text={t('fromLungs')} color={RED} anchor="end" size={14} delay={1.9} />
            <Lab show={show} x={386} y={262} text={t('toBody')} color={RED} anchor="end" size={14} delay={2.1} />
        </g>
    );
}

const BODY: Record<DiagramId, (p: P) => ReactNode> = {
    'water-cycle': WaterCycle, 'solar-system': SolarSystem, photosynthesis: Photosynthesis,
    'butterfly-life-cycle': Butterfly, 'food-chain': FoodChain, heart: Heart,
};

export function isDiagramId(id: string | undefined): id is DiagramId {
    return !!id && id in T;
}

export function DiagramChalk({ id, lang, width }: { id: DiagramId; lang: Lang; width: number }) {
    const [show, setShow] = useState(true);
    const uid = useId().replace(/:/g, '');
    const mk = `ah${uid}`;
    const W = Math.max(260, width);
    const Body = BODY[id];
    return (
        <div className="relative w-full" style={{ width: W }}>
            <svg width={W} height={(W * 280) / 400} viewBox="0 0 400 280" className="overflow-visible" aria-hidden>
                <defs>
                    {[CHALK, CYAN, PINK, GREEN, SUN, PEACH, RED].map(c => (
                        <marker key={c} id={`${mk}-${c.slice(1)}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                            <path d="M1 1 L9 5 L1 9" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                        </marker>
                    ))}
                </defs>
                <Body l={lang} show={show} mk={mk} />
            </svg>
            <button type="button" onPointerDown={e => e.stopPropagation()} onClick={() => setShow(v => !v)}
                title={show ? 'Hide the labels (quiz mode)' : 'Show the labels'}
                className="absolute top-0 right-0 h-7 px-2 rounded-full flex items-center gap-1 text-[11px] font-semibold text-white/80 hover:text-white"
                style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)' }}>
                {show ? <EyeOff size={12} /> : <Eye size={12} />} {show ? 'Hide labels' : 'Show labels'}
            </button>
        </div>
    );
}
