// Hand-drawn style school doodles for the parents' admission pages.
// Purely decorative: every svg is aria-hidden.

const INK = '#1F2937';
const line = { stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

type P = { className?: string; style?: React.CSSProperties };

export const SchoolDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 96 82" className={className} style={style} aria-hidden="true" fill="none">
        <path d="M48 4 V14" {...line} />
        <path d="M48 4 L60 7 L48 10" fill="#DA7756" {...line} />
        <path d="M8 36 L48 14 L88 36 Z" fill="#FDE2D8" {...line} />
        <rect x="14" y="36" width="68" height="40" rx="2" fill="#FFF7ED" {...line} />
        <circle cx="48" cy="27" r="4.5" fill="#FBBF24" {...line} />
        <rect x="21" y="44" width="13" height="11" rx="2" fill="#BFDBFE" {...line} />
        <rect x="62" y="44" width="13" height="11" rx="2" fill="#BFDBFE" {...line} />
        <path d="M40 76 V60 a8 8 0 0 1 16 0 V76" fill="#DA7756" {...line} />
        <path d="M4 77 H92" {...line} />
    </svg>
);

export const BackpackDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 64 74" className={className} style={style} aria-hidden="true" fill="none">
        <path d="M24 14 C24 5 40 5 40 14" {...line} />
        <rect x="11" y="13" width="42" height="56" rx="13" fill="#93C5FD" {...line} />
        <path d="M11 30 Q32 39 53 30" {...line} />
        <rect x="20" y="42" width="24" height="18" rx="6" fill="#DBEAFE" {...line} />
        <path d="M27 48 H37" {...line} />
    </svg>
);

export const PencilDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 82 26" className={className} style={style} aria-hidden="true" fill="none">
        <rect x="2" y="6" width="9" height="14" rx="3" fill="#F9A8D4" {...line} />
        <rect x="11" y="6" width="51" height="14" fill="#FBBF24" {...line} />
        <path d="M11 13 H62" stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity=".5" />
        <path d="M62 6 L78 13 L62 20 Z" fill="#FDE68A" {...line} />
        <path d="M73 11 L78 13 L73 15 Z" fill={INK} />
    </svg>
);

export const BookDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 74 54" className={className} style={style} aria-hidden="true" fill="none">
        <path d="M2 12 V50 C15 46 27 46 37 52 C47 46 59 46 72 50 V12" fill="#A78BFA" {...line} />
        <path d="M37 10 C27 4 13 4 5 8 V46 C13 42 27 42 37 48 Z" fill="#fff" {...line} />
        <path d="M37 10 C47 4 61 4 69 8 V46 C61 42 47 42 37 48 Z" fill="#fff" {...line} />
        <path d="M11 17 C18 15 25 16 31 19 M11 25 C18 23 25 24 31 27 M43 19 C49 16 56 15 63 17 M43 27 C49 24 56 23 63 25" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
    </svg>
);

export const AppleDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 48 52" className={className} style={style} aria-hidden="true" fill="none">
        <path d="M24 17 C14 9 2 15 4 29 C6 43 16 51 24 47 C32 51 42 43 44 29 C46 15 34 9 24 17 Z" fill="#F87171" {...line} />
        <path d="M24 17 C24 11 26 7 29 4" {...line} />
        <path d="M27 10 C32 4 39 5 42 8 C38 13 31 13 27 10 Z" fill="#34D399" {...line} />
        <path d="M12 26 C12 22 14 20 17 19" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);

export const BusDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 100 58" className={className} style={style} aria-hidden="true" fill="none">
        <rect x="4" y="8" width="90" height="38" rx="9" fill="#FBBF24" {...line} />
        {[12, 30, 48, 66].map(x => <rect key={x} x={x} y="15" width="14" height="12" rx="2" fill="#E0F2FE" {...line} />)}
        <path d="M4 34 H94" {...line} />
        <circle cx="25" cy="47" r="7" fill="#374151" {...line} />
        <circle cx="25" cy="47" r="2.5" fill="#fff" />
        <circle cx="74" cy="47" r="7" fill="#374151" {...line} />
        <circle cx="74" cy="47" r="2.5" fill="#fff" />
        <circle cx="89" cy="39" r="2.5" fill="#fff" stroke={INK} strokeWidth="1.5" />
    </svg>
);

