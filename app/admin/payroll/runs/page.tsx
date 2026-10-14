'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, CalendarRange, ChevronRight, ChevronLeft, Trash2, Loader2, Check, CalendarClock, Wallet, TrendingUp, Hourglass, CalendarDays, ReceiptText } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { formatINR, monthLabel } from '@/lib/payroll';
import { PageHeader, PrimaryButton, EmptyState, Pill, TERRACOTTA } from '../_components/ui';

interface PayrollRun {
    id: string; month: string; status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED'; publishState?: 'RUNNING' | 'FAILED' | null; publishedAt: string | null;
    staffCount: number; totalNetPay: number; paidCount: number;
    submittedAt?: string | null; approvedAt?: string | null; lastPaidAt?: string | null; approvedByName?: string | null;
}

// ── month helpers (months are "YYYY-MM") ──
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const addMonths = (month: string, n: number) => { const [y, m] = month.split('-').map(Number); return ym(new Date(y, m - 1 + n, 1)); };
const shortMonth = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short' }); };
/** Indian financial year (April to March) that a month falls in, as its starting year. */
const fyOf = (month: string) => { const [y, m] = month.split('-').map(Number); return m >= 4 ? y : y - 1; };
const fyMonths = (fy: number) => Array.from({ length: 12 }, (_, i) => ym(new Date(fy, 3 + i, 1)));
const fyLabel = (fy: number) => `FY ${fy}-${String(fy + 1).slice(2)}`;

const isFullyPaid = (r: PayrollRun) => r.status === 'PUBLISHED' && r.staffCount > 0 && r.paidCount >= r.staffCount;

// Where a run is in its life: 0 draft · 1 approval · 2 approved · 3 published · 4 paid.
function stepOf(r: PayrollRun): number {
    if (isFullyPaid(r)) return 4;
    return { DRAFT: 0, PENDING_APPROVAL: 1, APPROVED: 2, PUBLISHED: 3 }[r.status];
}
const STEPS = ['Draft', 'Approval', 'Approved', 'Published', 'Paid'];

function nextAction(r: PayrollRun): string {
    if (r.publishState === 'RUNNING') return 'See publishing';
    if (r.publishState === 'FAILED') return 'Retry publishing';
    switch (r.status) {
        case 'DRAFT': return 'Check & send for approval';
        case 'PENDING_APPROVAL': return 'Review & approve';
        case 'APPROVED': return 'Pay & publish';
        default: return isFullyPaid(r) ? 'View payslips' : 'Mark salaries paid';
    }
}

function StatusPill({ run }: { run: PayrollRun }) {
    if (run.publishState === 'RUNNING') return <Pill tone="amber">Publishing…</Pill>;
    if (run.publishState === 'FAILED') return <Pill tone="red">Publish stopped</Pill>;
    if (isFullyPaid(run)) return <Pill tone="green">Paid</Pill>;
    if (run.status === 'PUBLISHED') return <Pill tone="green">Published</Pill>;
    if (run.status === 'APPROVED') return <Pill tone="primary">Approved</Pill>;
    if (run.status === 'PENDING_APPROVAL') return <Pill tone="amber">Waiting for approval</Pill>;
    return <Pill>Draft</Pill>;
}

