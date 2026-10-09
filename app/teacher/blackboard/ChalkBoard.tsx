'use client';

// The classroom board (Load -> Blackboard), made to look like the one in every
// Indian school: green slate inside a wooden frame with screws, a chalk ledge
// with chalk pieces, dust and a duster, and the header that gets written every
// morning - Class / Subject on the left, Thought of the Day in the middle (the
// same one as on the teacher Overview), Date / Day on the right.
import { useEffect, useState } from 'react';
import { usePersisted } from '@/store/blackboardMemory';
import { getTodaysThought } from '@/lib/teacherThoughts';

const CHALK = '#F4F1E8';
const HAND = "Caveat, 'Patrick Hand', cursive";

const SLATE_GRAIN = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;
// Wood grain from layered fine stripes with uneven spacing and tiny angle drift -
// plain CSS, so it looks the same in every browser. 0deg = grain along the rails.
const grain = (a: number) => [
    `repeating-linear-gradient(${a}deg, rgba(55,28,10,0.38) 0 1px, transparent 1px 4px)`,
    `repeating-linear-gradient(${a + 0.7}deg, rgba(255,214,160,0.13) 0 2px, transparent 2px 9px)`,
    `repeating-linear-gradient(${a - 0.5}deg, rgba(45,22,8,0.30) 0 1.5px, transparent 1.5px 13px)`,
    `repeating-linear-gradient(${a + 0.3}deg, rgba(40,20,6,0.22) 0 3px, transparent 3px 23px)`,
].join(', ');
const GRAIN_H = grain(0);
const GRAIN_V = grain(90);
const WOOD_GRAIN = GRAIN_H;
const FRAME = 16;

function Screw({ style }: { style: React.CSSProperties }) {
    return (
        <span className="absolute w-[7px] h-[7px] rounded-full" style={{
            ...style,
            background: 'radial-gradient(circle at 35% 35%, #E5E1D8, #8D8576 60%, #4A4439)',
            boxShadow: '0 1px 1px rgba(0,0,0,0.5)',
        }}>
            <span className="absolute left-1/2 top-1/2 w-[5px] h-[1px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-black/50" />
        </span>
    );
}

