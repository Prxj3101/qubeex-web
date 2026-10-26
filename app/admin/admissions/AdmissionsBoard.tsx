'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X, Info, Plus, Share2, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { EmptyState, PrimaryButton, SecondaryButton, ThemedSelect, Pill } from '@/app/admin/payroll/_components/ui';
import { UserPlus } from 'lucide-react';
import { STAGES, ago, kidImage, formatDate, formatDateTime, scrollStyle, type BoardRow, type SettingsResponse } from './admissions.types';

type Tone = 'muted' | 'primary' | 'green' | 'amber' | 'red' | 'blue';

/** The one or two tags a card shows: what is done, and what is pending. */
function tagsFor(row: BoardRow, session: SettingsResponse['session']): { text: string; tone: Tone }[] {
    const tags: { text: string; tone: Tone }[] = [];
    if (row.ageWarning && row.stage !== 'ADMITTED') tags.push({ text: row.ageWarning, tone: 'red' });
    switch (row.stage) {
        case 'ENQUIRY':
            tags.push({ text: 'Fill the form', tone: 'muted' });
            break;
        case 'REGISTERED':
            if (row.outcome === 'WAITLIST') break;
            if (row.registrationFeePaid) tags.push({ text: 'Reg. fee paid', tone: 'green' });
            break;
        case 'INTERACTION':
            tags.push(row.interactionDone ? { text: 'Needs decision', tone: 'amber' } : { text: formatDateTime(row.interactionAt), tone: 'blue' });
            break;
        case 'SELECTED':
            if (row.outcome === 'WAITLIST') tags.push({ text: `Waitlist #${row.waitlistRank ?? '-'}`, tone: 'muted' });
            else if (row.admissionFeePaid) tags.push({ text: 'Ready to admit', tone: 'blue' });
            else if (row.offerOverdue) tags.push({ text: 'Fee overdue', tone: 'red' });
            else if (row.offerDueOn) tags.push({ text: `Fee due by ${formatDate(row.offerDueOn)}`, tone: 'amber' });
            break;
        case 'ADMITTED':
            if (row.placed) tags.push({ text: row.sectionName ?? 'In class', tone: 'green' });
            else if (session.isCurrent) tags.push({ text: row.sectionName ? `To add: ${row.sectionName}` : 'Add to a class', tone: 'amber' });
            else tags.push({ text: `Joins ${session.label}`, tone: 'blue' });
            if (row.docsPending > 0) tags.push({ text: 'Provisional', tone: 'red' });
            break;
    }
    // Registration fee still unpaid stays visible at every open stage (parents sometimes pay late).
    if (row.registrationFeeDue && (!row.outcome || row.outcome === 'WAITLIST')) tags.push({ text: 'Reg. fee pending', tone: 'amber' });
    if (row.admissionFormPending) tags.push({ text: 'Admission form pending', tone: 'amber' });
    if (row.outcome && row.outcome !== 'WAITLIST') tags.unshift({ text: row.outcome === 'NOT_SELECTED' ? 'Not selected' : row.outcome === 'WITHDRAWN' ? 'Withdrawn' : 'Offer lapsed', tone: 'muted' });
    return tags;
}

const SourceIcon = ({ source }: { source: BoardRow['source'] }) => {
    const emoji = source === 'ONLINE' ? '🌐' : source === 'PHONE' ? '📞' : '🏫';
    const label = source === 'ONLINE' ? 'Online form' : source === 'PHONE' ? 'Phone enquiry' : 'At the counter';
    return (
        <span className="relative group/src inline-flex shrink-0" role="img" aria-label={label}>
            <span aria-hidden="true" className="text-[15px] leading-none">{emoji}</span>
            <span role="tooltip" className="pointer-events-none absolute left-full ml-1.5 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 transition-opacity group-hover/src:opacity-100">{label}</span>
        </span>
    );
};

