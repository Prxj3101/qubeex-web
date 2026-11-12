'use client';

import { type Receipt, modeOf, prettyDay } from '../_lib';

// A fee receipt drawn as printed thermal paper (same look as the Payroll
// receipts): mono type, dotted leaders, barcode, torn bottom and a stamp.
// Paper stays paper-coloured in dark mode too.

const PAPER = '#FFFDF6';
const INK = '#2A2A33';
const TORN = {
    WebkitMask: 'linear-gradient(#000 0 0) top/100% calc(100% - 7px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/14px 14px repeat-x',
    mask: 'linear-gradient(#000 0 0) top/100% calc(100% - 7px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/14px 14px repeat-x',
} as React.CSSProperties;
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <div className={`flex items-end gap-1 ${bold ? 'font-bold' : ''}`}>
            <span className="shrink-0 truncate max-w-[60%]">{label}</span>
            <span className="flex-1 border-b border-dotted mb-[3px]" style={{ borderColor: `${INK}55` }} />
            <span className="shrink-0 tabular-nums">{value}</span>
        </div>
    );
}

export function Stamp({ text, color, date, rotate = -14 }: { text: string; color: string; date?: string | null; rotate?: number }) {
    return (
        <span className="absolute right-0 top-1/2 z-[1] px-2 pt-1 pb-[3px] rounded-[4px] text-center leading-none pointer-events-none select-none"
            style={{ color, background: `${PAPER}CC`, border: `2.5px solid ${color}`, boxShadow: `inset 0 0 0 1.5px ${PAPER}, inset 0 0 0 3px ${color}`, transform: `translateY(-50%) rotate(${rotate}deg)`, opacity: 0.88, mixBlendMode: 'multiply' }}>
            <span className="block text-[13.5px] font-extrabold tracking-[0.12em]">{text}</span>
            {date && <span className="block text-[9.5px] font-bold tracking-[0.12em] mt-[3px]">{date}</span>}
        </span>
    );
}

function Barcode({ seed }: { seed: string }) {
    let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const bars: number[] = [];
    for (let i = 0; i < 34; i++) { h = (h * 1103515245 + 12345) >>> 0; bars.push(1 + (h % 3)); }
    return (
        <div className="flex items-stretch justify-center gap-[1.5px] h-6">
            {bars.map((w, i) => <span key={i} style={{ width: w, background: INK, opacity: i % 7 === 3 ? 0.55 : 0.9 }} />)}
        </div>
    );
}

export function PaperReceipt({ receipt, studentName, classLabel, school, tilt = 0 }: {
    receipt: Receipt;
    studentName?: string | null;
    classLabel?: string | null;
    school?: string | null;
    tilt?: number;
}) {
    const dash = <div className="my-1.5 border-t border-dashed" style={{ borderColor: `${INK}66` }} />;
    const mode = modeOf(receipt.mode);
    const [y, m, d] = receipt.day.split('-').map(Number);
    const stampDay = new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase();
    return (
        <div style={{ transform: `rotate(${tilt}deg)`, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.12)) drop-shadow(0 8px 14px rgba(0,0,0,0.14))' }}>
            <div className="relative px-4 pt-4 pb-5 font-mono text-[11.5px] leading-[1.55]"
                style={{ ...TORN, color: INK, background: `linear-gradient(180deg, ${PAPER} 0%, #FBF7EC 100%)` }}>
                <div className="absolute inset-0 pointer-events-none opacity-[0.16] mix-blend-multiply" style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }} />
                <div className={`relative ${receipt.cancelled ? 'opacity-60' : ''}`}>
                    <div className="text-center">
                        <p className="text-[11px] font-bold tracking-[0.08em] uppercase leading-tight">{school || 'School'}</p>
                        <p className="text-[10px] tracking-[0.2em] opacity-60">FEE RECEIPT</p>
                    </div>
                    {dash}
                    <div className="relative">
                        <p className="text-[13px] font-bold tracking-wider">#{receipt.receiptNo}</p>
                        <p className="text-[10px] opacity-70">{prettyDay(receipt.day).toUpperCase()}</p>
                        <Stamp text={receipt.cancelled ? 'CANCELLED' : 'PAID'} color={receipt.cancelled ? '#D93025' : '#16A34A'} date={receipt.cancelled ? null : stampDay} />
                    </div>
                    {dash}
                    {studentName && <p className="font-bold uppercase truncate">{studentName}</p>}
                    {classLabel && <p className="text-[10px] opacity-70">CLASS {classLabel}</p>}
                    {dash}
                    {receipt.lines.map(l => (
                        <div key={l.feeMonthId}>
                            <Row label={l.month.toUpperCase()} value={money(l.amount + l.discount)} />
                            {l.heads.length > 0 && <p className="text-[9.5px] opacity-60 leading-tight truncate pl-1">{l.heads.join(' + ')}</p>}
                        </div>
                    ))}
                    {dash}
                    {receipt.discount > 0 && <Row label="DISCOUNT" value={`-${money(receipt.discount)}`} />}
                    <div className="text-[13px]"><Row label="PAID" value={money(receipt.amount)} bold /></div>
                    <Row label="MODE" value={mode.label.toUpperCase()} />
                    {receipt.reference && <Row label="REF" value={receipt.reference} />}
                    {dash}
                    {receipt.cancelled && receipt.cancelReason && <p className="text-[10px] font-bold" style={{ color: '#D93025' }}>CANCELLED: {receipt.cancelReason}</p>}
                    {receipt.collectedBy && <p className="text-[9.5px] opacity-70 truncate">RECEIVED BY {receipt.collectedBy.toUpperCase()}</p>}
                    <div className="mt-2"><Barcode seed={receipt.id} /></div>
                    <p className="text-center text-[10px] tracking-[0.15em] opacity-70 mt-1.5">** THANK YOU **</p>
                </div>
            </div>
        </div>
    );
}
