'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
    Plus, Search, Users, Wallet, Pencil, Trash2, Power, PowerOff, History, Landmark, AlertTriangle, IndianRupee, Link2, Download, X, GripVertical, ChevronDown,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import {
    StaffMember, StaffType, PaymentMode, TaxDeclaration, SalaryComponent, SalaryTemplate, SalaryVersion, StructureItem, BankDetails,
    STAFF_TYPE_LABEL, PAYMENT_MODE_LABEL, formatINR, formatDate, toDateInput, todayInput, previewMonthly,
} from '@/lib/payroll';
import { PageHeader, PrimaryButton, SecondaryButton, SmallButton, EmptyState, Field, inputCls, Pill, Segmented, StatCard, PhoneInput, ThemedSelect, TERRACOTTA, Toggle } from '../_components/ui';
import { SalaryItemsEditor } from '../_components/SalaryItemsEditor';

interface LinkableProfile { userId: string; name: string; email: string; role: StaffType }

type Filter = 'ALL' | 'ACTIVE' | 'NO_SALARY' | 'INACTIVE';

interface DetailsDraft {
    id?: string;
    mode: 'new' | 'link';
    linked: LinkableProfile | null;
    name: string; email: string; phone: string; designation: string; staffType: StaffType;
    employeeCode: string; machineId: string; joinedAt: string; exitDate: string; pan: string; uan: string;
    paymentMode: PaymentMode; bank: BankDetails; pfApplicable: boolean; epsApplicable: boolean; esiApplicable: boolean; ptApplicable: boolean; esiNumber: string;
    tdsApplicable: boolean; taxRegime: 'NEW' | 'OLD'; tax: Record<TaxKey, string>; // tax declaration in rupees, as typed
}

const emptyBank: BankDetails = { accountName: '', accountNumber: '', ifsc: '', bankName: '' };

const blankDetails = (): DetailsDraft => ({
    mode: 'new', linked: null, name: '', email: '', phone: '', designation: '', staffType: 'HELPER',
    employeeCode: '', machineId: '', joinedAt: '', exitDate: '', pan: '', uan: '', paymentMode: 'BANK', bank: { ...emptyBank }, pfApplicable: true, epsApplicable: true, esiApplicable: true, ptApplicable: true, esiNumber: '', tdsApplicable: true, taxRegime: 'NEW', tax: emptyTax(),
});

// Default "Applies from" for someone already on staff: start of the current month.
function firstOfThisMonth(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
}

// Tax declaration fields (yearly, ₹). Old regime ones only count under the old regime.
type TaxKey = 'sec80C' | 'sec80D' | 'hraExempt' | 'otherDeductions' | 'prevEmployerIncome' | 'prevEmployerTds' | 'tdsBeforeQubeex';
const TAX_KEYS: TaxKey[] = ['sec80C', 'sec80D', 'hraExempt', 'otherDeductions', 'prevEmployerIncome', 'prevEmployerTds', 'tdsBeforeQubeex'];
const emptyTax = (): Record<TaxKey, string> => ({ sec80C: '', sec80D: '', hraExempt: '', otherDeductions: '', prevEmployerIncome: '', prevEmployerTds: '', tdsBeforeQubeex: '' });
function taxToText(t: TaxDeclaration | null | undefined): Record<TaxKey, string> {
    const out = emptyTax();
    for (const k of TAX_KEYS) if (t?.[k]) out[k] = String(t[k]! / 100);
    return out;
}
function taxFromText(t: Record<TaxKey, string>): TaxDeclaration {
    const out: TaxDeclaration = {};
    for (const k of TAX_KEYS) if (t[k]) out[k] = Math.round(Number(t[k]) * 100);
    return out;
}

function initials(name: string) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
}