// Colour of the ID card's top band, per stage.
const BAND: Record<BoardRow['stage'], { band: string; avatar: string }> = {
    ENQUIRY: { band: 'bg-slate-500', avatar: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
    REGISTERED: { band: 'bg-blue-500', avatar: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    INTERACTION: { band: 'bg-amber-500', avatar: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    SELECTED: { band: 'bg-violet-500', avatar: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
    ADMITTED: { band: 'bg-emerald-500', avatar: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
};
/** One application drawn like a school ID card. */
function IdCard({ row, session, onOpen }: { row: BoardRow; session: SettingsResponse['session']; onOpen: (id: string) => void }) {
    const c = BAND[row.stage];
    const closed = !!row.outcome && row.outcome !== 'WAITLIST';
    const tags = tagsFor(row, session);
    return (
        <button type="button" onClick={() => onOpen(row.id)} data-admin-surface=""
            className={`group w-full text-left rounded-2xl bg-white dark:bg-white/[0.07] transition hover:-translate-y-0.5 dark:hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${closed ? 'opacity-70 grayscale-[35%]' : ''}`}>
            {/* Band with the application number, like the school strip on an ID card */}
            <div className={`relative flex items-center justify-between gap-2 rounded-t-2xl ${c.band} px-3 pt-2.5 pb-2 text-white`}>
                <span aria-hidden="true" className="absolute left-1/2 top-1 h-1 w-7 -translate-x-1/2 rounded-full bg-white/45" />
                <span className="font-mono text-[10.5px] font-semibold tracking-wider">{row.applicationNo}</span>
                <span className="text-[10px] text-white/85">{ago(row.updatedAt)}</span>
            </div>
            <div className="flex gap-3 px-3 pt-3 pb-2.5">
                <span className="flex h-12 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_1px_6px_rgba(15,23,42,0.12)]">
                    {row.photoUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={row.photoUrl} alt={`${row.childName} photo`} className="h-full w-full object-cover" />
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={kidImage(row.gender)} alt="" aria-hidden="true" className="h-10 w-10 object-contain" />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold leading-tight">{row.childName}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                        <SourceIcon source={row.source} />
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold">{row.standardName}</span>
                        {row.admissionNo && <span className="truncate font-mono text-[10px] text-muted-foreground">Adm {row.admissionNo}</span>}
                    </div>
                    {row.parentName && <p className="mt-1 truncate text-[11px] text-muted-foreground">Parent: <span className="text-foreground/80">{row.parentName}</span></p>}
                    {row.phoneLast4 && <p className="truncate text-[11px] text-muted-foreground">Phone: <span className="font-mono tracking-wider text-foreground/80">•••• {row.phoneLast4}</span></p>}
                </div>
            </div>
            {tags.length > 0 && (
                <div className="mx-3 flex flex-wrap gap-1 border-t border-dashed border-foreground/10 py-2">
                    {tags.map(t => <Pill key={t.text} tone={t.tone}>{t.text}</Pill>)}
                </div>
            )}
        </button>
    );
}

export default function AdmissionsBoard({ setup, view, onOpen, onSettings, onShare, onAdd }: { setup: SettingsResponse; view: 'open' | 'closed'; onOpen: (id: string) => void; onSettings: () => void; onShare: () => void; onAdd: () => void }) {
    const [rows, setRows] = useState<BoardRow[]>([]);
    const [admitted, setAdmitted] = useState<{ standardId: string; standardName: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [standardId, setStandardId] = useState('');
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');

    useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);

    const load = useCallback((signal?: AbortSignal) => api.get('/admin/admissions/applications', { signal, params: { view, standardId: standardId || undefined, search: query || undefined } }).then(res => {
        if (!signal?.aborted) { setRows(res.data.data); setAdmitted(res.data.admitted ?? []); setError(''); }
    }).catch(err => { if (!signal?.aborted) setError(getErrorMessage(err, 'Could not load applications')); })
        .finally(() => { if (!signal?.aborted) setLoading(false); }), [view, standardId, query]);
    useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

    const columns = useMemo(() => STAGES.map(s => ({ ...s, rows: rows.filter(r => r.stage === s.key) })), [rows]);
    const session = setup.session;

    return (
        <div className="flex-1 min-h-0 min-w-0 w-full flex flex-col gap-3 pb-3">
            <div className="shrink-0 px-1">
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold">Admissions</h1>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">Session {session.label}</span>
                    </div>
                    <p className="text-muted-foreground text-[13px]">Every application from enquiry to the first day of school.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 h-9 px-3 rounded-full border border-border bg-card text-sm">
                        <Search size={14} className="text-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)} maxLength={80} placeholder="Name, number, last 4 of phone" aria-label="Search applications" className="bg-transparent outline-none w-48" />
                        {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} className="text-muted-foreground" /></button>}
                    </label>
                    <div className="w-40"><ThemedSelect value={standardId || 'ALL'} onChange={v => setStandardId(v === 'ALL' ? '' : v)} options={[{ value: 'ALL', label: 'All classes' }, ...setup.standards.map(s => ({ value: s.id, label: s.name }))]} /></div>
                    <SecondaryButton type="button" onClick={onShare} className="h-9 rounded-full"><Share2 size={14} />Share form</SecondaryButton>
                    <PrimaryButton type="button" onClick={onAdd} className="h-9 rounded-full"><Plus size={14} />Add application</PrimaryButton>
                </div>
            </div>
                <div className="h-px bg-border/60 mt-2" />
            </div>

            {!setup.settings.formOpen && (
                <div data-admin-surface="" className="shrink-0 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground">
                    <Info size={14} className="shrink-0" />
                    The online form is off, so parents can only apply at the counter.
                    <button type="button" onClick={onSettings} className="font-semibold text-primary hover:underline">Turn it on in settings</button>
                </div>
            )}


            {error ? (
                <EmptyState icon={UserPlus} title="Could not load applications" text={error}><SecondaryButton onClick={() => void load()}>Retry</SecondaryButton></EmptyState>
            ) : (
                <div className="flex-1 min-h-0 min-w-0 w-full flex gap-3 overflow-x-auto pb-1" style={scrollStyle}>
                    {columns.map(col => (
                        <section key={col.key} aria-label={col.label} data-admin-surface="" className="flex-1 basis-0 min-w-[210px] min-h-0 flex flex-col rounded-2xl border border-border/50 bg-card">
                            <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-3 pb-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${col.dot}`} /><h2 className="text-sm font-semibold">{col.label}</h2></div>
                                    <p className="text-[11px] text-muted-foreground truncate">{col.hint}</p>
                                </div>
                                {col.key === 'ADMITTED' && view === 'open' && admitted.length > 0 ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button type="button" title="Admitted in each class" aria-label="Admitted in each class"
                                                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground bg-muted pl-2 pr-1.5 py-0.5 rounded-full hover:text-foreground hover:bg-muted/70">
                                                {col.rows.length}<ChevronDown size={12} />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52">
                                            <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground">Admitted in each class</DropdownMenuLabel>
                                            {admitted.map(x => (
                                                <div key={x.standardId} className="flex items-center justify-between px-2 py-1.5 text-sm">
                                                    <span>{x.standardName}</span>
                                                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{x.count}</span>
                                                </div>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{col.rows.length}</span>}
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-2.5" style={scrollStyle}>
                                {loading && !rows.length ? <div className="h-20 rounded-xl bg-muted/50 animate-pulse" /> : col.rows.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground text-center py-6">Nothing here</p>
                                ) : col.rows.map(row => <IdCard key={row.id} row={row} session={session} onOpen={onOpen} />)}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