export const StarDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 40 40" className={className} style={style} aria-hidden="true" fill="none">
        <path d="M20 3 L25 14 L37 15 L28 23 L31 35 L20 29 L9 35 L12 23 L3 15 L15 14 Z" fill="#FDE68A" {...line} />
    </svg>
);

export const GlobeDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 50 62" className={className} style={style} aria-hidden="true" fill="none">
        <circle cx="25" cy="23" r="18" fill="#BAE6FD" {...line} />
        <path d="M14 15 C18 11 22 14 21 18 C20 22 14 22 13 19 Z M28 24 C33 21 39 25 36 31 C33 36 27 33 28 28 Z" fill="#86EFAC" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M5 23 A20 20 0 0 0 45 23" {...line} />
        <path d="M25 43 V53 M15 56 H35" {...line} />
    </svg>
);

export const RulerDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 82 22" className={className} style={style} aria-hidden="true" fill="none">
        <rect x="2" y="3" width="78" height="16" rx="3" fill="#6EE7B7" {...line} />
        {[12, 22, 32, 42, 52, 62, 72].map((x, i) => <path key={x} d={`M${x} 3 V${i % 2 ? 9 : 12}`} stroke={INK} strokeWidth="1.8" strokeLinecap="round" />)}
    </svg>
);

export const BlocksDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 92 34" className={className} style={style} aria-hidden="true" fill="none">
        {[['A', 2, '#FCA5A5'], ['B', 32, '#93C5FD'], ['C', 62, '#FDE68A']].map(([t, x, c]) => (
            <g key={t as string}>
                <rect x={x as number} y="3" width="28" height="28" rx="5" fill={c as string} {...line} />
                <text x={(x as number) + 14} y="23.5" textAnchor="middle" fontFamily="'Comic Sans MS','Segoe UI',sans-serif" fontWeight="700" fontSize="17" fill={INK}>{t}</text>
            </g>
        ))}
    </svg>
);

type Kid = P & {
    skin?: string; hair?: string; hairStyle?: 'short' | 'ponytail' | 'bun' | 'curly';
    shirt?: string; bottom?: string; skirt?: boolean; bag?: string; wave?: boolean; flip?: boolean;
};