function MiniStat({ icon: Icon, label, value, sub, onClick }: { icon: React.ElementType; label: string; value: string; sub?: string; onClick?: () => void }) {
    return (
        <div onClick={onClick} role={onClick ? 'button' : undefined}
            className={`h-full flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card px-3 py-1.5 ${onClick ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`} data-admin-surface="">
            <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0"><Icon size={14} className="text-muted-foreground" /></div>
            <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{label}</p>
                <p className="text-sm font-bold leading-tight truncate">{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
            </div>
        </div>
    );
}

// ── Month receipt ─────────────────────────────────────────────────────
// Each month is drawn as a printed paper receipt: thermal-print type,
// dotted leaders, a barcode, a torn zig-zag bottom and a rubber stamp.
// The paper stays paper-coloured in dark mode too, like the real thing.
const TILTS = [-1.2, 0.8, -0.4, 1.1, -0.9, 0.5];
const PRINT_MS = 2600; // one printer feed; keep in sync with qx-feed
const MIN_PRINTS = 3; // minimum feeds shown when a payroll is run
const PAPER = '#FFFDF6';
const INK = '#2A2A33';
const TORN = {
    WebkitMask: 'linear-gradient(#000 0 0) top/100% calc(100% - 7px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/14px 14px repeat-x',
    mask: 'linear-gradient(#000 0 0) top/100% calc(100% - 7px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/14px 14px repeat-x',
} as React.CSSProperties;
// Paper grain (SVG noise) and how much a receipt has yellowed with age.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
function paperTone(monthsOld: number): { top: string; bottom: string; ink: number } {
    if (monthsOld <= 0) return { top: '#FFFDF6', bottom: '#FBF7EC', ink: 1 };
    if (monthsOld <= 2) return { top: '#FFFAEC', bottom: '#F8F1DE', ink: 0.97 };
    if (monthsOld <= 5) return { top: '#FBF4DF', bottom: '#F3E8C9', ink: 0.93 };
    return { top: '#F7EDD2', bottom: '#EDDFB8', ink: 0.88 };
}
const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

// "▲ ₹5,000 vs SEP" - change from the month before, so a jump stands out.
function VsLastMonth({ run, prev }: { run: PayrollRun; prev: PayrollRun | null }) {
    if (!prev) return <p className="text-[9.5px] text-right opacity-50 tracking-wide mt-0.5">FIRST MONTH ON RECORD</p>;
    const [py, pm] = prev.month.split('-').map(Number);
    const prevName = new Date(py, pm - 1, 1).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
    const diff = run.totalNetPay - prev.totalNetPay;
    const staffDiff = run.staffCount - prev.staffCount;
    const same = Math.round(diff / 100) === 0;
    const color = same ? `${INK}99` : diff > 0 ? '#B45309' : '#15803D';
    return (
        <p className="text-[9.5px] text-right tracking-wide mt-0.5 font-bold" style={{ color }}>
            {same ? `= SAME AS ${prevName}` : `${diff > 0 ? '▲' : '▼'} ${rupees(Math.abs(diff))} VS ${prevName}`}
            {staffDiff !== 0 && <span className="font-normal opacity-80"> · {staffDiff > 0 ? '+' : ''}{staffDiff} STAFF</span>}
        </p>
    );
}

// ── Grand total for the year: one long receipt ─────────────────────────
const TORN_BOTH = {
    WebkitMask: 'conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) top/14px 7px repeat-x, linear-gradient(#000 0 0) center/100% calc(100% - 14px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/14px 7px repeat-x',
    mask: 'conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) top/14px 7px repeat-x, linear-gradient(#000 0 0) center/100% calc(100% - 14px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom/14px 7px repeat-x',
} as React.CSSProperties;

function GrandReceipt({ fy, byMonth, school }: { fy: number; byMonth: Map<string, PayrollRun>; school?: string }) {
    const months = fyMonths(fy);
    const published = months.map(m => byMonth.get(m)).filter((r): r is PayrollRun => !!r && r.status === 'PUBLISHED');
    const total = published.reduce((t, r) => t + r.totalNetPay, 0);
    const top = published.reduce<PayrollRun | null>((best, r) => (!best || r.totalNetPay > best.totalNetPay ? r : best), null);
    const allPaid = months.every(m => { const r = byMonth.get(m); return r && isFullyPaid(r); });
    const dash = <div className="my-1.5 border-t border-dashed" style={{ borderColor: `${INK}66` }} />;
    const short = (m: string) => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm - 1, 1).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() + ' ' + String(y).slice(2); };
    const cell = (m: string) => {
        const r = byMonth.get(m);
        if (!r) return '-';
        if (r.status === 'PUBLISHED') return rupees(r.totalNetPay);
        return r.status === 'DRAFT' ? 'DRAFT' : r.status === 'APPROVED' ? 'APPROVED' : 'PENDING';
    };

    return (
        <div className="w-full max-w-[330px]" style={{ transform: 'rotate(-0.6deg)', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.12)) drop-shadow(0 10px 16px rgba(0,0,0,0.14))' }}>
            <div className="relative px-5 pt-5 pb-6 font-mono text-[11.5px] leading-[1.6]"
                style={{ ...TORN_BOTH, color: INK, background: `linear-gradient(180deg, #FFFDF6 0%, #FBF7EC 100%)` }}>
                <div className="absolute inset-0 pointer-events-none opacity-[0.16] mix-blend-multiply" style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }} />
                <div className="relative">
                    <div className="text-center">
                        <p className="text-[11px] font-bold tracking-[0.08em] uppercase leading-tight">{school || 'Payroll'}</p>
                        <p className="text-[10px] tracking-[0.2em] opacity-60">YEARLY PAYROLL SUMMARY</p>
                    </div>
                    {dash}
                    <div className="relative">
                        <p className="text-center text-[16px] font-bold tracking-wider">{fyLabel(fy).toUpperCase()}</p>
                        <Stamp text={allPaid ? 'YEAR DONE' : 'IN PROGRESS'} color={allPaid ? '#16A34A' : '#B7791F'} rotate={-8} />
                    </div>
                    {dash}
                    {months.map(m => <Row key={m} label={short(m)} value={cell(m)} />)}
                    {dash}
                    <Row label="MONTHS PUBLISHED" value={`${published.length}/12`} />
                    <Row label="AVERAGE MONTH" value={published.length ? rupees(Math.round(total / published.length)) : '-'} />
                    <Row label="HIGHEST MONTH" value={top ? short(top.month) : '-'} />
                    {dash}
                    <div className="text-[13px]"><Row label="GRAND TOTAL" value={rupees(total)} bold /></div>
                    {dash}
                    <div className="mt-2"><Barcode seed={`fy-${fy}-${total}`} /></div>
                    <p className="text-center text-[9.5px] tracking-[0.2em] opacity-60 mt-0.5">#QX-FY{fy}</p>
                    <p className="text-center text-[10px] tracking-[0.15em] opacity-70 mt-2">** KEEP FOR YOUR RECORDS **</p>
                </div>
            </div>
        </div>
    );
}