export default function StaffPayrollPage() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [components, setComponents] = useState<SalaryComponent[]>([]);
    const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('ALL');

    const fetchStaff = useCallback(() => {
        api.get('/admin/payroll/staff')
            .then(res => setStaff(res.data.data ?? []))
            .catch(() => setStaff([]))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        fetchStaff();
        api.get('/admin/payroll/components').then(r => setComponents(r.data.data ?? [])).catch(() => {});
        api.get('/admin/payroll/templates').then(r => setTemplates(r.data.data ?? [])).catch(() => {});
    }, [fetchStaff]);

    // ── Stats + filtering ──
    const active = staff.filter(s => s.status === 'ACTIVE');
    // A salary that starts next month (e.g. set now, applies from 1 Oct) counts as assigned.
    const withSalary = active.filter(s => s.monthlySalary || s.upcomingSalary);
    const monthlyTotal = withSalary.reduce((sum, s) => sum + (s.monthlySalary?.netPay ?? s.upcomingSalary?.netPay ?? 0), 0);
    const missingBank = active.filter(s => s.paymentMode === 'BANK' && !s.bankDetails).length;

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return staff.filter(s => {
            if (filter === 'ACTIVE' && s.status !== 'ACTIVE') return false;
            if (filter === 'INACTIVE' && s.status !== 'INACTIVE') return false;
            if (filter === 'NO_SALARY' && (s.salaryStructure || s.upcomingSalary || s.status !== 'ACTIVE')) return false;
            if (!q) return true;
            return [s.name, s.email, s.designation ?? s.profileDesignation, s.employeeCode].some(v => v?.toLowerCase().includes(q));
        });
    }, [staff, search, filter]);

    // ── Details (add / edit) ──
    const [details, setDetails] = useState<DetailsDraft | null>(null);
    const [savingDetails, setSavingDetails] = useState(false);
    const [linkSearch, setLinkSearch] = useState('');
    const [linkResults, setLinkResults] = useState<LinkableProfile[]>([]);

    useEffect(() => {
        if (!details || details.mode !== 'link' || details.id || linkSearch.trim().length < 2) { setLinkResults([]); return; }
        const t = setTimeout(() => {
            api.get(`/admin/payroll/staff/search-profiles?q=${encodeURIComponent(linkSearch.trim())}`)
                .then(res => setLinkResults(res.data.data ?? []))
                .catch(() => setLinkResults([]));
        }, 300);
        return () => clearTimeout(t);
    }, [details, linkSearch]);

    const openEditDetails = (s: StaffMember) => setDetails({
        id: s.id, mode: s.userId ? 'link' : 'new', linked: null,
        name: s.name, email: s.email ?? '', phone: s.phone ?? '', designation: s.designation ?? s.profileDesignation ?? '', staffType: s.staffType,
        employeeCode: s.employeeCode ?? '', machineId: s.machineId ?? '', joinedAt: toDateInput(s.joinedAt), exitDate: toDateInput(s.exitDate),
        pan: s.pan ?? '', uan: s.uan ?? '', paymentMode: s.paymentMode, bank: s.bankDetails ?? { ...emptyBank }, pfApplicable: s.pfApplicable !== false, epsApplicable: s.epsApplicable !== false, esiApplicable: s.esiApplicable !== false, ptApplicable: s.ptApplicable !== false, esiNumber: s.esiNumber ?? '',
        tdsApplicable: s.tdsApplicable !== false, taxRegime: s.taxRegime === 'OLD' ? 'OLD' : 'NEW', tax: taxToText(s.taxDeclaration),
    });

    const saveDetails = async () => {
        if (!details) return;
        const d = details;
        const isNewLink = !d.id && d.mode === 'link';
        if (isNewLink && !d.linked) { toast.error('Pick the profile to link'); return; }
        if (!isNewLink && !d.name.trim()) { toast.error('Name is required'); return; }
        setSavingDetails(true);
        const common = {
            phone: d.phone, designation: d.designation, employeeCode: d.employeeCode, machineId: d.machineId.trim(),
            joinedAt: d.joinedAt || null, pan: d.pan.trim().toUpperCase(), uan: d.uan, paymentMode: d.paymentMode, pfApplicable: d.pfApplicable, epsApplicable: d.epsApplicable, esiApplicable: d.esiApplicable, ptApplicable: d.ptApplicable, esiNumber: d.esiNumber,
            tdsApplicable: d.tdsApplicable, taxRegime: d.taxRegime, taxDeclaration: taxFromText(d.tax),
            bankDetails: d.paymentMode === 'BANK' ? { ...d.bank, ifsc: d.bank.ifsc.trim().toUpperCase() } : undefined,
        };
        try {
            if (d.id) {
                await api.patch(`/admin/payroll/staff/${d.id}`, {
                    ...common, name: d.name, email: d.email, staffType: d.staffType, exitDate: d.exitDate || null,
                });
                toast.success('Staff details saved');
            } else if (isNewLink && d.linked) {
                await api.post('/admin/payroll/staff', {
                    ...common, name: d.linked.name, email: d.linked.email, staffType: d.linked.role, userId: d.linked.userId,
                });
                toast.success(`${d.linked.name} added to payroll`);
            } else {
                await api.post('/admin/payroll/staff', { ...common, name: d.name, email: d.email, staffType: d.staffType });
                toast.success(`${d.name} added to payroll`);
            }
            setDetails(null);
            setLinkSearch('');
            fetchStaff();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to save staff member'));
        } finally {
            setSavingDetails(false);
        }
    };

    // Marking inactive asks first; making someone active again is one click.
    const [toDeactivate, setToDeactivate] = useState<StaffMember | null>(null);
    const [deactivating, setDeactivating] = useState(false);

    const toggleStatus = async (s: StaffMember) => {
        try {
            await api.patch(`/admin/payroll/staff/${s.id}`, { status: s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
            toast.success(s.status === 'ACTIVE' ? `${s.name} marked inactive` : `${s.name} is active again`);
            fetchStaff();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to update status'));
        }
    };

    // ── Drag to reorder ──
    // Only when the full list is showing (no search / filter), otherwise the
    // hidden rows would make the new order ambiguous.
    const canReorder = filter === 'ALL' && !search.trim();
    const staffRef = useRef(staff);
    staffRef.current = staff;
    const orderBeforeDrag = useRef<string | null>(null);
    const handleReorder = (next: StaffMember[]) => {
        if (!canReorder) return;
        if (orderBeforeDrag.current === null) orderBeforeDrag.current = staffRef.current.map(x => x.id).join(',');
        setStaff(next);
    };
    const saveOrder = async () => {
        const before = orderBeforeDrag.current;
        orderBeforeDrag.current = null;
        const ids = staffRef.current.map(x => x.id);
        if (before === null || before === ids.join(',')) return; // nothing moved
        try {
            await api.put('/admin/payroll/staff/reorder', { ids });
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Could not save the new order'));
            fetchStaff();
        }
    };

    // ── Import all teachers / admins / sub-admins ──
    const [importOpen, setImportOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const runImport = async () => {
        setImporting(true);
        try {
            const res = await api.post('/admin/payroll/staff/import-profiles');
            const count: number = res.data.data?.count ?? 0;
            toast.success(count ? `${count} ${count === 1 ? 'person' : 'people'} added to payroll. Now set their salaries.` : 'Everyone is already on payroll');
            setImportOpen(false);
            fetchStaff();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to import'));
        } finally {
            setImporting(false);
        }
    };

    const [photoView, setPhotoView] = useState<{ url: string; name: string } | null>(null);

    const [toDelete, setToDelete] = useState<StaffMember | null>(null);
    const [deleting, setDeleting] = useState(false);
    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/payroll/staff/${toDelete.id}`);
            toast.success('Removed from payroll');
            setToDelete(null);
            fetchStaff();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to remove'));
        } finally {
            setDeleting(false);
        }
    };

    // ── Salary (versioned) ──
    const [salaryFor, setSalaryFor] = useState<StaffMember | null>(null);
    const [history, setHistory] = useState<SalaryVersion[]>([]);
    const [salaryDraft, setSalaryDraft] = useState<{ templateId: string | null; items: StructureItem[]; effectiveFrom: string; note: string }>({ templateId: null, items: [], effectiveFrom: todayInput(), note: '' });
    const [editorKey, setEditorKey] = useState(0);
    const [savingSalary, setSavingSalary] = useState(false);

    const openSalary = (s: StaffMember) => {
        setSalaryFor(s);
        setHistory([]);
        const basic = components.find(c => c.isBasic);
        setSalaryDraft({
            templateId: s.salaryStructure?.templateId ?? null,
            items: s.salaryStructure?.items ?? (basic ? [{ componentId: basic.id, value: basic.defaultValue }] : []),
            // Existing salary: show the current version's own date, so saving without
            // touching the date just edits that version. Picking a new date creates
            // a new version (increment). No salary yet: joining date, else 1st of this month.
            effectiveFrom: s.salaryStructure ? toDateInput(s.salaryStructure.effectiveFrom) : toDateInput(s.joinedAt) || firstOfThisMonth(),
            note: s.salaryStructure?.note ?? '',
        });
        setEditorKey(k => k + 1);
        api.get(`/admin/payroll/staff/${s.id}/structure`).then(r => {
            const list: SalaryVersion[] = r.data.data?.history ?? [];
            setHistory(list);
            // No salary this month but one starts later: open that one, so saving
            // edits it instead of adding a new version from this month.
            if (!s.salaryStructure && list.length) {
                const first = [...list].sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime())[0];
                setSalaryDraft({ templateId: first.templateId, items: first.items.map(i => ({ ...i })), effectiveFrom: toDateInput(first.effectiveFrom), note: first.note ?? '' });
                setEditorKey(k => k + 1);
            }
        }).catch(() => {});
    };

    // Load a history version (current / upcoming) into the editor above.
    // Its date is kept, so saving updates that same version instead of adding one.
    const salaryScrollRef = useRef<HTMLDivElement>(null);
    const editVersion = (v: SalaryVersion) => {
        setSalaryDraft({ templateId: v.templateId, items: v.items.map(i => ({ ...i })), effectiveFrom: toDateInput(v.effectiveFrom), note: v.note ?? '' });
        setEditorKey(k => k + 1);
        salaryScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        toast.message(`Editing the salary from ${formatDate(v.effectiveFrom)}`);
    };

    const applyTemplate = (id: string) => {
        const tpl = templates.find(t => t.id === id);
        if (!tpl) return;
        setSalaryDraft(d => ({ ...d, templateId: id, items: tpl.items.map(i => ({ ...i })) }));
        setEditorKey(k => k + 1);
    };

    const saveSalary = async () => {
        if (!salaryFor) return;
        if (salaryDraft.items.length === 0) { toast.error('Add at least one salary component'); return; }
        setSavingSalary(true);
        try {
            await api.put(`/admin/payroll/staff/${salaryFor.id}/structure`, {
                templateId: salaryDraft.templateId, items: salaryDraft.items,
                effectiveFrom: salaryDraft.effectiveFrom, note: salaryDraft.note || undefined,
            });
            toast.success(`Salary saved for ${salaryFor.name}`);
            setSalaryFor(null);
            fetchStaff();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to save salary'));
        } finally {
            setSavingSalary(false);
        }
    };

    const [versionToDelete, setVersionToDelete] = useState<SalaryVersion | null>(null);
    const [openVersion, setOpenVersion] = useState<string | null>(null);
    const [deletingVersion, setDeletingVersion] = useState(false);

    const deleteVersion = async (v: SalaryVersion) => {
        if (!salaryFor) return;
        try {
            await api.delete(`/admin/payroll/staff/${salaryFor.id}/structure/${v.id}`);
            setHistory(h => h.filter(x => x.id !== v.id));
            toast.success('Salary version removed');
            fetchStaff();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to remove version'));
        }
    };

    const FILTERS: { value: Filter; label: string }[] = [
        { value: 'ALL', label: 'All' },
        { value: 'ACTIVE', label: 'Active' },
        { value: 'NO_SALARY', label: 'No salary yet' },
        { value: 'INACTIVE', label: 'Inactive' },
    ];

    return (
        // Fills the payroll content area: header, stats and search stay put and
        // only the staff list scrolls. The payroll layout has pb-6 (1.5rem), so
        // the page is 1.5rem taller than 100% and pulls it back with -mb-6:
        // the page itself never scrolls. +0.75rem (not +1.5rem) leaves a 12px gap
        // under the list, same as the page's left gap (main px-2 + layout px-1).
        <div className="flex flex-col gap-3 h-[calc(100%+0.75rem)] -mb-6">
            <PageHeader title="Staff" subtitle="Everyone on payroll: teachers, office staff and support staff">
                <SecondaryButton onClick={() => setImportOpen(true)}><Download size={14} /> Import all</SecondaryButton>
                <PrimaryButton onClick={() => { setDetails(blankDetails()); setLinkSearch(''); }}><Plus size={14} /> Add Staff</PrimaryButton>
            </PageHeader>

            {!loading && staff.length > 0 && (
                // Left: search + filter pills. Right: the 4 stat cards.
                <div className="shrink-0 flex flex-col lg:flex-row lg:items-stretch gap-3">
                    <div className="lg:basis-2/5 min-w-0 flex flex-col items-start gap-2">
                        <div className="relative w-full">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, code…"
                                className="w-full h-9 pl-9 pr-3 rounded-full border border-border bg-muted/40 text-sm focus:outline-none focus:border-foreground/30 focus:bg-background" />
                        </div>
                        {/* Separate pills, same as the status filters on Support → Tickets */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {FILTERS.map(f => (
                                <button key={f.value} type="button" onClick={() => setFilter(f.value)}
                                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${filter === f.value ? 'text-white border-transparent' : 'border-border/50 text-muted-foreground hover:text-foreground'}`}
                                    style={filter === f.value ? { background: TERRACOTTA } : undefined}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="lg:basis-3/5 min-w-0 grid gap-3 grid-cols-2 xl:grid-cols-4">
                        <StatCard label="Active staff" value={String(active.length)} sub={`${staff.length - active.length} inactive`} />
                        <StatCard label="Salary assigned" value={`${withSalary.length} / ${active.length}`} sub={active.length - withSalary.length ? `${active.length - withSalary.length} still need a salary` : 'Everyone is set up'} />
                        <StatCard label="Monthly take-home" value={formatINR(monthlyTotal)} sub="Full month, before LOP" />
                        <StatCard label="Bank details missing" value={String(missingBank)} sub={missingBank ? 'Needed for bank transfer' : 'All good'} />
                    </div>
                </div>
            )}

            {loading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />)}</div>
            ) : staff.length === 0 ? (
                <EmptyState icon={Users} title="No one on payroll yet" text="Add your teachers (link their QubeEx profile) and support staff like peons, drivers and guards.">
                    <PrimaryButton onClick={() => setDetails(blankDetails())}><Plus size={14} /> Add first staff member</PrimaryButton>
                </EmptyState>
            ) : visible.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No staff match this search.</div>
            ) : (
                <motion.div layoutScroll className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-border/60 bg-card"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                    <Reorder.Group axis="y" as="div" values={visible} onReorder={handleReorder} className="divide-y divide-border/40">
                    {visible.map(s => (
                        <DragRow key={s.id} item={s} canDrag={canReorder} onDrop={saveOrder}
                            className={`flex flex-wrap items-center gap-3 pl-2 pr-4 py-3 bg-card hover:bg-muted/20 transition-colors ${s.status === 'INACTIVE' ? 'opacity-60' : ''}`}>
                            {s.avatarUrl ? (
                                <button type="button" title="View photo" onClick={() => setPhotoView({ url: s.avatarUrl!, name: s.name })}
                                    className="relative w-12 h-12 rounded-xl bg-muted ring-2 ring-border shrink-0 overflow-hidden flex items-center justify-center cursor-pointer">
                                    {/* Exactly the same avatar markup as Admin → Staff → Teachers (which renders sharp). */}
                                    <NextImage src={s.avatarUrl} alt={s.name} fill sizes="96px" quality={90} className="object-cover" />
                                </button>
                            ) : (
                                <div className="relative w-12 h-12 rounded-xl bg-muted ring-2 ring-border shrink-0 overflow-hidden flex items-center justify-center">
                                    <span className="text-base font-bold select-none text-primary">{initials(s.name)}</span>
                                </div>
                            )}
                            <div className="flex-1 min-w-[200px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-semibold">{s.name}</p>
                                    <Pill>{STAFF_TYPE_LABEL[s.staffType]}</Pill>
                                    {!s.userId && <Pill tone="amber">Payroll-only</Pill>}
                                    {!s.email && <Pill>No email</Pill>}
                                    {s.paymentMode !== 'BANK' && <Pill>{PAYMENT_MODE_LABEL[s.paymentMode]}</Pill>}
                                    {s.paymentMode === 'BANK' && !s.bankDetails && s.status === 'ACTIVE' && <Pill tone="red"><AlertTriangle size={9} /> No bank details</Pill>}
                                    {s.status === 'INACTIVE' && <Pill tone="red">Inactive</Pill>}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {[s.designation || s.profileDesignation, s.employeeCode && `#${s.employeeCode}`, s.joinedAt && `Joined ${formatDate(s.joinedAt)}`].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                            <div className="text-right min-w-[110px]">
                                {s.monthlySalary ? (
                                    <>
                                        <p className="text-sm font-bold">{formatINR(s.monthlySalary.netPay)}</p>
                                        <p className="text-[10px] text-muted-foreground">take-home / month</p>
                                    </>
                                ) : s.upcomingSalary ? (
                                    <>
                                        <p className="text-sm font-bold">{formatINR(s.upcomingSalary.netPay)}</p>
                                        <p className="text-[10px] text-muted-foreground">starts {formatDate(s.upcomingSalary.startsFrom)}</p>
                                    </>
                                ) : (
                                    <Pill tone="amber">No salary yet</Pill>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <SmallButton onClick={() => openSalary(s)} className={''}>
                                    <IndianRupee size={11} /> {s.salaryStructure || s.upcomingSalary ? 'Salary' : 'Set salary'}
                                </SmallButton>
                                <button title="Edit details" onClick={() => openEditDetails(s)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"><Pencil size={13} /></button>
                                <button title={s.status === 'ACTIVE' ? 'Mark inactive' : 'Mark active'} onClick={() => s.status === 'ACTIVE' ? setToDeactivate(s) : toggleStatus(s)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50">
                                    {s.status === 'ACTIVE' ? <PowerOff size={13} /> : <Power size={13} />}
                                </button>
                                <button title="Remove" onClick={() => setToDelete(s)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                            </div>
                        </DragRow>
                    ))}
                    </Reorder.Group>
                </motion.div>
            )}

            {/* ── Details dialog ── */}
            <Dialog open={!!details} onOpenChange={o => !o && setDetails(null)}>
                <DialogContent className="sm:max-w-xl bg-card max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden" onOpenAutoFocus={e => e.preventDefault()}>
                    {/* Header and footer stay put; only the form in between scrolls. */}
                    <DialogHeader className="shrink-0 px-5 pt-5 pb-4 border-b border-border/50">
                        <DialogTitle>{details?.id ? 'Staff details' : 'Add staff'}</DialogTitle>
                    </DialogHeader>
                    {details && (
                        <>
                        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
                            {!details.id && (
                                <Segmented<'new' | 'link'>
                                    value={details.mode}
                                    options={[{ value: 'link', label: 'Has a QubeEx login' }, { value: 'new', label: 'Payroll-only (peon, driver…)' }]}
                                    onChange={mode => setDetails({ ...details, mode, linked: null })}
                                />
                            )}

                            {!details.id && details.mode === 'link' ? (
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input className={`${inputCls} pl-8`} placeholder="Search teacher / admin by name or email…"
                                            value={linkSearch} onChange={e => { setLinkSearch(e.target.value); setDetails({ ...details, linked: null }); }} autoFocus />
                                    </div>
                                    {details.linked ? (
                                        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                                            <Link2 size={14} className="text-primary" />
                                            <div className="text-xs"><p className="font-semibold">{details.linked.name}</p><p className="text-muted-foreground">{details.linked.email} · {STAFF_TYPE_LABEL[details.linked.role]}</p></div>
                                        </div>
                                    ) : linkResults.length > 0 && (
                                        <div className="border border-border/60 rounded-xl divide-y divide-border/40 max-h-44 overflow-y-auto">
                                            {linkResults.map(p => (
                                                <button key={p.userId} onClick={() => setDetails({ ...details, linked: p })} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/40">
                                                    <p className="font-semibold">{p.name}</p>
                                                    <p className="text-muted-foreground">{p.email} · {STAFF_TYPE_LABEL[p.role]}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Full name"><input className={inputCls} value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })} /></Field>
                                    <Field label="Email (optional)" hint="Payslip PDF is emailed here. No email? Share it from the payroll run instead."><input type="email" className={inputCls} value={details.email} onChange={e => setDetails({ ...details, email: e.target.value })} /></Field>
                                    <Field label="Phone (optional)" hint="Needed to send the payslip on WhatsApp."><PhoneInput value={details.phone} onChange={phone => setDetails({ ...details, phone })} /></Field>
                                    <Field label="Designation"><input className={inputCls} placeholder="e.g. Peon, Driver" value={details.designation} onChange={e => setDetails({ ...details, designation: e.target.value })} /></Field>
                                    {!details.id && (
                                        <Field label="Type">
                                            <ThemedSelect<StaffType>
                                                value={details.staffType}
                                                options={[{ value: 'HELPER', label: 'Helper / support staff' }, { value: 'OTHER', label: 'Other' }]}
                                                onChange={staffType => setDetails({ ...details, staffType })}
                                            />
                                        </Field>
                                    )}
                                </div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Employee code (optional)"><input className={inputCls} placeholder="e.g. EMP-012" value={details.employeeCode} onChange={e => setDetails({ ...details, employeeCode: e.target.value })} /></Field>
                                <Field label="Joining date (only for new joiners)" hint="Fill this only for someone who joined in a month you haven't paid yet (like this month) - their first salary is counted from this day. Leave it blank for staff already working here: they get full salary."><input type="date" className={inputCls} value={details.joinedAt} onChange={e => setDetails({ ...details, joinedAt: e.target.value })} /></Field>
                                {details.id && (
                                    <Field label="Last working day" hint="Only if they have left. Their last salary is worked out till this day.">
                                        <input type="date" className={inputCls} value={details.exitDate} onChange={e => setDetails({ ...details, exitDate: e.target.value })} />
                                    </Field>
                                )}
                                <Field label="PAN (optional)"><input className={`${inputCls} uppercase`} maxLength={10} value={details.pan} onChange={e => setDetails({ ...details, pan: e.target.value })} /></Field>
                                <Field label="UAN / PF no. (optional)"><input className={inputCls} maxLength={12} value={details.uan} onChange={e => setDetails({ ...details, uan: e.target.value })} /></Field>
                                <Field label="Attendance machine ID (optional)" hint="This person's number on the fingerprint / RFID machine">
                                    <input className={inputCls} maxLength={40} value={details.machineId} onChange={e => setDetails({ ...details, machineId: e.target.value })} />
                                </Field>
                            </div>

                            {/* Statutory deductions for this person (only matter when switched on in Payroll Settings) */}
                            <div className="rounded-xl border border-border/60 p-3 space-y-3">
                                <p className="text-xs font-semibold text-muted-foreground">PF, ESI and Professional Tax</p>
                                <Toggle checked={details.pfApplicable} onChange={pfApplicable => setDetails({ ...details, pfApplicable })}
                                    label="PF is deducted for this person" hint="Turn off for someone who is not a PF member." />
                                {details.pfApplicable && (
                                    <Toggle checked={details.epsApplicable} onChange={epsApplicable => setDetails({ ...details, epsApplicable })}
                                        label="Pension (EPS) applies" hint="Turn off for staff aged 58 or above (or anyone not in EPS). The school's full 12% then goes to their PF." />
                                )}
                                <Toggle checked={details.esiApplicable} onChange={esiApplicable => setDetails({ ...details, esiApplicable })}
                                    label="ESI applies" hint="Only deducted while their monthly gross is within the ESI limit." />
                                {details.esiApplicable && (
                                    <Field label="ESI number (optional)"><input className={inputCls} maxLength={20} value={details.esiNumber} onChange={e => setDetails({ ...details, esiNumber: e.target.value.replace(/[^\dA-Za-z]/g, '') })} /></Field>
                                )}
                                <Toggle checked={details.ptApplicable} onChange={ptApplicable => setDetails({ ...details, ptApplicable })}
                                    label="Professional Tax applies" hint="Turn off for exempt staff (e.g. in Maharashtra, women earning up to ₹25,000 a month)." />
                                <Toggle checked={details.tdsApplicable} onChange={tdsApplicable => setDetails({ ...details, tdsApplicable })}
                                    label="Income tax (TDS) is deducted" hint="Only matters when TDS is switched on in Payroll Settings." />
                                {details.tdsApplicable && (
                                    <div className="space-y-3 pl-1">
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] font-semibold text-muted-foreground">Tax regime</p>
                                            <Segmented<'NEW' | 'OLD'> value={details.taxRegime} onChange={taxRegime => setDetails({ ...details, taxRegime })}
                                                options={[{ value: 'NEW', label: 'New regime (default)' }, { value: 'OLD', label: 'Old regime' }]} />
                                        </div>
                                        {details.taxRegime === 'OLD' && (
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {([
                                                    ['sec80C', '80C investments (₹ / year)', 'PPF, LIC, ELSS, tuition fees… Employee PF is added automatically. Max ₹1.5L in total.'],
                                                    ['sec80D', '80D health insurance (₹ / year)', ''],
                                                    ['hraExempt', 'HRA exemption (₹ / year)', 'Worked out from rent receipts.'],
                                                    ['otherDeductions', 'Other deductions (₹ / year)', '80E, 80G, home-loan interest…'],
                                                ] as [TaxKey, string, string][]).map(([k, label, hint]) => (
                                                    <Field key={k} label={label} hint={hint || undefined}>
                                                        <input className={inputCls} inputMode="decimal" value={details.tax[k]}
                                                            onChange={e => setDetails({ ...details, tax: { ...details.tax, [k]: e.target.value.replace(/[^\d.]/g, '').slice(0, 12) } })} />
                                                    </Field>
                                                ))}
                                            </div>
                                        )}
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <Field label="Salary from a previous job this year (₹)" hint="If they joined from another job this financial year.">
                                                <input className={inputCls} inputMode="decimal" value={details.tax.prevEmployerIncome}
                                                    onChange={e => setDetails({ ...details, tax: { ...details.tax, prevEmployerIncome: e.target.value.replace(/[^\d.]/g, '').slice(0, 12) } })} />
                                            </Field>
                                            <Field label="TDS already cut there (₹)">
                                                <input className={inputCls} inputMode="decimal" value={details.tax.prevEmployerTds}
                                                    onChange={e => setDetails({ ...details, tax: { ...details.tax, prevEmployerTds: e.target.value.replace(/[^\d.]/g, '').slice(0, 12) } })} />
                                            </Field>
                                            <Field label="TDS we cut this year before QubeEx (₹)" hint="Months of this financial year paid outside QubeEx: their salary is assumed automatically, only enter the TDS cut in them.">
                                                <input className={inputCls} inputMode="decimal" value={details.tax.tdsBeforeQubeex}
                                                    onChange={e => setDetails({ ...details, tax: { ...details.tax, tdsBeforeQubeex: e.target.value.replace(/[^\d.]/g, '').slice(0, 12) } })} />
                                            </Field>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground">Salary is paid by</p>
                                <Segmented<PaymentMode>
                                    value={details.paymentMode}
                                    options={[{ value: 'BANK', label: 'Bank transfer' }, { value: 'CASH', label: 'Cash' }, { value: 'CHEQUE', label: 'Cheque' }]}
                                    onChange={paymentMode => setDetails({ ...details, paymentMode })}
                                />
                                {details.paymentMode === 'BANK' && (
                                    <div className="rounded-xl border border-border/60 p-3 space-y-2">
                                        <p className="flex items-center gap-1.5 text-xs font-semibold"><Landmark size={13} className="text-primary" /> Bank account <span className="font-normal text-muted-foreground">(stored encrypted)</span></p>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <input className={inputCls} placeholder="Account holder name" value={details.bank.accountName} onChange={e => setDetails({ ...details, bank: { ...details.bank, accountName: e.target.value } })} />
                                            <input className={inputCls} placeholder="Account number" value={details.bank.accountNumber} onChange={e => setDetails({ ...details, bank: { ...details.bank, accountNumber: e.target.value } })} />
                                            <input className={`${inputCls} uppercase`} placeholder="IFSC" maxLength={11} value={details.bank.ifsc} onChange={e => setDetails({ ...details, bank: { ...details.bank, ifsc: e.target.value } })} />
                                            <input className={inputCls} placeholder="Bank name" value={details.bank.bankName} onChange={e => setDetails({ ...details, bank: { ...details.bank, bankName: e.target.value } })} />
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                        <div className="shrink-0 flex gap-2 px-5 py-4 border-t border-border/50 bg-muted/20">
                            <SecondaryButton className="flex-1" onClick={() => setDetails(null)}>Cancel</SecondaryButton>
                            <PrimaryButton className="flex-1" onClick={saveDetails} disabled={savingDetails}>{savingDetails ? 'Saving…' : details.id ? 'Save details' : 'Add to payroll'}</PrimaryButton>
                        </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Salary dialog ── */}
            <Dialog open={!!salaryFor} onOpenChange={o => !o && setSalaryFor(null)}>
                <DialogContent className="sm:max-w-2xl bg-card max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden" onOpenAutoFocus={e => e.preventDefault()}>
                    {/* Header stays put; everything below it scrolls. */}
                    <DialogHeader className="shrink-0 px-5 pt-5 pb-4 border-b border-border/50">
                        <DialogTitle className="flex items-center gap-2 flex-wrap">
                            <Wallet size={16} className="text-primary" /> Salary · {salaryFor?.name}
                            {salaryFor && (() => {
                                // Which salary the editor below is working on (follows the "Applies from" date).
                                const editing = history.find(v => toDateInput(v.effectiveFrom) === salaryDraft.effectiveFrom);
                                if (!salaryFor.salaryStructure && !editing) return <Pill tone="amber">First salary</Pill>;
                                if (!editing) return <Pill tone="amber">New salary{salaryDraft.effectiveFrom ? ` from ${formatDate(salaryDraft.effectiveFrom)}` : ''}</Pill>;
                                const label = salaryFor.salaryStructure?.id === editing.id ? 'Current' : new Date(editing.effectiveFrom) > new Date() ? 'Upcoming' : 'Past';
                                return <Pill tone={label === 'Current' ? 'green' : label === 'Upcoming' ? 'primary' : 'muted'}>Editing {label.toLowerCase()} · from {formatDate(editing.effectiveFrom)}</Pill>;
                            })()}
                        </DialogTitle>
                    </DialogHeader>
                    {salaryFor && (
                        <div ref={salaryScrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Applies from" hint={!salaryFor.salaryStructure ? undefined
                                    : history.some(v => toDateInput(v.effectiveFrom) === salaryDraft.effectiveFrom)
                                        ? `Saving updates the salary from ${formatDate(salaryDraft.effectiveFrom)}. For an increment, pick the date it starts from.`
                                        : `Saving adds a new salary from ${salaryDraft.effectiveFrom ? formatDate(salaryDraft.effectiveFrom) : 'this date'}. The old one stays in history.`}>
                                    <input type="date" className={inputCls} value={salaryDraft.effectiveFrom} onChange={e => setSalaryDraft(d => ({ ...d, effectiveFrom: e.target.value }))} />
                                </Field>
                                {templates.length > 0 && (
                                    <Field label="Start from a template (optional)">
                                        <ThemedSelect
                                            value={salaryDraft.templateId ?? ''}
                                            placeholder="Choose a template…"
                                            options={templates.map(t => ({ value: t.id, label: t.name }))}
                                            onChange={applyTemplate}
                                        />
                                    </Field>
                                )}
                            </div>

                            <SalaryItemsEditor key={editorKey} items={salaryDraft.items} components={components}
                                onChange={items => setSalaryDraft(d => ({ ...d, items }))} />

                            <Field label="Note (optional)" hint="Why this salary? e.g. Joining salary, Annual increment 2026, Promotion to HOD, Probation completed, Salary correction, Extra classes allowance">
                                <input className={inputCls} placeholder="e.g. Annual increment 2026, Promotion to HOD" value={salaryDraft.note} onChange={e => setSalaryDraft(d => ({ ...d, note: e.target.value }))} />
                            </Field>

                            <div className="flex gap-2">
                                <SecondaryButton className="flex-1" onClick={() => setSalaryFor(null)}>Cancel</SecondaryButton>
                                <PrimaryButton className="flex-1" onClick={saveSalary} disabled={savingSalary}>{savingSalary ? 'Saving…' : 'Save salary'}</PrimaryButton>
                            </div>

                            {history.length > 0 && (
                                <div className="pt-2 border-t border-border/50">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2"><History size={13} /> Salary history</p>
                                    <div className="space-y-1.5">
                                        {history.map((v, idx) => {
                                            const p = previewMonthly(v.items, components);
                                            const isCurrent = salaryFor.salaryStructure?.id === v.id;
                                            const isUpcoming = !isCurrent && new Date(v.effectiveFrom) > new Date();
                                            const open = openVersion === v.id;
                                            // history is newest first, so the version before this one is the next item
                                            const prev = history[idx + 1];
                                            const prevNet = prev ? previewMonthly(prev.items, components).netPay : null;
                                            const change = prevNet !== null ? p.netPay - prevNet : null;
                                            const changePct = prevNet ? (change! / prevNet) * 100 : null;
                                            const templateName = v.templateId ? templates.find(t => t.id === v.templateId)?.name : null;
                                            return (
                                                <div key={v.id} className={`rounded-xl border transition-colors ${toDateInput(v.effectiveFrom) === salaryDraft.effectiveFrom ? 'border-foreground/40 ring-1 ring-foreground/10' : open ? 'border-foreground/20' : 'border-border/50'} ${open ? 'bg-muted/20' : ''}`}>
                                                    <div role="button" tabIndex={0} onClick={() => setOpenVersion(open ? null : v.id)}
                                                        onKeyDown={e => e.key === 'Enter' && setOpenVersion(open ? null : v.id)}
                                                        className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer">
                                                        <div className="flex items-center gap-2 text-xs min-w-0">
                                                            <ChevronDown size={13} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                                                            <div className="min-w-0">
                                                                <p className="font-semibold flex items-center gap-1.5 flex-wrap">
                                                                    From {formatDate(v.effectiveFrom)}
                                                                    {isCurrent && <Pill tone="green">Current</Pill>}
                                                                    {isUpcoming && <Pill tone="primary">Upcoming</Pill>}
                                                                    {!isCurrent && !isUpcoming && <Pill>Past</Pill>}
                                                                </p>
                                                                <p className="text-muted-foreground truncate">{v.note || 'No note'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {change !== null && change !== 0 && (
                                                                <span className={`text-[10px] font-semibold ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                    {change > 0 ? '▲' : '▼'} {changePct !== null ? `${Math.abs(changePct).toFixed(1)}%` : ''}
                                                                </span>
                                                            )}
                                                            <p className="text-xs font-bold">{formatINR(p.netPay)}</p>
                                                            {(isCurrent || isUpcoming) && (
                                                                <button title="Edit this salary" onClick={e => { e.stopPropagation(); editVersion(v); }} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"><Pencil size={12} /></button>
                                                            )}
                                                            <button title="Remove this version" onClick={e => { e.stopPropagation(); setVersionToDelete(v); }} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-500"><Trash2 size={12} /></button>
                                                        </div>
                                                    </div>
                                                    {open && (
                                                        <div className="px-3 pb-3 pt-1 space-y-2 text-xs">
                                                            <div className="grid gap-2 sm:grid-cols-2">
                                                                <div className="rounded-lg border border-border/50 bg-card p-2.5">
                                                                    <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Earnings</p>
                                                                    {p.earnings.map((l, i) => <div key={i} className="flex justify-between py-0.5"><span>{l.label}</span><span className="font-medium">{formatINR(l.amount)}</span></div>)}
                                                                    <div className="flex justify-between pt-1 mt-1 border-t border-border/40 font-semibold"><span>Gross</span><span>{formatINR(p.grossPay)}</span></div>
                                                                </div>
                                                                <div className="rounded-lg border border-border/50 bg-card p-2.5">
                                                                    <p className="font-semibold text-red-700 dark:text-red-400 mb-1">Deductions</p>
                                                                    {p.deductions.length === 0 ? <p className="text-muted-foreground">None</p> : p.deductions.map((l, i) => <div key={i} className="flex justify-between py-0.5"><span>{l.label}</span><span className="font-medium">{formatINR(l.amount)}</span></div>)}
                                                                    <div className="flex justify-between pt-1 mt-1 border-t border-border/40 font-semibold"><span>Take-home</span><span>{formatINR(p.netPay)}</span></div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                                                {templateName && <span>Template: <span className="text-foreground font-medium">{templateName}</span></span>}
                                                                {change !== null && (
                                                                    <span>vs previous: <span className={`font-medium ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : change < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                                                                        {change === 0 ? 'no change' : `${change > 0 ? '+' : '-'}${formatINR(Math.abs(change))}${changePct !== null ? ` (${change > 0 ? '+' : '-'}${Math.abs(changePct).toFixed(1)}%)` : ''}`}
                                                                    </span> take-home</span>
                                                                )}
                                                                <span>Saved on {formatDate(v.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={importOpen} onOpenChange={o => !importing && setImportOpen(o)}>
                <DialogContent className="sm:max-w-sm bg-card">
                    <DialogHeader>
                        <div className="mx-auto w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-2"><Download size={20} /></div>
                        <DialogTitle className="text-center">Import everyone from QubeEx?</DialogTitle>
                        <DialogDescription className="text-center">
                            All active teachers, admins and sub-admins who aren&apos;t on payroll yet will be added as existing staff (full salary, no joining date). If someone joined this month, add their joining date afterwards.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2">
                        <SecondaryButton className="flex-1" onClick={() => setImportOpen(false)} disabled={importing}>Cancel</SecondaryButton>
                        <PrimaryButton className="flex-1" onClick={runImport} disabled={importing}>{importing ? 'Importing…' : 'Import'}</PrimaryButton>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!toDeactivate} onOpenChange={o => !deactivating && !o && setToDeactivate(null)}>
                <DialogContent className="sm:max-w-sm bg-card">
                    <DialogHeader>
                        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center mb-2">
                            <PowerOff size={20} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <DialogTitle className="text-center">Mark {toDeactivate?.name} inactive?</DialogTitle>
                        <DialogDescription className="text-center">
                            They won&apos;t be included in new payroll runs. Their details, salary history and old payslips stay safe, and you can make them active again anytime.
                            {' '}If they are leaving this month, set their last working day and pay this month&apos;s salary first.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2">
                        <SecondaryButton className="flex-1" onClick={() => setToDeactivate(null)} disabled={deactivating}>Cancel</SecondaryButton>
                        <button type="button" disabled={deactivating}
                            onClick={async () => { if (!toDeactivate) return; setDeactivating(true); await toggleStatus(toDeactivate); setDeactivating(false); setToDeactivate(null); }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-60">
                            {deactivating ? 'Saving…' : 'Mark inactive'}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <DeleteConfirmDialog
                open={!!versionToDelete}
                onOpenChange={o => !o && !deletingVersion && setVersionToDelete(null)}
                label="salary"
                name={versionToDelete ? `from ${formatDate(versionToDelete.effectiveFrom)}` : ''}
                loading={deletingVersion}
                onConfirm={async () => {
                    if (!versionToDelete) return;
                    setDeletingVersion(true);
                    await deleteVersion(versionToDelete);
                    setDeletingVersion(false);
                    setVersionToDelete(null);
                }}
                description={versionToDelete && salaryFor?.salaryStructure?.id === versionToDelete.id
                    ? 'This is their current salary. After deleting, the previous version (if any) applies again, otherwise they will have no salary.'
                    : 'This salary version will be removed from their history. Payslips already made are not affected.'}
            />

            {/* Photo enlarged, same as on the profile pages */}
            <AnimatePresence>
                {photoView && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => setPhotoView(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photoView.url} alt={photoView.name} className="w-full h-full object-cover" />
                            <button onClick={() => setPhotoView(null)}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                                <X size={14} className="text-white" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <DeleteConfirmDialog
                open={!!toDelete}
                onOpenChange={o => !o && setToDelete(null)}
                label="from payroll"
                name={toDelete?.name ?? ''}
                confirmLabel="Remove"
                loading={deleting}
                onConfirm={confirmDelete}
                description="Only possible if they have no payslips yet. If they have left, mark them inactive instead."
            />
        </div>
    );
}

// One row in the staff list with a grip handle on the left to drag it up/down.
// Dragging starts only from the handle, so clicks on the row's buttons still work.
function DragRow({ item, canDrag, onDrop, className, children }: {
    item: StaffMember; canDrag: boolean; onDrop: () => void; className: string; children: React.ReactNode;
}) {
    const controls = useDragControls();
    return (
        <Reorder.Item value={item} as="div" dragListener={false} dragControls={controls} onDragEnd={onDrop}
            className={`relative ${className}`}
            whileDrag={{ zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            <button type="button" aria-label="Drag to reorder"
                title={canDrag ? 'Drag to reorder' : 'Clear search and filters to reorder'}
                onPointerDown={e => { if (canDrag) { e.preventDefault(); controls.start(e); } }}
                className={`w-5 h-8 shrink-0 flex items-center justify-center rounded-md text-muted-foreground/60 ${canDrag ? 'cursor-grab active:cursor-grabbing hover:text-foreground hover:bg-muted/50' : 'opacity-30 cursor-not-allowed'}`}
                style={{ touchAction: 'none' }}>
                <GripVertical size={14} />
            </button>
            {children}
        </Reorder.Item>
    );
}