/** A child in school uniform with a backpack, walking or waving. */
export const KidDoodle = ({ className, style, skin = '#F5C9A5', hair = '#3F2A1E', hairStyle = 'short', shirt = '#FFFFFF', bottom = '#1E3A8A', skirt = false, bag = '#DA7756', wave = false, flip = false }: Kid) => {
    // An outlined limb: a thick ink stroke with a thinner skin stroke on top.
    const limb = (d: string, colour = skin) => (
        <g>
            <path d={d} stroke={INK} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} stroke={colour} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
    );
    return (
        <svg viewBox="0 0 64 112" className={className} style={{ ...style, transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden="true" fill="none">
            {hairStyle === 'ponytail' && <path d="M43 16 C55 16 56 32 49 38 C52 30 49 22 43 22 Z" fill={hair} {...line} />}
            <rect x="35" y="38" width="17" height="27" rx="7" fill={bag} {...line} />
            <path d="M39 46 H48" {...line} />
            {limb('M27 80 L23 100')}
            {limb('M37 80 L41 100')}
            <path d="M16 101 C16 97 22 96 27 99 L27 103 H16 Z" fill="#374151" {...line} />
            <path d="M37 99 C42 96 48 97 48 101 V103 H37 Z" fill="#374151" {...line} />
            {skirt
                ? <path d="M20 68 H44 L49 84 H15 Z" fill={bottom} {...line} />
                : <path d="M21 68 H43 L45 84 H35 L32 76 L29 84 H19 Z" fill={bottom} {...line} />}
            {limb('M22 47 L15 64')}
            {wave ? limb('M42 46 L50 33 L53 24') : limb('M42 47 L47 64')}
            <circle cx="15" cy="65" r="3.4" fill={skin} {...line} />
            {wave ? <circle cx="53.5" cy="22" r="3.6" fill={skin} {...line} /> : <circle cx="47.5" cy="65.5" r="3.4" fill={skin} {...line} />}
            <path d="M20 45 Q32 38 44 45 L44 70 H20 Z" fill={shirt} {...line} />
            <path d="M27 42 L32 48 L37 42" fill="#fff" {...line} />
            <path d="M32 48 V62" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity=".5" />
            <path d="M41 45 L38 63" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            <rect x="28.5" y="35" width="7" height="6" fill={skin} />
            <circle cx="32" cy="24" r="13" fill={skin} {...line} />
            {hairStyle === 'bun' && <circle cx="32" cy="8.5" r="6" fill={hair} {...line} />}
            {hairStyle === 'curly'
                ? <path d="M18 24 C14 14 22 7 27 10 C29 5 37 5 39 10 C45 8 50 15 46 24 C44 18 40 16 36 18 C33 15 28 15 26 18 C22 17 19 20 18 24 Z" fill={hair} {...line} />
                : <path d="M19 24 C18 10 46 9 45 24 C42 17 37 15 31 16 C26 16 21 19 19 24 Z" fill={hair} {...line} />}
            <circle cx="27" cy="25.5" r="1.7" fill={INK} />
            <circle cx="37" cy="25.5" r="1.7" fill={INK} />
            <path d="M28 30.5 Q32 34.5 36 30.5" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="24.2" cy="29.5" r="2.2" fill="#FCA5A5" opacity=".75" />
            <circle cx="39.8" cy="29.5" r="2.2" fill="#FCA5A5" opacity=".75" />
        </svg>
    );
};

export const TreeDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 74 104" className={className} style={style} aria-hidden="true" fill="none">
        <path d="M32 100 V62 M42 100 V62" {...line} />
        <rect x="31" y="58" width="12" height="44" rx="3" fill="#B45309" {...line} />
        <path d="M37 72 L29 64 M37 80 L45 70" {...line} />
        <circle cx="22" cy="48" r="16" fill="#4ADE80" {...line} />
        <circle cx="52" cy="48" r="16" fill="#4ADE80" {...line} />
        <circle cx="37" cy="30" r="24" fill="#86EFAC" {...line} />
        <circle cx="28" cy="26" r="3" fill="#F87171" {...line} />
        <circle cx="47" cy="36" r="3" fill="#F87171" {...line} />
        <circle cx="21" cy="49" r="2.6" fill="#F87171" {...line} />
    </svg>
);

export const KiteDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 70 200" className={className} style={style} aria-hidden="true" fill="none">
        <path d="M35 58 C40 90 26 120 34 150 C40 172 30 186 30 198" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1 4" />
        <path d="M35 4 L58 30 L35 58 L12 30 Z" fill="#F472B6" {...line} />
        <path d="M35 4 V58 M12 30 H58" {...line} />
        <path d="M35 4 L58 30 L35 30 Z" fill="#FBBF24" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M35 58 C31 66 39 72 35 80 C31 88 39 94 35 102" {...line} />
        {[68, 84, 100].map(y => <path key={y} d={`M30 ${y - 4} L35 ${y} L30 ${y + 4} Z M40 ${y - 4} L35 ${y} L40 ${y + 4} Z`} fill={y === 84 ? '#60A5FA' : '#34D399'} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />)}
    </svg>
);