// Handwritten "Approved by" signature (blank line until someone approves).
function Signature({ name }: { name: string | null }) {
    return (
        <div className="mt-1.5 flex items-end gap-1.5">
            <span className="text-[8.5px] tracking-wider opacity-60 shrink-0 mb-[2px]">APPROVED BY</span>
            <div className="relative flex-1 min-w-0 border-b" style={{ borderColor: `${INK}66` }}>
                {name && (
                    <span className="block truncate text-[17px] leading-none -mb-[3px] pl-0.5" title={name}
                        style={{ fontFamily: '"Caveat", cursive', fontWeight: 700, color: '#1E3A8A', transform: 'rotate(-3deg)', transformOrigin: 'left bottom' }}>
                        {name}
                    </span>
                )}
                {!name && <span className="block h-[15px]" />}
            </div>
        </div>
    );
}

// Small metal paper clip on the top-left edge of a printed receipt.
// Drawn crisp: solid strokes (dark edge + light highlight), no filter, kept
// outside the receipt's drop-shadow layer so it isn't rasterised and blurred.
function PaperClip() {
    const d = 'M13 10 V36 a5 5 0 0 1 -10 0 V7.5 a4 4 0 0 1 8 0 V33 a1.8 1.8 0 0 1 -3.6 0 V12.5';
    return (
        <svg className="absolute -top-3.5 left-2.5 z-20 pointer-events-none -rotate-12 transition-transform duration-200 group-hover/rc:-translate-y-1" width="18" height="48" viewBox="0 0 18 48" aria-hidden shapeRendering="geometricPrecision">
            {/* soft shadow: an offset, see-through copy (no filter, so the clip itself stays sharp) */}
            <path d={d} transform="translate(0.9 1.4)" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke="#5E6372" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke="#D8DBE2" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function Barcode({ seed }: { seed: string }) {
    // Stable pseudo-random bars from the run id.
    let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const bars: number[] = [];
    for (let i = 0; i < 34; i++) { h = (h * 1103515245 + 12345) >>> 0; bars.push(1 + (h % 3)); }
    return (
        <div className="flex items-stretch justify-center gap-[1.5px] h-6">
            {bars.map((w, i) => <span key={i} style={{ width: w, background: INK, opacity: i % 7 === 3 ? 0.55 : 0.9 }} />)}
        </div>
    );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <div className={`flex items-end gap-1 ${bold ? 'font-bold' : ''}`}>
            <span className="shrink-0">{label}</span>
            <span className="flex-1 border-b border-dotted mb-[3px]" style={{ borderColor: `${INK}55` }} />
            <span className="shrink-0 tabular-nums">{value}</span>
        </div>
    );
}

function Stamp({ text, color, date, rotate = -14 }: { text: string; color: string; date?: string | null; rotate?: number }) {
    return (
        <span className="absolute right-0 top-1/2 z-[1] px-2 pt-1 pb-[3px] rounded-[4px] text-center leading-none pointer-events-none select-none"
            style={{ color, background: `${PAPER}CC`, border: `2.5px solid ${color}`, boxShadow: `inset 0 0 0 1.5px ${PAPER}, inset 0 0 0 3px ${color}`, transform: `translateY(-50%) rotate(${rotate}deg)`, opacity: 0.88, mixBlendMode: 'multiply' }}>
            <span className="block text-[13.5px] font-extrabold tracking-[0.12em]">{text}</span>
            {date && <span className="block text-[9.5px] font-bold tracking-[0.12em] mt-[3px]">{date}</span>}
        </span>
    );
}
const stampDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase() : null;

function stampFor(run: PayrollRun): { text: string; color: string; date?: string | null } {
    if (run.publishState === 'RUNNING') return { text: 'PRINTING', color: '#B7791F' };
    if (run.publishState === 'FAILED') return { text: 'RETRY', color: '#D93025' };
    if (isFullyPaid(run)) return { text: 'PAID', color: '#16A34A', date: stampDate(run.lastPaidAt ?? run.publishedAt) };
    if (run.status === 'PUBLISHED') return { text: 'PART PAID', color: '#B7791F', date: stampDate(run.lastPaidAt ?? run.publishedAt) };
    if (run.status === 'APPROVED') return { text: 'APPROVED', color: '#2F5BEA', date: stampDate(run.approvedAt) };
    if (run.status === 'PENDING_APPROVAL') return { text: 'PENDING', color: '#B7791F', date: stampDate(run.submittedAt) };
    return { text: 'DRAFT', color: '#7A7A85' };
}

function Receipt({ month, run, prev, tilt, isCurrent, canRun, busy, disabled, fresh, school, onOpen, onRun, onDelete }: {
    month: string; run: PayrollRun | null; prev?: PayrollRun | null; tilt: number; isCurrent: boolean; canRun: boolean; busy: boolean; disabled: boolean; fresh?: boolean; school?: string;
    onOpen: (id: string) => void; onRun: () => void; onDelete: (r: PayrollRun) => void;
}) {
    const [y, m] = month.split('-').map(Number);
    const title = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase();
    const faded = !run && !canRun;
    const stamp = run ? stampFor(run) : null;
    const now = new Date();
    const monthsOld = run ? (now.getFullYear() * 12 + now.getMonth()) - (y * 12 + m - 1) : 0;
    const tone = paperTone(monthsOld);

    const paper = (
        <div className="relative px-3 pt-3 pb-4 font-mono text-[11.5px] leading-[1.55]"
            style={{ ...TORN, color: INK, background: `linear-gradient(180deg, ${tone.top} 0%, ${tone.bottom} 100%)` }}>
            {/* paper grain */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.16] mix-blend-multiply" style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }} />
            {/* fold crease across the middle */}
            <div className="absolute inset-x-0 top-[54%] h-[3px] pointer-events-none"
                style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.02) 45%, rgba(255,255,255,0.7) 55%, rgba(255,255,255,0) 100%)' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.025) 54%, rgba(0,0,0,0) 54.4%, rgba(255,255,255,0.18) 100%)' }} />
            {/* older receipts: the thermal print fades a little */}
            <div className="relative" style={{ opacity: tone.ink }}>
            <div className="text-center">
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase leading-tight line-clamp-2 break-words" title={school || undefined}>{school || 'Payroll'}</p>
                <p className="text-[10px] tracking-[0.2em] opacity-60">PAYROLL RECEIPT</p>
            </div>
            <div className="my-1.5 border-t border-dashed" style={{ borderColor: `${INK}66` }} />
            {/* month line keeps its normal height; the stamp floats over the dashed lines around it */}
            <div className="relative">
                <p className={`text-[15px] font-bold tracking-wider whitespace-nowrap ${stamp ? 'text-left' : 'text-center'}`}>{title}</p>
                {stamp && <Stamp text={stamp.text} color={stamp.color} date={stamp.date} rotate={stamp.text === 'PAID' ? -10 : -7} />}
            </div>
            <div className="my-1.5 border-t border-dashed" style={{ borderColor: `${INK}66` }} />

            {busy && !run ? (
                <div className="h-[100px] flex flex-col justify-center gap-1.5">
                    <p className="text-center text-[11px] font-bold tracking-[0.2em]">PRINTING<span className="qx-dots" /></p>
                    {[70, 55, 85].map((w, i) => <div key={i} className="h-[5px] rounded-sm qx-ink" style={{ width: `${w}%`, background: `${INK}22`, animationDelay: `${i * 0.25}s` }} />)}
                </div>
            ) : run ? (
                <>
                    <Row label="STAFF" value={String(run.staffCount)} />
                    <Row label="PAID" value={run.status === 'PUBLISHED' ? `${run.paidCount}/${run.staffCount}` : '-'} />
                    <div className="my-1 border-t border-dashed" style={{ borderColor: `${INK}66` }} />
                    <Row label="TOTAL" value={rupees(run.totalNetPay)} bold />
                    <VsLastMonth run={run} prev={prev ?? null} />
                    <Signature name={run.approvedByName ?? null} />
                    <div className="mt-2"><Barcode seed={run.id} /></div>
                    <p className="text-center text-[9.5px] tracking-[0.2em] opacity-60 mt-0.5">#QX-{month.replace('-', '')}</p>
                </>
            ) : (
                <div className="h-[100px] flex flex-col items-center justify-center gap-1 text-center">
                    <p className="text-[10.5px] opacity-50 tracking-wider">{canRun ? 'NOT PRINTED YET' : 'COMING UP'}</p>
                    {canRun && (
                        <button type="button" disabled={disabled} onClick={e => { e.stopPropagation(); onRun(); }}
                            className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded-md text-[11.5px] font-bold text-white font-sans transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                            style={{ background: TERRACOTTA }}>
                            <Plus size={11} /> Run payroll
                        </button>
                    )}
                </div>
            )}
            </div>
        </div>
    );

    if (busy && !run) {
        // Receipt feeding out of a printer slot.
        return (
            <div className="relative" style={{ transform: `rotate(${tilt}deg)` }}>
                <style>{`
                    @keyframes qx-feed { 0% { transform: translateY(-100%); } 12% { transform: translateY(-88%); } 24% { transform: translateY(-70%); } 40% { transform: translateY(-48%); } 58% { transform: translateY(-26%); } 78% { transform: translateY(-6%); } 100% { transform: translateY(0); } }
                    @keyframes qx-ink { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
                    @keyframes qx-dots { 0% { content: ''; } 33% { content: '.'; } 66% { content: '..'; } 100% { content: '...'; } }
                    .qx-ink { animation: qx-ink 1s ease-in-out infinite; }
                    .qx-dots::after { content: ''; animation: qx-dots 1.2s steps(1) infinite; }
                `}</style>
                <div className="relative z-10 h-4 -mx-1.5 rounded-md shadow-md" style={{ background: 'linear-gradient(180deg, #4A4E5E 0%, #262833 100%)' }}>
                    <div className="absolute left-2 right-2 bottom-1 h-[3px] rounded-full bg-black/60" />
                    <span className="absolute right-2 top-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="overflow-hidden -mt-1.5" style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.12))' }}>
                    <div style={{ animation: `qx-feed ${PRINT_MS}ms ease-out infinite` }}>{paper}</div>
                </div>
            </div>
        );
    }

    return (
        <div className={`group/rc relative ${faded ? 'opacity-35' : ''}`} style={{ transform: `rotate(${tilt}deg)` }}>
            {fresh && <style>{`@keyframes qx-pop { 0% { transform: translateY(-14px) scale(.97); } 60% { transform: translateY(3px) scale(1.01); } 100% { transform: none; } } .qx-pop { animation: qx-pop .5s ease-out; }`}</style>}
            {isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-wider text-white shadow-sm" style={{ background: '#DA7756', transform: 'translateX(-50%) rotate(-3deg)' }}>
                    THIS MONTH
                </span>
            )}
            {run && <PaperClip />}
            {fresh && (
                <span className="absolute -top-2.5 right-2 z-10 px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-wider text-white shadow-sm animate-bounce" style={{ background: '#16A34A' }}>
                    JUST PRINTED
                </span>
            )}
            <div role={run ? 'button' : undefined} tabIndex={run ? 0 : -1}
                onClick={() => { if (run) onOpen(run.id); }}
                onKeyDown={e => { if (run && e.key === 'Enter') onOpen(run.id); }}
                className={`group relative transition-transform duration-200 ${run ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'} ${!run && canRun ? 'opacity-80 hover:opacity-100' : ''} ${fresh ? 'qx-pop' : ''}`}
                style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.12)) drop-shadow(0 6px 10px rgba(0,0,0,0.12))' }}>
                {paper}
                {run?.status === 'DRAFT' && (
                    <button title="Delete draft" onClick={e => { e.stopPropagation(); onDelete(run); }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-opacity"
                        style={{ color: '#D93025' }}>
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function PayrollRunsPage() {
    const router = useRouter();
    const [runs, setRuns] = useState<PayrollRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingMonth, setCreatingMonth] = useState<string | null>(null);
    const [toDelete, setToDelete] = useState<PayrollRun | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [payDay, setPayDay] = useState<number | null>(null);
    const [justPrinted, setJustPrinted] = useState<string | null>(null);
    const [schoolName, setSchoolName] = useState('');
    const [view, setView] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

    const today = new Date();
    const thisMonth = ym(today);
    const [fy, setFy] = useState(fyOf(thisMonth));

    const fetchRuns = useCallback(() => {
        return api.get('/admin/payroll/runs')
            .then(res => setRuns(res.data.data ?? []))
            .catch(() => setRuns([]))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { fetchRuns(); }, [fetchRuns]);
    useEffect(() => {
        api.get('/admin/payroll/settings').then(r => setPayDay(Number(r.data.data?.payDay) || 1)).catch(() => setPayDay(null));
        // School name printed at the top of every receipt.
        api.get('/admin/me').then(r => setSchoolName((r.data?.data ?? r.data)?.name ?? '')).catch(() => {});
    }, []);

    const byMonth = useMemo(() => new Map(runs.map(r => [r.month, r])), [runs]);

    // The month that needs attention: the latest run not fully paid yet, otherwise the next month to run.
    const focus = useMemo(() => {
        const sorted = [...runs].sort((a, b) => b.month.localeCompare(a.month));
        const open = sorted.find(r => !isFullyPaid(r));
        if (open) return { month: open.month, run: open as PayrollRun | null };
        const next = sorted.length ? addMonths(sorted[0].month, 1) : thisMonth;
        return { month: next < thisMonth ? thisMonth : next, run: null };
    }, [runs, thisMonth]);

    // Next salary day from today (Settings → Salary day).
    const salaryDay = useMemo(() => {
        if (!payDay) return null;
        let d = new Date(today.getFullYear(), today.getMonth(), payDay);
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (d < start) d = new Date(today.getFullYear(), today.getMonth() + 1, payDay);
        const days = Math.round((d.getTime() - start.getTime()) / 86400000);
        return { date: d, days };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payDay]);

    const fyRuns = runs.filter(r => fyOf(r.month) === fy);
    const fyPaid = fyRuns.filter(r => r.status === 'PUBLISHED');
    const fyTotal = fyPaid.reduce((t, r) => t + r.totalNetPay, 0);
    const pending = [...runs].filter(r => r.status !== 'PUBLISHED').sort((a, b) => a.month.localeCompare(b.month));

    const createRun = async (month: string) => {
        const existing = byMonth.get(month);
        if (existing) { router.push(`/admin/payroll/runs/${existing.id}`); return; }
        setCreatingMonth(month);
        const started = Date.now();
        try {
            await api.post('/admin/payroll/runs', { month });
            // The printer always runs at least MIN_PRINTS full feeds, and always finishes the
            // feed it's on, however long the server took.
            const elapsed = Date.now() - started;
            const wait = Math.max(MIN_PRINTS, Math.ceil(elapsed / PRINT_MS)) * PRINT_MS - elapsed;
            await new Promise(r => setTimeout(r, wait));
            await fetchRuns();
            setJustPrinted(month);
            setTimeout(() => setJustPrinted(m => (m === month ? null : m)), 5000);
            toast.success(`${monthLabel(month)} payroll printed. Click the receipt to open it.`);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to start payroll'));
        } finally {
            setCreatingMonth(null);
        }
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/payroll/runs/${toDelete.id}`);
            toast.success('Draft deleted');
            setToDelete(null);
            fetchRuns();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to delete'));
        } finally {
            setDeleting(false);
        }
    };

    const creating = !!creatingMonth;
    const focusStep = focus.run ? stepOf(focus.run) : -1;

    return (
        // -mb-4: the payroll layout adds 24px under every page; keep only 8px here.
        <div className="space-y-3 -mb-4">
            <PageHeader title="Payroll Runs" subtitle="One run per month: check salaries, get approval, pay and publish payslips">
                <PrimaryButton onClick={() => focus.run ? router.push(`/admin/payroll/runs/${focus.run.id}`) : createRun(focus.month)} disabled={creating || loading}>
                    {focus.run ? <>Open {monthLabel(focus.month)} <ChevronRight size={14} /></> : <><Plus size={14} /> Run {monthLabel(focus.month)}</>}
                </PrimaryButton>
            </PageHeader>

            {/* Shown while a run is being created (salaries are worked out on the server). */}
            {creating && (
                <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" data-admin-surface="">
                    <div className="flex items-center gap-3 px-4 py-3">
                        <Loader2 size={18} className="animate-spin text-muted-foreground shrink-0" />
                        <div>
                            <p className="text-sm font-semibold">Printing {monthLabel(creatingMonth!)} payroll…</p>
                            <p className="text-xs text-muted-foreground">Working out salaries for all active staff. The receipt appears below when it's done.</p>
                        </div>
                    </div>
                    <div className="h-1 bg-muted overflow-hidden">
                        <div className="h-full w-1/3 rounded-full animate-[payroll-progress_1.2s_ease-in-out_infinite]" style={{ background: TERRACOTTA }} />
                    </div>
                    <style>{`@keyframes payroll-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    <div className="h-36 rounded-2xl bg-muted/40 animate-pulse" />
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />)}</div>
                </div>
            ) : (
                <>
                    {/* ── This month (left) + numbers that matter (right), 50/50 ── */}
                    <div className="grid gap-3 lg:grid-cols-2 items-stretch">
                        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card px-4 py-2 sm:px-5 flex flex-col justify-center gap-2" data-admin-surface="">
                            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-[0.12] pointer-events-none" style={{ background: TERRACOTTA }} />
                            {/* month + status | amount */}
                            <div className="relative flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{focus.run ? 'In progress' : 'Up next'}</p>
                                    <p className="text-lg font-bold leading-tight" style={{ fontFamily: 'var(--font-poppins)' }}>{monthLabel(focus.month)}</p>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                        {focus.run ? <StatusPill run={focus.run} /> : <Pill>Not run yet</Pill>}
                                        {salaryDay && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                                <CalendarClock size={11} />
                                                {salaryDay.days === 0 ? 'Salary day is today' : `Salary day in ${salaryDay.days} day${salaryDay.days === 1 ? '' : 's'}`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {focus.run ? (
                                    <div className="text-right shrink-0">
                                        <p className="text-lg font-bold leading-tight">{formatINR(focus.run.totalNetPay)}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            take-home · {focus.run.staffCount} staff{focus.run.status === 'PUBLISHED' ? ` · ${focus.run.paidCount}/${focus.run.staffCount} paid` : ''}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground text-right max-w-[180px]">Salaries are worked out for all active staff automatically.</p>
                                )}
                            </div>

                            {/* life of the run | next action */}
                            <div className="relative flex items-center gap-3">
                                <div className="flex-1 min-w-0 flex items-center">
                                    {STEPS.map((label, i) => {
                                        const done = focusStep > i || focusStep === 4;
                                        const current = focusStep === i && focusStep !== 4;
                                        return (
                                            <div key={label} className="flex items-center flex-1 last:flex-none">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${done ? 'border-transparent text-white' : current ? 'border-[#DA7756] text-[#DA7756] ring-4 ring-[#DA7756]/15' : 'border-border text-muted-foreground'}`}
                                                        style={done ? { background: TERRACOTTA } : undefined}>
                                                        {done ? <Check size={12} strokeWidth={3} /> : i + 1}
                                                    </div>
                                                    <span className={`text-[10px] whitespace-nowrap ${current ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                                                </div>
                                                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 mb-[18px] rounded-full ${focusStep > i ? 'bg-[#DA7756]' : 'bg-border'}`} />}
                                            </div>
                                        );
                                    })}
                                </div>
                                <PrimaryButton className="shrink-0" onClick={() => focus.run ? router.push(`/admin/payroll/runs/${focus.run.id}`) : createRun(focus.month)} disabled={creating}>
                                    {focus.run ? <>{nextAction(focus.run)} <ChevronRight size={14} /></> : <><Plus size={14} /> Run payroll</>}
                                </PrimaryButton>
                            </div>
                        </div>

                        <div className="grid gap-2 grid-cols-2">
                            <MiniStat icon={Wallet} label={`Paid in ${fyLabel(fy)}`} value={formatINR(fyTotal)} sub={`${fyPaid.length} month${fyPaid.length === 1 ? '' : 's'} published`} />
                            <MiniStat icon={TrendingUp} label="Average month" value={fyPaid.length ? formatINR(Math.round(fyTotal / fyPaid.length)) : '–'} sub="take-home per published month" />
                            <MiniStat icon={CalendarClock} label="Next salary day"
                                value={salaryDay ? salaryDay.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '–'}
                                sub={salaryDay ? (salaryDay.days === 0 ? 'Today' : `In ${salaryDay.days} day${salaryDay.days === 1 ? '' : 's'}`) : 'Set it in Settings'} />
                            <MiniStat icon={Hourglass} label="Not published yet" value={String(pending.length)}
                                sub={pending.length ? `Oldest: ${monthLabel(pending[0].month)}` : 'Nothing pending'}
                                onClick={pending.length ? () => router.push(`/admin/payroll/runs/${pending[0].id}`) : undefined} />
                        </div>
                    </div>

                    {/* ── The year at a glance ── */}
                    <div className="rounded-2xl border border-border/60 bg-card px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-2" data-admin-surface="">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-sm font-semibold">{fyLabel(fy)}</p>
                                <p className="text-[11px] text-muted-foreground">April to March, the same year your TDS follows</p>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* same toggle style as Attendance → Daily / Overall */}
                                <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50 mr-2">
                                    {([
                                        { key: 'MONTHLY' as const, label: 'Monthly', Icon: CalendarDays },
                                        { key: 'YEARLY' as const, label: 'Yearly', Icon: ReceiptText },
                                    ]).map(({ key, label, Icon }) => (
                                        <button key={key} onClick={() => setView(key)}
                                            className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${view === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                                            <Icon size={14} />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => setFy(f => f - 1)} title="Previous year" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"><ChevronLeft size={15} /></button>
                                {fy !== fyOf(thisMonth) && <button onClick={() => setFy(fyOf(thisMonth))} className="h-7 px-2 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50">This year</button>}
                                <button onClick={() => setFy(f => f + 1)} title="Next year" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"><ChevronRight size={15} /></button>
                            </div>
                        </div>

                        {runs.length === 0 && fy === fyOf(thisMonth) && (
                            <div className="mb-3"><EmptyState icon={CalendarRange} title="No payroll runs yet" text="Press Run payroll on any month receipt below. Salaries are worked out for all active staff automatically." /></div>
                        )}

                        {view === 'MONTHLY' ? (
                        <div className="grid gap-x-4 gap-y-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 pt-1 pb-0">
                            {fyMonths(fy).map((month, i) => (
                                <Receipt key={month} month={month} run={byMonth.get(month) ?? null} tilt={TILTS[i % TILTS.length]}
                                    isCurrent={month === thisMonth} canRun={month <= addMonths(thisMonth, 1)}
                                    busy={creatingMonth === month} disabled={creating} fresh={justPrinted === month} school={schoolName}
                                    prev={byMonth.get(addMonths(month, -1)) ?? null}
                                    onOpen={id => router.push(`/admin/payroll/runs/${id}`)}
                                    onRun={() => createRun(month)} onDelete={setToDelete} />
                            ))}
                        </div>

                        ) : (
                        /* the year, totalled on one long receipt */
                        <div className="flex justify-center pt-2 pb-2">
                            <GrandReceipt fy={fy} byMonth={byMonth} school={schoolName} />
                        </div>
                        )}
                    </div>
                </>
            )}

            <DeleteConfirmDialog
                open={!!toDelete}
                onOpenChange={o => !o && setToDelete(null)}
                label="draft payroll"
                name={toDelete ? monthLabel(toDelete.month) : ''}
                loading={deleting}
                onConfirm={confirmDelete}
                description="All draft payslips in this run are removed. You can run this month again afterwards."
            />
        </div>
    );
}