/** Slate, frame, ledge. Purely visual - the drawing canvas sits on top. */
export function ChalkBoard() {
    return (
        <div className="absolute inset-0 overflow-hidden select-none pointer-events-none" aria-hidden
            style={{ backgroundColor: '#7A4C2A', padding: FRAME }}>
            <div className="relative w-full h-full rounded-[2px] overflow-hidden"
                style={{
                    backgroundColor: '#2D4B3C',
                    backgroundImage: [
                        SLATE_GRAIN,
                        // faint wiped-off chalk from earlier periods - duster arcs and smudges
                        'radial-gradient(ellipse 38% 22% at 22% 30%, rgba(255,255,255,0.06), transparent 70%)',
                        'radial-gradient(ellipse 30% 18% at 72% 62%, rgba(255,255,255,0.05), transparent 70%)',
                        'radial-gradient(ellipse 45% 14% at 50% 88%, rgba(255,255,255,0.055), transparent 70%)',
                        'radial-gradient(ellipse 18% 30% at 88% 22%, rgba(255,255,255,0.035), transparent 70%)',
                        'radial-gradient(ellipse 120% 90% at 50% 45%, rgba(255,255,255,0.04), rgba(0,0,0,0.3) 100%)',
                    ].join(','),
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4), inset 0 7px 16px rgba(0,0,0,0.5), inset 0 -4px 10px rgba(0,0,0,0.3)',
                }}>
                {/* chalk dust settled along the bottom of the slate */}
                <div className="absolute left-0 right-0 bottom-0 h-10"
                    style={{ background: 'linear-gradient(0deg, rgba(244,241,232,0.10), transparent)' }} />
            </div>

            {/* wooden frame: four mitred pieces, grain running along each piece */}
            {([
                { k: 't', style: { left: 0, right: 0, top: 0, height: FRAME, clipPath: `polygon(0 0, 100% 0, calc(100% - ${FRAME}px) 100%, ${FRAME}px 100%)` }, img: `${GRAIN_H}, linear-gradient(180deg, #A06B3E 0%, #82532F 55%, #6A4123 100%)` },
                { k: 'b', style: { left: 0, right: 0, bottom: 0, height: FRAME, clipPath: `polygon(${FRAME}px 0, calc(100% - ${FRAME}px) 0, 100% 100%, 0 100%)` }, img: `${GRAIN_H}, linear-gradient(0deg, #6A4123 0%, #82532F 50%, #9A663B 100%)` },
                { k: 'l', style: { left: 0, top: 0, bottom: 0, width: FRAME, clipPath: `polygon(0 0, 100% ${FRAME}px, 100% calc(100% - ${FRAME}px), 0 100%)` }, img: `${GRAIN_V}, linear-gradient(90deg, #9C673C 0%, #7E502D 55%, #66401F 100%)` },
                { k: 'r', style: { right: 0, top: 0, bottom: 0, width: FRAME, clipPath: `polygon(0 ${FRAME}px, 100% 0, 100% 100%, 0 calc(100% - ${FRAME}px))` }, img: `${GRAIN_V}, linear-gradient(270deg, #9C673C 0%, #7E502D 55%, #66401F 100%)` },
            ] as const).map(p => (
                <div key={p.k} className="absolute" style={{ ...p.style, backgroundImage: p.img }} />
            ))}
            {/* bevel: light outer edge, dark lip where the wood meets the slate */}
            <div className="absolute inset-0" style={{ boxShadow: 'inset 0 1px 0 rgba(255,230,190,0.25), inset 0 -1px 0 rgba(0,0,0,0.5)' }} />
            <div className="absolute" style={{ inset: FRAME - 2, border: '2px solid rgba(40,22,10,0.55)', borderRadius: 3 }} />
            <Screw style={{ left: 4, top: 4 }} />
            <Screw style={{ right: 4, top: 4 }} />
            <Screw style={{ left: 4, bottom: 4 }} />
            <Screw style={{ right: 4, bottom: 4 }} />

            {/* chalk ledge: chalk pieces, a broken stub, dust, and the duster */}
            <div className="absolute left-[6%] right-[6%] bottom-0 h-[12px] rounded-t-[3px]"
                style={{ backgroundColor: '#7E5030', backgroundImage: `${WOOD_GRAIN}, linear-gradient(180deg, #A06C42, #6A4224)`, boxShadow: '0 -2px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                {/* dust on the ledge */}
                <span className="absolute left-[4%] right-[30%] top-0 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(244,241,232,0.35), rgba(244,241,232,0.15), transparent)' }} />
                <span className="absolute -top-[4px] left-[10%] w-10 h-[6px] rounded-full" style={{ background: 'linear-gradient(180deg, #FFFFFF, #E2DDD0)', boxShadow: '0 1px 1px rgba(0,0,0,0.35)' }} />
                <span className="absolute -top-[4px] left-[16%] w-[14px] h-[6px] rounded-full rotate-12" style={{ background: 'linear-gradient(180deg, #FFFFFF, #E2DDD0)', boxShadow: '0 1px 1px rgba(0,0,0,0.35)' }} />
                <span className="absolute -top-[4px] left-[20%] w-7 h-[6px] rounded-full -rotate-6" style={{ background: 'linear-gradient(180deg, #FBEFA0, #E9D46A)', boxShadow: '0 1px 1px rgba(0,0,0,0.35)' }} />
                <span className="absolute -top-[4px] left-[25%] w-6 h-[6px] rounded-full rotate-3" style={{ background: 'linear-gradient(180deg, #F9C6D0, #E79AAB)', boxShadow: '0 1px 1px rgba(0,0,0,0.35)' }} />
                {/* duster: wooden back, felt bottom */}
                <span className="absolute -top-[11px] right-[12%] w-16 h-[13px] rounded-[3px]"
                    style={{ background: 'linear-gradient(180deg, #5B3A22 0 50%, #CFC9BA 50%)', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
            </div>
        </div>
    );
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ChalkField({ value, onChange, placeholder, width }: {
    value: string; onChange: (v: string) => void; placeholder: string; width: number;
}) {
    return (
        <input value={value} placeholder={placeholder}
            onChange={e => onChange(e.target.value.slice(0, 24))}
            className="bg-transparent outline-none border-b border-dashed border-[#F4F1E8]/25 focus:border-[#F4F1E8]/60 placeholder:text-[#F4F1E8]/25 px-0.5"
            style={{ width, fontFamily: HAND, fontSize: 22, fontWeight: 700, color: CHALK, lineHeight: 1.1 }} />
    );
}

/**
 * The morning header, written in chalk. Date, day and the thought fill themselves
 * in; class and subject are typed by the teacher (remembered on this device).
 * Sits above the drawing canvas only where the fields are, so the rest of the board stays writable.
 */
export function BoardHeader() {
    const [cls, setCls] = usePersisted('boardClass', '');
    const [subject, setSubject] = usePersisted('boardSubject', '');
    const [today, setToday] = useState<Date | null>(null);
    useEffect(() => {
        const tick = () => setToday(new Date());
        const first = setTimeout(tick, 0);
        const id = setInterval(tick, 60_000); // a board left open overnight still shows the right date
        return () => { clearTimeout(first); clearInterval(id); };
    }, []);
    const thought = today ? getTodaysThought() : null;
    const label: React.CSSProperties = { fontFamily: HAND, fontSize: 21, color: 'rgba(244,241,232,0.8)', fontWeight: 700 };
    const value: React.CSSProperties = { fontFamily: HAND, fontSize: 22, color: CHALK, fontWeight: 700 };

    return (
        <>
            {/* left: Class / Subject */}
            <div className="absolute z-[25] select-none" style={{ left: FRAME + 18, top: FRAME + 12 }}>
                <div className="flex items-baseline gap-1.5"><span style={label}>Class:</span><ChalkField value={cls} onChange={setCls} placeholder="____" width={90} /></div>
                <div className="flex items-baseline gap-1.5 mt-0.5"><span style={label}>Subject:</span><ChalkField value={subject} onChange={setSubject} placeholder="______" width={120} /></div>
            </div>

            {/* middle: today's thought (same as the Overview board), one line */}
            {thought && (
                <div className="absolute z-[5] select-none pointer-events-none text-center whitespace-nowrap overflow-hidden text-ellipsis"
                    title={thought.text}
                    style={{
                        left: '50%', top: FRAME + 16, transform: 'translateX(-50%)', width: 'min(52%, 760px)',
                        fontFamily: HAND, fontWeight: 700, color: CHALK, lineHeight: 1.2,
                        fontSize: thought.text.length > 90 ? 21 : thought.text.length > 60 ? 25 : 29,
                    }}>
                    &ldquo;{thought.text}&rdquo;
                </div>
            )}

            {/* right: Date / Day */}
            <div className="absolute z-[25] select-none" style={{ right: FRAME + 18, top: FRAME + 12 }}>
                <div className="flex items-baseline gap-1.5 justify-end"><span style={label}>Date:</span>
                    <span style={value}>{today ? `${pad2(today.getDate())}/${pad2(today.getMonth() + 1)}/${today.getFullYear()}` : ''}</span></div>
                <div className="flex items-baseline gap-1.5 justify-end mt-0.5"><span style={label}>Day:</span>
                    <span style={value}>{today ? DAYS[today.getDay()] : ''}</span></div>

            </div>
        </>
    );
}
