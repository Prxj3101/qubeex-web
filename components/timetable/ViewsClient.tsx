'use client';

import { useMemo, useState } from 'react';
import { useRemote } from '@/hooks/useRemote';
import { PrintPortal, usePrintArea } from '@/hooks/usePrintArea';
import { Download, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { TimetableGrid, type GridLines } from './TimetableGrid';
import { classLabel, DAY_NAMES, fmtTime, STATUS_LABEL, ttApi, errMsg, type Entry, type OverviewRow, type Slot } from '@/lib/timetable';

type Kind = 'class' | 'teacher' | 'room' | 'subject' | 'master';
const KIND_LABEL: Record<Kind, string> = { class: 'Class', teacher: 'Teacher', room: 'Room', subject: 'Subject', master: 'Master (school)' };
const sel = 'rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm';

interface ViewData { title: string; workingDays: number[]; slots: Slot[]; entries: Entry[]; summary: { totalPeriods: number; perDay: { dayOfWeek: number; count: number }[]; divisions: number } }

export function ViewsClient({ initialKind, initialTargetId }: { initialKind?: Kind; initialTargetId?: string } = {}) {
    const { selectedYearId, loading: yl } = useAcademicYear();
    const [kind, setKind] = useState<Kind>(initialKind ?? 'master');
    const setupQ = useRemote(selectedYearId ? `setup:${selectedYearId}` : null, () => ttApi.setup(selectedYearId), e => toast.error(errMsg(e, 'Could not load')));
    const overviewQ = useRemote(selectedYearId ? `ov:${selectedYearId}` : null, () => ttApi.overview(selectedYearId), e => toast.error(errMsg(e, 'Could not load')));
    const setup = setupQ.data;
    const overview = useMemo(() => overviewQ.data ?? [], [overviewQ.data]);
    const { printing, start: startPrint } = usePrintArea();
    const [targetPick, setTargetPick] = useState(initialTargetId ?? '');
    const [dayPick, setDayPick] = useState(1);

    const options = useMemo(() => {
        if (!setup) return [];
        if (kind === 'teacher') return setup.teachers.map(t => ({ id: t.id, label: t.name }));
        if (kind === 'room') return setup.rooms.map(r => ({ id: r.id, label: `${r.name} (${r.type.toLowerCase()})` }));
        if (kind === 'subject') return setup.subjects.map(s => ({ id: s.id, label: s.name }));
        if (kind === 'class') return overview.map(o => ({ id: o.divisionId, label: classLabel(o.standardName, o.divisionName) }));
        return [];
    }, [kind, setup, overview]);
    // Fall back to the first option whenever the picked one doesn't belong to this kind.
    const targetId = options.some(o => o.id === targetPick) ? targetPick : (options[0]?.id ?? '');

    const needsTarget = kind !== 'master';
    const viewKey = selectedYearId && setup && (!needsTarget || targetId) ? `view:${selectedYearId}:${kind}:${targetId}` : null;
    const viewQ = useRemote<ViewData>(viewKey, async () => {
        if (kind === 'class') {
            const st = await ttApi.studio(selectedYearId, targetId);
            const name = classLabel(st.division.standardName, st.division.name);
            return {
                title: name, workingDays: st.workingDays, slots: st.slots,
                entries: st.entries.map(e => ({ ...e, divisionName: name, timetableStatus: st.timetable?.status })),
                summary: { totalPeriods: st.entries.length, perDay: st.workingDays.map(d => ({ dayOfWeek: d, count: st.entries.filter(e => e.dayOfWeek === d).length })), divisions: 1 },
            };
        }
        return ttApi.view(selectedYearId, kind as 'teacher' | 'room' | 'subject' | 'master', targetId || undefined);
    }, e => toast.error(errMsg(e)));
    const data = viewQ.data;
    const loading = viewQ.loading;
    const day = data && !data.workingDays.includes(dayPick) ? (data.workingDays[0] ?? 1) : dayPick;
    const setDay = setDayPick;

    const exportable = kind !== 'subject';
    const doExport = async (format: 'pdf' | 'xlsx') => {
        try { await ttApi.exportFile(selectedYearId, kind as 'class' | 'teacher' | 'room' | 'master', format, targetId || undefined); } catch (e) { toast.error(errMsg(e, 'Export failed')); }
    };

    if (yl || !setup) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

    const lines: GridLines = kind === 'teacher' ? 'teacher' : kind === 'room' ? 'room' : kind === 'subject' ? 'subject' : 'class';

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 print:hidden">
                <div className="flex gap-1 rounded-xl bg-muted/60 p-1 text-sm overflow-x-auto">
                    {(Object.keys(KIND_LABEL) as Kind[]).map(k => (
                        <button key={k} onClick={() => { setKind(k); setTargetPick(''); }} className={`rounded-lg px-3 py-1.5 font-medium whitespace-nowrap ${kind === k ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>{KIND_LABEL[k]}</button>
                    ))}
                </div>
                {kind !== 'master' && (
                    <select className={sel} value={targetId} onChange={e => setTargetPick(e.target.value)}>
                        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                )}
                <div className="ml-auto flex gap-2">
                    {exportable && (<>
                        <button onClick={() => void doExport('pdf')} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"><Download className="w-4 h-4" /> PDF</button>
                        <button onClick={() => void doExport('xlsx')} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"><Download className="w-4 h-4" /> Excel</button>
                    </>)}
                    <button onClick={startPrint} disabled={!data} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"><Printer className="w-4 h-4" /> Print</button>
                </div>
            </div>

            {loading && <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

            {!loading && data && (
                <>
                    <div>
                        <h2 className="text-lg font-bold">{kind === 'master' ? 'Master timetable' : data.title}</h2>
                        <p className="text-xs text-muted-foreground">
                            {data.summary.totalPeriods} periods{kind !== 'class' && kind !== 'master' ? ` across ${data.summary.divisions} class${data.summary.divisions === 1 ? '' : 'es'}` : ''}
                            {kind !== 'master' && ` · ${data.summary.perDay.map(p => `${DAY_NAMES[p.dayOfWeek].slice(0, 3)} ${p.count}`).join(' · ')}`}
                        </p>
                    </div>

                    {printing && (
                        <PrintPortal>
                            <div style={{ textAlign: 'center', marginBottom: 8 }}>
                                <div style={{ fontSize: 20, fontWeight: 700 }}>{kind === 'master' ? `Master timetable — ${DAY_NAMES[day]}` : `${KIND_LABEL[kind]}: ${data.title}`}</div>
                            </div>
                            {kind === 'master'
                                ? <MasterMatrix data={data} overview={overview} day={day} setDay={setDay} />
                                : <TimetableGrid slots={data.slots} days={data.workingDays} entries={data.entries} lines={lines} />}
                        </PrintPortal>
                    )}
                    {kind === 'master' ? (
                        <MasterMatrix data={data} overview={overview} day={day} setDay={setDay} />
                    ) : (
                        <TimetableGrid slots={data.slots} days={data.workingDays} entries={data.entries} lines={lines} />
                    )}
                </>
            )}
            {!loading && !data && kind !== 'master' && !options.length && <p className="text-sm text-muted-foreground">Nothing to show yet.</p>}
        </div>
    );
}

function MasterMatrix({ data, overview, day, setDay }: { data: ViewData; overview: OverviewRow[]; day: number; setDay: (d: number) => void }) {
    const periods = data.slots;
    const by = new Map<string, Entry>();
    for (const e of data.entries) if (e.dayOfWeek === day) by.set(`${e.divisionId}|${e.slotId}`, e);
    return (
        <div className="space-y-2">
            <div className="flex gap-1 print:hidden">
                {data.workingDays.map(d => (
                    <button key={d} onClick={() => setDay(d)} className={`rounded-lg border px-3 py-1 text-sm ${d === day ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground'}`}>{DAY_NAMES[d].slice(0, 3)}</button>
                ))}
            </div>
            <div className="hidden print:block font-semibold">{DAY_NAMES[day]}</div>
            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
                <table className="w-full border-collapse text-xs">
                    <thead><tr className="bg-muted/50"><th className="px-2 py-2 text-left sticky left-0 bg-muted/50">Class</th>
                        {periods.map((s: Slot) => <th key={s.id} className="px-2 py-2 font-semibold min-w-[110px]">{s.name}<div className="text-[10px] font-normal text-muted-foreground">{fmtTime(s.startMinute)}</div></th>)}</tr></thead>
                    <tbody>
                        {overview.map(o => (
                            <tr key={o.divisionId} className="border-t border-border/50">
                                <td className="px-2 py-1.5 font-semibold whitespace-nowrap sticky left-0 bg-card">{classLabel(o.standardName, o.divisionName)}
                                    <div className="text-[10px] font-normal text-muted-foreground">{o.status ? STATUS_LABEL[o.status] : 'Not started'}</div></td>
                                {periods.map(s => {
                                    const e = by.get(`${o.divisionId}|${s.id}`);
                                    return (
                                        <td key={s.id} className={`px-1.5 py-1 align-top border-l border-border/40 ${s.kind !== 'PERIOD' ? 'bg-muted/30' : ''}`}>
                                            {e && (<><div className="font-medium truncate" style={{ color: e.color ?? undefined }}>{e.subjectName ?? e.title ?? e.sessionTypeName}</div>
                                                <div className="text-[10px] text-muted-foreground truncate">{[e.teacherName, e.roomName].filter(Boolean).join(' · ')}</div></>)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