export const BirdsDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 80 34" className={className} style={style} aria-hidden="true" fill="none">
        <path d="M4 16 Q11 8 18 16 Q25 8 32 16" {...line} />
        <path d="M44 26 Q49 20 54 26 Q59 20 64 26" {...line} />
        <path d="M58 8 Q62 4 66 8 Q70 4 74 8" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

export const FlowersDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 80 40" className={className} style={style} aria-hidden="true" fill="none">
        {[[12, '#F472B6'], [38, '#FBBF24'], [64, '#A78BFA']].map(([x, c]) => (
            <g key={x as number}>
                <path d={`M${x} 38 V18`} stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" />
                <path d={`M${x} 30 Q${(x as number) - 7} 26 ${(x as number) - 8} 31 Q${(x as number) - 3} 33 ${x} 30`} fill="#4ADE80" stroke="#15803D" strokeWidth="1.5" />
                {[0, 72, 144, 216, 288].map(a => <circle key={a} cx={((x as number) + Math.cos((a * Math.PI) / 180) * 6).toFixed(2)} cy={(14 + Math.sin((a * Math.PI) / 180) * 6).toFixed(2)} r="4.5" fill={c as string} stroke={INK} strokeWidth="1.6" />)}
                <circle cx={x as number} cy="14" r="3.4" fill="#FDE68A" stroke={INK} strokeWidth="1.6" />
            </g>
        ))}
    </svg>
);

export const SunDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 60 60" className={className} style={style} aria-hidden="true" fill="none">
        {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4, x1 = 30 + Math.cos(a) * 18, y1 = 30 + Math.sin(a) * 18, x2 = 30 + Math.cos(a) * 26, y2 = 30 + Math.sin(a) * 26;
            return <path key={i} d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`} {...line} />;
        })}
        <circle cx="30" cy="30" r="13" fill="#FCD34D" {...line} />
        <circle cx="25.5" cy="28" r="1.5" fill={INK} />
        <circle cx="34.5" cy="28" r="1.5" fill={INK} />
        <path d="M25 33 Q30 37 35 33" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

export const CloudDoodle = ({ className, style }: P) => (
    <svg viewBox="0 0 90 44" className={className} style={style} aria-hidden="true" fill="none">
        <path d="M18 40 C6 40 4 26 14 23 C14 12 28 8 34 16 C38 6 56 6 59 18 C70 14 80 22 76 31 C86 33 84 40 76 40 Z" fill="#fff" {...line} />
    </svg>
);

/**
 * The page background: a soft sky-to-cream wash, faint paper dots, school
 * things in the side margins and a street scene along the bottom with kids
 * walking to school. Fixed behind the content so it stays put while the
 * form scrolls. `lift` raises the scene above a sticky bottom bar.
 */
export function DoodleBackground({ lift = false }: { lift?: boolean }) {
    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true"
            style={{ background: 'linear-gradient(180deg, #DBEFFF 0%, #EEF7FF 32%, #FFF7ED 100%)' }}>
            <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1.2px, transparent 1.2px)', backgroundSize: '26px 26px' }} />

            {/* Sky */}
            <SunDoodle className="absolute w-20 left-[6%] top-[17%]" />
            <CloudDoodle className="absolute w-28 right-[9%] top-[16%]" />
            <CloudDoodle className="absolute w-20 left-[19%] top-[23%] opacity-80 hidden xl:block" />
            <BirdsDoodle className="absolute w-20 right-[20%] top-[24%] hidden lg:block" />
            <BirdsDoodle className="absolute w-14 left-[12%] top-[32%] hidden xl:block" />
            <KiteDoodle className="absolute w-16 right-[3%] top-[26%] rotate-[10deg] hidden lg:block" />

            {/* Left margin: school things */}
            <BackpackDoodle className="absolute w-14 left-[3%] top-[36%] -rotate-12 hidden lg:block" />
            <PencilDoodle className="absolute w-28 left-[11%] top-[44%] rotate-[24deg] hidden lg:block" />
            <BlocksDoodle className="absolute w-28 left-[5%] top-[55%] -rotate-3 hidden lg:block" />
            <AppleDoodle className="absolute w-11 left-[19%] top-[60%] rotate-6 hidden xl:block" />
            <StarDoodle className="absolute w-8 left-[18%] top-[37%] rotate-12 hidden lg:block" />

            {/* Right margin */}
            <BookDoodle className="absolute w-24 right-[13%] top-[37%] rotate-6 hidden lg:block" />
            <GlobeDoodle className="absolute w-14 right-[20%] top-[50%] -rotate-6 hidden xl:block" />
            <RulerDoodle className="absolute w-28 right-[9%] top-[57%] -rotate-[14deg] hidden lg:block" />
            <StarDoodle className="absolute w-7 right-[4%] top-[50%] -rotate-12 hidden lg:block" />

            {/* Phones: a couple of faint hints only */}
            <StarDoodle className="absolute w-6 right-[6%] top-[22%] opacity-60 lg:hidden" />
            <PencilDoodle className="absolute w-16 left-[2%] top-[40%] rotate-[30deg] opacity-40 lg:hidden" />

            {/* Street scene with kids walking to school */}
            {lift && <div className="absolute bottom-0 inset-x-0 h-[140px] sm:h-[76px] bg-[#7DDB9B]" />}
            <div className={`absolute inset-x-0 h-44 md:h-60 ${lift ? 'bottom-[139px] sm:bottom-[75px]' : 'bottom-0'}`}>
                <svg viewBox="0 0 1440 240" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full">
                    <path d="M0 132 C220 80 420 160 720 116 C1010 72 1210 150 1440 104 V240 H0 Z" fill="#BBF7D0" />
                    <path d="M0 176 C260 140 520 200 820 164 C1100 130 1280 186 1440 164 V240 H0 Z" fill="#86EFAC" />
                    <path d="M0 214 C300 196 640 226 940 206 C1180 192 1320 214 1440 206 V240 H0 Z" fill="#7DDB9B" />
                </svg>
                {/* left side */}
                <TreeDoodle className="absolute bottom-8 md:bottom-12 left-[1%] w-16 md:w-24" />
                <BusDoodle className="absolute bottom-6 md:bottom-8 left-[8%] w-24 md:w-36" />
                <KidDoodle className="absolute bottom-4 md:bottom-6 left-[19%] w-9 md:w-14" shirt="#FFFFFF" bottom="#1E3A8A" bag="#60A5FA" hairStyle="short" />
                <KidDoodle className="absolute bottom-4 md:bottom-6 left-[23%] w-9 md:w-14 hidden sm:block" skin="#C68B59" hair="#111827" hairStyle="ponytail" skirt bottom="#9D174D" bag="#FBBF24" />
                <FlowersDoodle className="absolute bottom-1 left-[13%] w-14 md:w-20 hidden md:block" />
                {/* right side */}
                <KidDoodle className="absolute bottom-4 md:bottom-6 right-[25%] w-9 md:w-14 hidden sm:block" skin="#E8B48A" hair="#1F2937" hairStyle="curly" bottom="#1E3A8A" bag="#34D399" wave flip />
                <SchoolDoodle className="absolute bottom-9 md:bottom-14 right-[9%] w-32 md:w-48" />
                <TreeDoodle className="absolute bottom-8 md:bottom-12 right-[1%] w-14 md:w-20" />
                <KidDoodle className="absolute bottom-4 md:bottom-6 right-[19%] w-8 md:w-12" skin="#8D5A3B" hair="#111827" hairStyle="bun" skirt bottom="#1E3A8A" bag="#F472B6" flip />
                <FlowersDoodle className="absolute bottom-1 right-[30%] w-14 md:w-20 hidden md:block" />
            </div>
        </div>
    );
}
