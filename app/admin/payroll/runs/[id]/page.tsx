'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, RotateCcw, Trash2, Send, CheckCircle2, ChevronDown, Users, ClipboardList, ShieldCheck, Undo2, AlertTriangle, Info, MessageSquareWarning, Check, Circle, Landmark, Sparkles, XCircle } from 'lucide-react';
// Official brand / file-type icons (react-icons). Install once: pnpm add react-icons
import { FaWhatsapp, FaFilePdf, FaFileExcel } from 'react-icons/fa';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MoneyLine, PaymentMode, StaffType, STAFF_TYPE_LABEL, PAYMENT_MODE_LABEL, formatINR, monthLabel, formatDate, amountInWords, paiseToInput, rupeesToPaise } from '@/lib/payroll';
import { PageHeader, PrimaryButton, SecondaryButton, SmallButton, EmptyState, Pill, TERRACOTTA } from '../../_components/ui';

interface Payslip {
    id: string; staffId: string; staffName: string; staffType: StaffType; staffDesignation: string | null;
    employeeCode: string | null; paymentMode: PaymentMode;
    staffEmail: string | null; staffPhone: string | null;
    avatarUrl: string | null; // linked QubeEx profile photo (signed URL)
    earnings: MoneyLine[]; deductions: MoneyLine[];
    grossPay: number; netPay: number;
    lopDays: number; paidDays: number; basisDays: number;
    status: 'PENDING' | 'PAID'; pdfUrl: string | null;
    paidAt: string | null; paymentMethod: string | null; paymentRef: string | null;
    joinedAt: string | null; exitDate: string | null;
    panMasked: string | null; bank: { bankName: string; last4: string; ifsc: string } | null;
    bonus: number; otherDeduction: number; inputNote: string | null; // LOP / bonus grid inputs (paise)
    prevNetPay: number | null; // take-home in the last published month
    employerContributions: MoneyLine[] | null; pfWages: number; // PF: school's share (not deducted) + PF wages
    tdsInfo: { regime: 'NEW' | 'OLD'; estimatedAnnualIncome: number; deductions: number; taxableIncome: number; annualTax: number; alreadyDeducted: number; monthsLeft: number; noPanRule: boolean } | Record<string, never> | null;
}
type RunStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED';
interface AiReview { verdict: 'LOOKS_GOOD' | 'NEEDS_ATTENTION'; summary: string }
interface RunWarning { type: string; level: 'critical' | 'warning' | 'info'; message: string; staffIds?: string[] }
interface RunDetail {
    id: string; month: string; status: RunStatus;
    totals: { grossPay: number; deductions: number; netPay: number };
    submittedAt: string | null; submittedByName: string | null;
    approvedAt: string | null; approvedByName: string | null;
    publishedAt: string | null; publishedByName: string | null;
    reviewNote: string | null; reviewNoteAt: string | null;
    inputsCheckedAt: string | null; // LOP & bonus gone through this month (needed before approval / publish)
    // Background publish progress
    publishState: 'RUNNING' | 'FAILED' | null; publishTotal: number; publishDone: number; publishError: string | null;
    publishHeartbeatAt: string | null;
    aiReview: AiReview | null; aiReviewAt: string | null; aiReviewStale: boolean;
    warnings: RunWarning[];
    previous: { month: string; staffCount: number; netPay: number } | null;
    payslips: Payslip[];
}

// wa.me link that opens WhatsApp with the payslip link pre-typed. With a
// usable phone number it opens that chat directly (Indian 10-digit numbers
// get the 91 country code); without one, WhatsApp asks who to send it to.
function whatsappLink(phone: string | null, name: string, month: string, pdfUrl: string): { url: string; direct: boolean } {
    const text = encodeURIComponent(`Hi ${name}, your payslip for ${monthLabel(month)} is ready: ${pdfUrl}`);
    let digits = (phone ?? '').replace(/\D/g, '');
    if (digits.length === 10) digits = `91${digits}`;
    return digits.length >= 11
        ? { url: `https://wa.me/${digits}?text=${text}`, direct: true }
        : { url: `https://wa.me/?text=${text}`, direct: false };
}

function initialsOf(name: string) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
}

const fmtDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function PayrollRunDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [run, setRun] = useState<RunDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [confirmPublish, setConfirmPublish] = useState(false);
    const [confirmDeleteRun, setConfirmDeleteRun] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [open, setOpen] = useState<string | null>(null);

    const fetchRun = useCallback(() => {
        api.get(`/admin/payroll/runs/${params.id}`)
            .then(res => {
                const r: RunDetail = res.data.data;
                // No progress for 5 min = the server restarted mid-publish: show it as stopped so Retry appears.
                if (r.publishState === 'RUNNING' && r.publishHeartbeatAt && Date.now() - new Date(r.publishHeartbeatAt).getTime() > 5 * 60 * 1000) {
                    r.publishState = 'FAILED';
                    r.publishError = 'Publishing stopped (the server restarted). Press Retry to continue from where it stopped.';
                }
                setRun(r);
            })
            .catch(() => setRun(null))
            .finally(() => setLoading(false));
    }, [params.id]);
    useEffect(() => { fetchRun(); }, [fetchRun]);

    // While payslips are being published on the server, refresh every 2s for progress.
    const publishState = run?.publishState ?? null;
    const lastPublishState = useRef<string | null>(null);
    useEffect(() => {
        if (lastPublishState.current === 'RUNNING' && publishState !== 'RUNNING' && run) {
            if (run.status === 'PUBLISHED') toast.success('All payslips published');
            else if (publishState === 'FAILED') toast.error('Some payslips could not be sent. See the message on top.');
        }
        lastPublishState.current = publishState;
        if (publishState !== 'RUNNING') return;
        const t = setInterval(fetchRun, 2000);
        return () => clearInterval(t);
    }, [publishState, run, fetchRun]);

    const [photoView, setPhotoView] = useState<{ url: string; name: string } | null>(null);
    const [toRemove, setToRemove] = useState<Payslip | null>(null);
    const [removing, setRemoving] = useState(false);

    const removePayslip = async (payslipId: string) => {
        try {
            await api.delete(`/admin/payroll/runs/${params.id}/payslips/${payslipId}`);
            toast.success('Removed from this month');
            fetchRun();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to remove'));
        }
    };

    const publish = async () => {
        setPublishing(true);
        try {
            await api.post(`/admin/payroll/runs/${params.id}/publish`);
            toast.success('Publishing started. You can keep working, it runs in the background.');
            setConfirmPublish(false);
            fetchRun();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to publish'));
        } finally {
            setPublishing(false);
        }
    };

    const deleteRun = async () => {
        setDeleting(true);
        try {
            await api.delete(`/admin/payroll/runs/${params.id}`);
            toast.success('Draft deleted');
            router.push('/admin/payroll/runs');
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to delete'));
            setDeleting(false);
        }
    };

    // Undo a "Mark paid" done by mistake
    const [toUnpay, setToUnpay] = useState<Payslip | null>(null);
    const [unpaying, setUnpaying] = useState(false);
    const markUnpaid = async () => {
        if (!toUnpay) return;
        setUnpaying(true);
        try {
            await api.patch(`/admin/payroll/payslips/${toUnpay.id}/mark-unpaid`);
            toast.success(`${toUnpay.staffName} set back to unpaid`);
            setToUnpay(null);
            fetchRun();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to update'));
        } finally {
            setUnpaying(false);
        }
    };

    const [confirmAllPaid, setConfirmAllPaid] = useState(false);

    // ── Approval flow ──
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'ADMIN';
    const [acting, setActing] = useState<string | null>(null);
    const runAction = async (action: 'submit' | 'recall' | 'approve', done: string) => {
        setActing(action);
        try {
            await api.post(`/admin/payroll/runs/${params.id}/${action}`);
            toast.success(done);
            fetchRun();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Something went wrong'));
        } finally {
            setActing(null);
        }
    };
    const toggleChecked = async () => {
        if (!run) return;
        setActing('check');
        try {
            await api.post(`/admin/payroll/runs/${params.id}/inputs-checked`, { checked: !run.inputsCheckedAt });
            fetchRun();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to update'));
        } finally {
            setActing(null);
        }
    };
    const [confirmApprove, setConfirmApprove] = useState(false);
    const [sendBackOpen, setSendBackOpen] = useState(false);
    const [sendBackNote, setSendBackNote] = useState('');
    const sendBack = async () => {
        if (!sendBackNote.trim()) { toast.error('Add a note so the accountant knows what to fix'); return; }
        setActing('send-back');
        try {
            await api.post(`/admin/payroll/runs/${params.id}/send-back`, { note: sendBackNote.trim() });
            toast.success('Sent back to draft');
            setSendBackOpen(false);
            setSendBackNote('');
            fetchRun();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to send back'));
        } finally {
            setActing(null);
        }
    };

    // ── LOP / bonus grid ──
    const [gridOpen, setGridOpen] = useState(false);
    const [reviewOpen, setReviewOpen] = useState<boolean | null>(null);

    const markPaid = async (p: Payslip) => {
        try {
            await api.patch(`/admin/payroll/payslips/${p.id}/mark-paid`, { paymentMethod: PAYMENT_MODE_LABEL[p.paymentMode] });
            toast.success(`${p.staffName} marked as paid`);
            fetchRun();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to mark paid'));
        }
    };

    if (loading) return <div className="h-40 rounded-2xl bg-muted/40 animate-pulse" />;
    if (!run) return <div className="py-12 text-center text-sm text-muted-foreground">Payroll run not found.</div>;

    const isDraft = run.status === 'DRAFT';
    const isPending = run.status === 'PENDING_APPROVAL';
    const isApproved = run.status === 'APPROVED';
    const isPublished = run.status === 'PUBLISHED';
    const isPublishing = run.publishState === 'RUNNING';
    const warningCount = run.warnings.filter(w => w.level !== 'info').length;
    const showReview = reviewOpen ?? (isPending && isAdmin);
    const STAGE_SUBTITLE: Record<RunStatus, string> = {
        DRAFT: isAdmin ? 'Draft: enter LOP / bonus, check each salary, then publish' : 'Draft: enter LOP / bonus, check each salary, then send for approval',
        PENDING_APPROVAL: isAdmin ? 'Waiting for your approval' : 'Sent for approval: waiting for the admin',
        APPROVED: 'Approved: ready to publish payslips',
        PUBLISHED: 'Published: payslips are visible to staff',
    };
    const unpaidCount = run.payslips.filter(x => x.status !== 'PAID').length;
    const paid = run.payslips.filter(p => p.status === 'PAID').length;

    return (
        // Header + stat cards stay put, only the payslip list scrolls (same as the Staff page).
        <div className="flex flex-col gap-3 h-[calc(100%+0.75rem)] -mb-6">
            <PageHeader onBack={() => router.push('/admin/payroll/runs')} center={
                // Run totals, shown in the middle of the header. Every cell has the
                // same two lines (label + value) so they all line up.
                <div className="flex items-center divide-x divide-border/60 rounded-xl border border-border/60 bg-card">
                    {[
                        {
                            label: 'Staff',
                            value: (() => {
                                const part = run.payslips.filter(x => x.paidDays < x.basisDays).length;
                                return <>{run.payslips.length}{part > 0 && <> | <span className="text-amber-600 dark:text-amber-400">{part} part</span></>}</>;
                            })(),
                        },
                        { label: 'Gross', value: formatINR(run.totals.grossPay) },
                        { label: 'Deductions', value: formatINR(run.totals.deductions) },
                        { label: 'Take-home', value: formatINR(run.totals.netPay) },
                        ...(!isPublished ? [] : [{ label: 'Paid', value: `${paid} / ${run.payslips.length}` }]),
                    ].map(st => (
                        <div key={st.label} className="px-3.5 py-1.5 leading-tight text-center">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{st.label}</p>
                            <p className="text-sm font-bold tabular-nums">{st.value}</p>
                        </div>
                    ))}
                </div>
            } title={`${monthLabel(run.month)} Payroll`} subtitle={STAGE_SUBTITLE[run.status]}>
                {isDraft && !isPublishing && (
                    <>
                        <SecondaryButton onClick={() => setConfirmDeleteRun(true)}><Trash2 size={14} /> Delete draft</SecondaryButton>
                        {/* LOP & bonus button with a tick circle joined to it. Until it is ticked,
                            Send for approval / Publish stay dimmed, so nobody sends the payroll
                            without looking at this month's leave and bonus. */}
                        <div className={`inline-flex items-center h-8 rounded-xl border bg-card overflow-hidden ${gridOpen || run.payslips.length === 0 ? 'opacity-60' : ''} border-border`}>
                            <button type="button" onClick={() => { setGridOpen(true); setOpen(null); }} disabled={run.payslips.length === 0 || gridOpen}
                                className="inline-flex items-center gap-1.5 h-full pl-3.5 pr-3 text-xs font-semibold hover:bg-muted/50 transition-colors disabled:pointer-events-none">
                                <ClipboardList size={14} /> LOP &amp; bonus
                            </button>
                            <button type="button" onClick={toggleChecked} disabled={run.payslips.length === 0 || acting === 'check'}
                                title={run.inputsCheckedAt ? `Checked on ${formatDate(run.inputsCheckedAt)}. Click to untick.` : 'Tick after checking this month\'s LOP & bonus'}
                                className="h-full px-2.5 border-l border-border flex items-center justify-center hover:bg-muted/50 transition-colors disabled:pointer-events-none">
                                {acting === 'check' ? <Loader2 size={15} className="animate-spin text-muted-foreground" />
                                    : run.inputsCheckedAt ? <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                                    : <Circle size={16} className="text-muted-foreground" />}
                            </button>
                        </div>
                        {isAdmin ? (
                            <PrimaryButton onClick={() => setConfirmPublish(true)} disabled={run.payslips.length === 0 || gridOpen || !run.inputsCheckedAt}
                                title={run.inputsCheckedAt ? undefined : 'Tick LOP & bonus first'}><Send size={14} /> Publish payslips</PrimaryButton>
                        ) : (
                            <PrimaryButton onClick={() => runAction('submit', 'Sent to the admin for approval')} disabled={run.payslips.length === 0 || gridOpen || !!acting || !run.inputsCheckedAt}
                                title={run.inputsCheckedAt ? undefined : 'Tick LOP & bonus first'}>
                                {acting === 'submit' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send for approval
                            </PrimaryButton>
                        )}
                    </>
                )}
                {isPending && !isPublishing && (isAdmin ? (
                    <>
                        <SecondaryButton onClick={() => setSendBackOpen(true)} disabled={!!acting}><Undo2 size={14} /> Send back</SecondaryButton>
                        <PrimaryButton onClick={() => setConfirmApprove(true)} disabled={!!acting}>
                            {acting === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Approve
                        </PrimaryButton>
                    </>
                ) : (
                    <>
                        <Pill tone="amber">Waiting for approval</Pill>
                        <SecondaryButton onClick={() => runAction('recall', 'Taken back to draft')} disabled={!!acting}><Undo2 size={14} /> Take back</SecondaryButton>
                    </>
                ))}
                {isApproved && !isPublishing && (
                    <>
                        {isAdmin && <SecondaryButton onClick={() => setSendBackOpen(true)} disabled={!!acting}><Undo2 size={14} /> Send back</SecondaryButton>}
                        <PrimaryButton onClick={() => setConfirmPublish(true)}><Send size={14} /> Publish payslips</PrimaryButton>
                    </>
                )}
                {isPublished && <Pill tone="green">Published</Pill>}
                {isPublishing && <Pill tone="amber"><Loader2 size={10} className="animate-spin" /> Publishing…</Pill>}
            </PageHeader>

            {(isPublishing || run.publishState === 'FAILED') && !isPublished && (
                <PublishProgress run={run} onRetry={publish} retrying={publishing} />
            )}

            {gridOpen ? (
                <InputsGrid run={run} onClose={() => setGridOpen(false)} onSaved={() => { setGridOpen(false); fetchRun(); }} />
            ) : (
                // Stepper + review scroll away with the list; the table headings stick to the top.
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                {/* Steps, with "Pay salaries" on the right once approved */}
                {(() => {
                    const showPay = isApproved || isPublished;
                    return (
                        <div className="flex flex-col xl:flex-row gap-2">
                            {/* Full width on its own; shrinks to fit once "Pay salaries" sits next to it */}
                            <div className={showPay ? 'xl:shrink-0' : 'flex-1 min-w-0'}><RunStepper run={run} /></div>
                            {showPay && <div className="flex-1 min-w-0"><PaymentsBar run={run} /></div>}
                        </div>
                    );
                })()}

                {isDraft && run.reviewNote && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800/60 px-3.5 py-2.5 text-xs">
                        <MessageSquareWarning size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                            <p className="font-semibold text-amber-800 dark:text-amber-300">Sent back by the admin{run.reviewNoteAt ? ` on ${formatDate(run.reviewNoteAt)}` : ''}</p>
                            <p className="text-amber-900/90 dark:text-amber-200/90">{run.reviewNote}</p>
                        </div>
                    </div>
                )}

                {!isPublished && (
                    <ReviewPanel run={run} open={showReview} onToggle={() => setReviewOpen(!showReview)} warningCount={warningCount} onAiReviewed={fetchRun} />
                )}


                {run.payslips.length === 0 ? (
                <EmptyState icon={Users} title="No one in this run" text="Nobody had a salary for this month. Set salaries on the Staff tab, then delete this draft and run it again.">
                    <PrimaryButton onClick={() => router.push('/admin/payroll/staff')}>Go to Staff</PrimaryButton>
                </EmptyState>
                ) : (
                <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/40">
                    {/* Column headings (desktop) */}
                    <div className="hidden lg:flex items-center gap-3 pl-4 pr-4 h-9 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted border-b border-border/60 sticky top-0 z-10 rounded-t-2xl">
                        <span className="w-3.5" />
                        <span className="w-20">Emp ID</span>
                        <span className="w-12" />
                        <span className="flex-1">Employee</span>
                        <span className="w-24 text-right">Paid days</span>
                        <span className="w-24 text-right">Gross</span>
                        <span className="w-24 text-right">Deductions</span>
                        <span className="w-28 text-right">Net pay</span>
                        <span className="w-20 text-center">Status</span>
                        <span className="w-[150px] flex justify-end normal-case tracking-normal">
                            {isPublished && unpaidCount > 0 && (
                                <SmallButton onClick={() => setConfirmAllPaid(true)} className="bg-card !h-6 !px-2 !text-[10px]">
                                    <CheckCircle2 size={11} /> Mark paid ({unpaidCount})
                                </SmallButton>
                            )}
                        </span>
                    </div>
                    {run.payslips.map(p => {
                        const expanded = open === p.id;
                        const short = p.paidDays < p.basisDays;
                        const deductions = p.grossPay - p.netPay;
                        const status = !isPublished ? { label: isDraft ? 'Draft' : isPending ? 'In approval' : 'Approved', tone: 'muted' as const } : p.status === 'PAID' ? { label: 'Paid', tone: 'green' as const } : { label: 'Unpaid', tone: 'amber' as const };
                        return (
                            <div key={p.id} className={expanded ? 'bg-muted/10' : ''}>
                                <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer" onClick={() => setOpen(expanded ? null : p.id)}>
                                    <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                    <span className="hidden lg:block w-20 shrink-0 text-xs font-medium truncate" title={p.employeeCode ?? undefined}>{p.employeeCode || '-'}</span>
                                    {/* Same avatar as the Staff list / Teachers page */}
                                    {p.avatarUrl ? (
                                        <button type="button" title="View photo" onClick={e => { e.stopPropagation(); setPhotoView({ url: p.avatarUrl!, name: p.staffName }); }}
                                            className="relative w-12 h-12 rounded-xl bg-muted ring-2 ring-border shrink-0 overflow-hidden flex items-center justify-center cursor-pointer">
                                            <NextImage src={p.avatarUrl} alt={p.staffName} fill sizes="96px" quality={90} className="object-cover" />
                                        </button>
                                    ) : (
                                        <div className="relative w-12 h-12 rounded-xl bg-muted ring-2 ring-border shrink-0 overflow-hidden flex items-center justify-center">
                                            <span className="text-base font-bold select-none text-primary">{initialsOf(p.staffName)}</span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-[180px]">
                                        <p className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">
                                            {p.staffName}
                                            <Pill>{STAFF_TYPE_LABEL[p.staffType]}</Pill>
                                            {!p.staffEmail && <Pill tone="amber">No email</Pill>}
                                            {p.bonus > 0 && <Pill tone="green">+ {formatINR(p.bonus)} bonus</Pill>}
                                            {p.otherDeduction > 0 && <Pill tone="red">- {formatINR(p.otherDeduction)} deduction</Pill>}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {p.staffDesignation || (p.employeeCode ? '' : ' ')}{p.employeeCode && <span className="lg:hidden">{p.staffDesignation ? ' · ' : ''}#{p.employeeCode}</span>}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {p.paymentMode === 'BANK'
                                                ? (p.bank ? `${p.bank.bankName || 'Bank'} ••••${p.bank.last4}` : <span className="text-red-600 dark:text-red-400">Bank details missing</span>)
                                                : PAYMENT_MODE_LABEL[p.paymentMode]}
                                        </p>
                                    </div>
                                    <div className="text-xs text-right lg:w-24">
                                        <p className={short ? 'font-semibold text-amber-600 dark:text-amber-400' : 'font-medium'}>{fmtDays(p.paidDays)} / {p.basisDays}</p>
                                        <p className="text-[10px] text-muted-foreground">{p.lopDays > 0 ? `${fmtDays(p.lopDays)} LOP` : short ? 'Part month' : 'Full month'}</p>
                                    </div>
                                    <p className="hidden lg:block w-24 text-right text-xs">{formatINR(p.grossPay)}</p>
                                    <p className="hidden lg:block w-24 text-right text-xs text-red-600 dark:text-red-400">{deductions ? `- ${formatINR(deductions)}` : '-'}</p>
                                    <div className="text-right lg:w-28">
                                        <p className="text-sm font-bold">{formatINR(p.netPay)}</p>
                                        {p.prevNetPay !== null && p.prevNetPay > 0 && p.prevNetPay !== p.netPay && (
                                            <p className={`text-[10px] font-semibold ${p.netPay > p.prevNetPay ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                                                title={`Last month: ${formatINR(p.prevNetPay)}`}>
                                                {p.netPay > p.prevNetPay ? '▲' : '▼'} {Math.abs(((p.netPay - p.prevNetPay) / p.prevNetPay) * 100).toFixed(1)}% vs last month
                                            </p>
                                        )}
                                        <p className="lg:hidden text-[10px] text-muted-foreground">Gross {formatINR(p.grossPay)}</p>
                                    </div>
                                    <div className="lg:w-20 flex lg:justify-center"><Pill tone={status.tone}>{status.label}</Pill></div>
                                    <div className="flex items-center justify-end gap-1.5 lg:w-[150px]" onClick={e => e.stopPropagation()}>
                                        {isPublished && p.status !== 'PAID' && <SmallButton onClick={() => markPaid(p)}>Mark paid</SmallButton>}
                                        {isPublished && p.status === 'PAID' && <SmallButton onClick={() => setToUnpay(p)} title="Marked paid by mistake? Set back to unpaid"><RotateCcw size={11} /> Unpaid</SmallButton>}
                                        {p.pdfUrl && (
                                            <a href={p.pdfUrl} target="_blank" rel="noopener noreferrer" title="Open payslip PDF" className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50">
                                                <FaFilePdf size={16} className="text-red-600 dark:text-red-400" />
                                            </a>
                                        )}
                                        {p.pdfUrl && (() => {
                                            // Everyone gets the WhatsApp option, email or not.
                                            const wa = whatsappLink(p.staffPhone, p.staffName, run.month, p.pdfUrl);
                                            return (
                                                <a href={wa.url} target="_blank" rel="noopener noreferrer"
                                                    title={wa.direct ? `Send payslip on WhatsApp to ${p.staffPhone}` : 'Send payslip on WhatsApp (no phone saved, choose the contact)'} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50">
                                                    <FaWhatsapp size={17} className="text-[#25D366]" />
                                                </a>
                                            );
                                        })()}
                                        {isDraft && (
                                            <button title="Remove from this month" onClick={() => setToRemove(p)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                                        )}
                                    </div>
                                </div>
                                {/* Slides open under the row, so it's clear the details belong to it */}
                                <AnimatePresence initial={false}>
                                    {expanded && (
                                        <motion.div key="detail"
                                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                            className="overflow-hidden">
                                            <PayslipDetail p={p} month={run.month} isPublished={isPublished} stageLabel={STAGE_SUBTITLE[run.status]} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
                )}
                </div>
            )}

            <Dialog open={confirmApprove} onOpenChange={o => acting !== 'approve' && setConfirmApprove(o)}>
                <DialogContent className="sm:max-w-sm bg-card">
                    <DialogHeader>
                        <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-2">
                            <ShieldCheck size={22} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <DialogTitle className="text-center">Approve {monthLabel(run.month)} payroll?</DialogTitle>
                        <DialogDescription className="text-center">
                            {run.payslips.length} staff, {formatINR(run.totals.netPay)} total take-home
                            {run.previous ? ` (last month ${formatINR(run.previous.netPay)})` : ''}.
                            {warningCount > 0 ? ` There ${warningCount === 1 ? 'is 1 thing' : `are ${warningCount} things`} flagged in Review.` : ''}
                            {' '}After approval the accountant can publish the payslips.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2">
                        <SecondaryButton className="flex-1" onClick={() => setConfirmApprove(false)} disabled={acting === 'approve'}>Cancel</SecondaryButton>
                        <button type="button" disabled={acting === 'approve'}
                            onClick={async () => { await runAction('approve', 'Payroll approved'); setConfirmApprove(false); }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-60">
                            {acting === 'approve' ? <><Loader2 size={13} className="animate-spin" /> Approving…</> : 'Approve'}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={sendBackOpen} onOpenChange={o => acting !== 'send-back' && setSendBackOpen(o)}>
                <DialogContent className="sm:max-w-md bg-card">
                    <DialogHeader>
                        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center mb-2">
                            <Undo2 size={20} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <DialogTitle className="text-center">Send {monthLabel(run.month)} payroll back?</DialogTitle>
                        <DialogDescription className="text-center">It goes back to draft so the accountant can fix it and send it again. Tell them what to change.</DialogDescription>
                    </DialogHeader>
                    <textarea value={sendBackNote} onChange={e => setSendBackNote(e.target.value)} rows={3} maxLength={500} autoFocus
                        placeholder="e.g. Add 2 LOP days for Ramesh, Suresh's bonus should be ₹2,000"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-foreground/30 resize-none" />
                    <div className="flex gap-2">
                        <SecondaryButton className="flex-1" onClick={() => setSendBackOpen(false)} disabled={acting === 'send-back'}>Cancel</SecondaryButton>
                        <button type="button" onClick={sendBack} disabled={acting === 'send-back' || !sendBackNote.trim()}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-60">
                            {acting === 'send-back' ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : 'Send back'}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmPublish} onOpenChange={o => !publishing && setConfirmPublish(o)}>
                <DialogContent className="sm:max-w-sm bg-card" showCloseButton={!publishing}
                    onEscapeKeyDown={e => publishing && e.preventDefault()} onPointerDownOutside={e => publishing && e.preventDefault()}>
                    {publishing ? (
                        // Publishing makes a PDF, uploads it and emails it for every payslip, so it can take a while.
                        <>
                            <DialogHeader>
                                <div className="mx-auto w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-2"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>
                                <DialogTitle className="text-center">Publishing {monthLabel(run.month)} payslips…</DialogTitle>
                                <DialogDescription className="text-center">
                                    Making {run.payslips.length} payslip PDFs, saving them and emailing staff. This can take a little while, please keep this page open.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <div className="h-full w-1/3 rounded-full animate-[payroll-progress_1.2s_ease-in-out_infinite]" style={{ background: TERRACOTTA }} />
                            </div>
                            <style>{`@keyframes payroll-progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2"><Send size={20} /></div>
                                <DialogTitle className="text-center">Publish {monthLabel(run.month)} payslips?</DialogTitle>
                                <DialogDescription className="text-center">
                                    {run.payslips.length} payslips, {formatINR(run.totals.netPay)} total take-home. They will be locked and shared with staff. This can&apos;t be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex gap-2">
                                <SecondaryButton className="flex-1" onClick={() => setConfirmPublish(false)}>Cancel</SecondaryButton>
                                <PrimaryButton className="flex-1" onClick={publish}>Publish</PrimaryButton>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
            <AnimatePresence>
                {photoView && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => setPhotoView(null)}>
                        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
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

            <Dialog open={!!toUnpay} onOpenChange={o => !unpaying && !o && setToUnpay(null)}>
                <DialogContent className="sm:max-w-sm bg-card">
                    <DialogHeader>
                        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center mb-2">
                            <RotateCcw size={20} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <DialogTitle className="text-center">Set {toUnpay?.staffName} back to unpaid?</DialogTitle>
                        <DialogDescription className="text-center">
                            Use this if the payment was marked by mistake. The paid date{toUnpay?.paymentMethod ? `, method (${toUnpay.paymentMethod})` : ''}{toUnpay?.paymentRef ? ' and reference' : ''} will be cleared. The payslip itself doesn&apos;t change.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2">
                        <SecondaryButton className="flex-1" onClick={() => setToUnpay(null)} disabled={unpaying}>Cancel</SecondaryButton>
                        <button type="button" onClick={markUnpaid} disabled={unpaying}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-60">
                            {unpaying ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Set to unpaid'}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {confirmAllPaid && (
                <PayDialog run={run} onClose={() => setConfirmAllPaid(false)} onDone={() => { setConfirmAllPaid(false); fetchRun(); }} />
            )}

            <DeleteConfirmDialog
                open={!!toRemove}
                onOpenChange={o => !o && !removing && setToRemove(null)}
                label="payslip of"
                name={toRemove?.staffName ?? ''}
                confirmLabel="Remove"
                loading={removing}
                onConfirm={async () => {
                    if (!toRemove) return;
                    setRemoving(true);
                    await removePayslip(toRemove.id);
                    setRemoving(false);
                    setToRemove(null);
                }}
                description={`${toRemove?.staffName ?? 'They'} won't get a payslip for ${monthLabel(run.month)}. Their staff record and salary stay as they are. To add them back, delete this draft and run payroll again.`}
            />
            <DeleteConfirmDialog
                open={confirmDeleteRun}
                onOpenChange={setConfirmDeleteRun}
                label="draft payroll"
                name={monthLabel(run.month)}
                loading={deleting}
                onConfirm={deleteRun}
                description="All draft payslips in this run are removed. You can run this month again afterwards."
            />
        </div>
    );
}

// Expanded view of one payslip, laid out like a printed payslip.
function PayslipDetail({ p, month, isPublished, stageLabel }: { p: Payslip; month: string; isPublished: boolean; stageLabel: string }) {
    const deductions = p.grossPay - p.netPay;
    const info: [string, React.ReactNode][] = [
        ['Employee code', p.employeeCode || '-'],
        ['Designation', p.staffDesignation || '-'],
        ['Staff type', STAFF_TYPE_LABEL[p.staffType]],
        ['Joining date', p.joinedAt ? formatDate(p.joinedAt) : 'Existing staff'],
        ['Payment mode', PAYMENT_MODE_LABEL[p.paymentMode]],
        ['Bank account', p.paymentMode !== 'BANK' ? '-' : p.bank ? `${p.bank.bankName || 'Bank'} ••••${p.bank.last4}${p.bank.ifsc ? ` · ${p.bank.ifsc}` : ''}` : 'Missing'],
        ['PAN', p.panMasked || '-'],
        ['Email', p.staffEmail || '-'],
    ];
    if (p.exitDate) info.splice(4, 0, ['Last working day', formatDate(p.exitDate)]);

    const Table = ({ title, tone, lines, totalLabel, total }: { title: string; tone: string; lines: MoneyLine[]; totalLabel: string; total: number }) => (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex justify-between px-3.5 py-2 bg-muted/40 text-[10px] font-semibold uppercase tracking-wide">
                <span className={tone}>{title}</span><span className="text-muted-foreground">Amount</span>
            </div>
            <div className="divide-y divide-border/40">
                {lines.length === 0
                    ? <p className="px-3.5 py-2 text-muted-foreground">None</p>
                    : lines.map((l, i) => (
                        <div key={i} className="flex justify-between px-3.5 py-1.5"><span>{l.label}</span><span className="font-medium tabular-nums">{formatINR(l.amount)}</span></div>
                    ))}
            </div>
            <div className="flex justify-between px-3.5 py-2 border-t border-border/60 font-semibold"><span>{totalLabel}</span><span className="tabular-nums">{formatINR(total)}</span></div>
        </div>
    );

    return (
        <div className="px-4 pb-4 text-xs">
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Payslip · {monthLabel(month)}</p>
                    <p className="text-muted-foreground">
                        {!isPublished ? stageLabel
                            : p.status === 'PAID'
                                ? `Paid${p.paidAt ? ` on ${formatDate(p.paidAt)}` : ''}${p.paymentMethod ? ` · ${p.paymentMethod}` : ''}${p.paymentRef ? ` · Ref ${p.paymentRef}` : ''}`
                                : 'Published, payment pending'}
                    </p>
                </div>

                <div className="grid gap-x-6 gap-y-2.5 grid-cols-2 md:grid-cols-4">
                    {info.map(([k, v]) => (
                        <div key={k} className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
                            <p className="font-medium truncate">{v}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-3 rounded-xl border border-border/60 bg-card divide-x divide-border/60 text-center">
                    <div className="py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Days in month</p><p className="text-sm font-semibold">{p.basisDays}</p></div>
                    <div className="py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid days</p><p className="text-sm font-semibold">{fmtDays(p.paidDays)}</p></div>
                    <div className="py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">LOP days</p><p className="text-sm font-semibold">{fmtDays(p.lopDays)}</p></div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <Table title="Earnings" tone="text-emerald-700 dark:text-emerald-400" lines={p.earnings} totalLabel="Gross earnings" total={p.grossPay} />
                    <Table title="Deductions" tone="text-red-700 dark:text-red-400" lines={p.deductions} totalLabel="Total deductions" total={deductions} />
                </div>

                {p.tdsInfo && 'annualTax' in p.tdsInfo && (
                    // How this month's TDS was worked out (whole financial year estimate).
                    <div className="rounded-xl border border-border/60 bg-card px-4 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Income tax (TDS) · {p.tdsInfo.regime === 'OLD' ? 'old' : 'new'} regime
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1">
                            <span>Estimated salary this year: <span className="font-semibold tabular-nums">{formatINR(p.tdsInfo.estimatedAnnualIncome)}</span></span>
                            <span>Deductions: <span className="font-semibold tabular-nums">{formatINR(p.tdsInfo.deductions)}</span></span>
                            <span>Taxable: <span className="font-semibold tabular-nums">{formatINR(p.tdsInfo.taxableIncome)}</span></span>
                            <span>Tax for the year: <span className="font-semibold tabular-nums">{formatINR(p.tdsInfo.annualTax)}</span></span>
                            <span>Already cut: <span className="font-semibold tabular-nums">{formatINR(p.tdsInfo.alreadyDeducted)}</span></span>
                            <span>Spread over {p.tdsInfo.monthsLeft} month{p.tdsInfo.monthsLeft === 1 ? '' : 's'}</span>
                            {p.tdsInfo.noPanRule && <span className="text-red-600 dark:text-red-400 font-semibold">No PAN: 20% minimum applied</span>}
                        </div>
                    </div>
                )}

                {(p.employerContributions?.length ?? 0) > 0 && (
                    // School's PF share etc.: part of the cost, not taken from the salary.
                    <div className="rounded-xl border border-border/60 bg-card px-4 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Paid by the school (not deducted)</p>
                            <p className="text-[10px] text-muted-foreground">PF wages {formatINR(p.pfWages)}</p>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1">
                            {p.employerContributions!.map((l, i) => (
                                <span key={i}>{l.label}: <span className="font-semibold tabular-nums">{formatINR(l.amount)}</span></span>
                            ))}
                            <span className="text-muted-foreground">Total cost to school: <span className="font-semibold text-foreground tabular-nums">{formatINR(p.grossPay - (p.deductions.find(l => l.label.startsWith('Loss of Pay'))?.amount ?? 0) + p.employerContributions!.reduce((t, l) => t + l.amount, 0))}</span></span>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-4 py-3">
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Net pay</p>
                        <p className="text-muted-foreground italic">{amountInWords(p.netPay)}</p>
                    </div>
                    <p className="text-xl font-bold tabular-nums">{formatINR(p.netPay)}</p>
                </div>
            </div>
        </div>
    );
}

// Draft -> Sent for approval -> Approved -> Published, with who / when.
function RunStepper({ run }: { run: RunDetail }) {
    const order: RunStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED'];
    const current = order.indexOf(run.status);
    const steps = [
        { label: 'Draft', meta: 'Prepare salaries' },
        { label: 'Sent for approval', meta: run.submittedAt && current >= 1 ? `${run.submittedByName ?? ''}${run.submittedByName ? ' · ' : ''}${formatDate(run.submittedAt)}` : 'Accountant sends' },
        { label: 'Approved', meta: run.approvedAt && current >= 2 ? `${run.approvedByName ?? ''}${run.approvedByName ? ' · ' : ''}${formatDate(run.approvedAt)}` : 'Admin approves' },
        { label: 'Published', meta: run.publishedAt ? formatDate(run.publishedAt) : 'Payslips shared' },
    ];
    return (
        <div className="h-full flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 overflow-x-auto">
            {steps.map((st, i) => {
                const done = i < current || run.status === 'PUBLISHED';
                const active = i === current && run.status !== 'PUBLISHED';
                return (
                    <div key={st.label} className="flex items-center gap-2 shrink-0">
                        {i > 0 && <div className={`w-8 h-px ${i <= current ? 'bg-foreground/40' : 'bg-border'}`} />}
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${done ? 'text-white' : active ? 'text-white' : 'bg-muted text-muted-foreground'}`}
                            style={done || active ? { background: TERRACOTTA, opacity: done && !active ? 0.85 : 1 } : undefined}>
                            {done ? <Check size={11} /> : i + 1}
                        </span>
                        <div className="leading-tight">
                            <p className={`text-xs ${active ? 'font-semibold' : done ? 'font-medium' : 'text-muted-foreground'}`}>{st.label}</p>
                            <p className="text-[10px] text-muted-foreground">{st.meta}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// Smart Review: rule-based checks of every payslip (exact, free) plus a short
// AI-written summary of them on demand. Collapsed to one line by default; the
// admin sees it open while approving.
function ReviewPanel({ run, open, onToggle, warningCount, onAiReviewed }: { run: RunDetail; open: boolean; onToggle: () => void; warningCount: number; onAiReviewed: () => void }) {
    const prev = run.previous;
    const diff = prev ? run.totals.netPay - prev.netPay : null;
    const diffPct = prev && prev.netPay > 0 ? (diff! / prev.netPay) * 100 : null;
    // AI summary: made automatically when the panel is open and there is no summary
    // yet, or the payroll numbers changed since the last one. Tried once per change.
    const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');
    const lastTried = useRef<string | null>(null);
    const signature = run.payslips.map(p => `${p.id}:${p.netPay}:${p.bonus}:${p.lopDays}:${p.otherDeduction}`).join('|');
    const askAi = useCallback(async () => {
        lastTried.current = signature;
        setAiState('loading');
        try {
            await api.post(`/admin/payroll/runs/${run.id}/ai-review`);
            setAiState('idle');
            onAiReviewed();
        } catch {
            setAiState('error');
        }
    }, [run.id, signature, onAiReviewed]);
    // Only once the payroll is sent for approval (numbers are locked then). While
    // it's a draft nothing is written, so LOP / bonus edits don't spend tokens.
    const isDraftRun = run.status === 'DRAFT';
    useEffect(() => {
        if (isDraftRun || !open || run.payslips.length === 0 || aiState === 'loading') return;
        const needs = !run.aiReview || run.aiReviewStale;
        if (!needs || lastTried.current === signature) return;
        // Just sent? The server is already writing it in the background; give it a moment.
        const justSent = run.submittedAt && Date.now() - new Date(run.submittedAt).getTime() < 60_000;
        const t = setTimeout(() => { void askAi(); }, justSent ? 5000 : 0);
        return () => clearTimeout(t);
    }, [isDraftRun, open, run.aiReview, run.aiReviewStale, run.payslips.length, run.submittedAt, signature, aiState, askAi]);

    const critical = run.warnings.filter(w => w.level === 'critical');
    const warnings = run.warnings.filter(w => w.level === 'warning');
    const notes = run.warnings.filter(w => w.level === 'info');

    return (
        <div className="rounded-xl border border-border/60 bg-card text-xs">
            <button type="button" onClick={onToggle} className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2 text-left">
                <span className="flex items-center gap-1.5 font-semibold">
                    <Sparkles size={14} className="text-[#DA7756]" />
                    AI Review
                </span>
                {critical.length > 0 && <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><XCircle size={12} /> {critical.length} {critical.length === 1 ? 'warning' : 'warnings'}</span>}
                {warnings.length > 0 && <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><AlertTriangle size={12} /> {warnings.length} to check</span>}
                {warningCount === 0 && <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={12} /> Looks ready to pay</span>}
                {prev && diff !== null && (
                    <span className="text-muted-foreground">
                        vs {monthLabel(prev.month)}: <span className={diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-red-600 dark:text-red-400' : ''}>
                            {diff === 0 ? 'same total' : `${diff > 0 ? '+' : '-'}${formatINR(Math.abs(diff))}${diffPct !== null ? ` (${diff > 0 ? '+' : '-'}${Math.abs(diffPct).toFixed(1)}%)` : ''}`}
                        </span>
                    </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">AI can make mistakes. Please double-check before paying.</span>
                <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-3.5 pb-3 pt-1 space-y-3">
                            <div className="grid gap-3 md:grid-cols-[260px_1fr]">
                                <div className="rounded-lg border border-border/50 divide-y divide-border/40 self-start">
                                    {[
                                        ['Staff', `${run.payslips.length}${prev ? `  (last month ${prev.staffCount})` : ''}`],
                                        ['Total take-home', formatINR(run.totals.netPay)],
                                        ['Last month', prev ? `${formatINR(prev.netPay)} · ${monthLabel(prev.month)}` : 'No earlier payroll'],
                                        ['Bonus this month', formatINR(run.payslips.reduce((t, p) => t + p.bonus, 0))],
                                        ['LOP days this month', String(run.payslips.reduce((t, p) => t + p.lopDays, 0))],
                                    ].map(([k, v]) => (
                                        <div key={k} className="flex justify-between gap-2 px-3 py-1.5"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>
                                    ))}
                                </div>
                                <div className="space-y-1.5">
                                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                                        <Sparkles size={14} className="text-foreground shrink-0" />
                                        <span>Findings{run.warnings.length ? ` (${run.warnings.length})` : ''}</span>
                                    </p>
                                    {run.warnings.length === 0 && <p className="text-muted-foreground py-1">Everything looks fine: everyone has bank details, a salary and a normal take-home.</p>}
                                    {critical.map((w, i) => (
                                        <div key={`c${i}`} className="flex items-start gap-2 rounded-lg px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200">
                                            <XCircle size={13} className="mt-0.5 shrink-0" /><span><b className="mr-1">Warning:</b>{w.message}</span>
                                        </div>
                                    ))}
                                    {warnings.map((w, i) => (
                                        <div key={`w${i}`} className="flex items-start gap-2 rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
                                            <AlertTriangle size={13} className="mt-0.5 shrink-0" /><span><b className="mr-1">Check:</b>{w.message}</span>
                                        </div>
                                    ))}
                                    {notes.map((w, i) => (
                                        <div key={`n${i}`} className="flex items-start gap-2 rounded-lg px-3 py-2 bg-muted/50 text-muted-foreground">
                                            <Info size={13} className="mt-0.5 shrink-0" /><span>{w.message}</span>
                                        </div>
                                    ))}

                                    {/* AI summary of the findings above, made automatically */}
                                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground pt-2">
                                        <Sparkles size={14} className="text-foreground" /> Observation
                                    </p>
                                    <div className="rounded-lg border border-border/60 px-3 py-2.5">
                                        {isDraftRun ? (
                                            <p className="text-muted-foreground">The observation is written when this payroll is sent for approval.</p>
                                        ) : aiState === 'loading' ? (
                                            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Writing an observation…</p>
                                        ) : aiState === 'error' && !run.aiReview ? (
                                            <p className="text-muted-foreground">Couldn&apos;t write an observation right now. <button type="button" onClick={askAi} className="underline font-medium text-foreground">Try again</button></p>
                                        ) : run.aiReview ? (
                                            <>
                                                <p className="font-medium">{run.aiReview.summary}</p>
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    {run.aiReviewAt ? `Updated ${formatDate(run.aiReviewAt)}` : ''}
                                                    {aiState === 'error' ? ' · couldn\'t refresh, showing the last observation' : ''}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-muted-foreground">Observation will appear here.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

type GridRow = { lop: string; bonus: string; ded: string; note: string };

// Spreadsheet-style entry of this month's LOP days, bonus and other deductions.
// Saving recalculates the changed payslips on the server.
function InputsGrid({ run, onClose, onSaved }: { run: RunDetail; onClose: () => void; onSaved: () => void }) {
    const initial = (p: Payslip): GridRow => ({
        lop: p.lopDays ? String(p.lopDays) : '',
        bonus: p.bonus ? paiseToInput(p.bonus) : '',
        ded: p.otherDeduction ? paiseToInput(p.otherDeduction) : '',
        note: p.inputNote ?? '',
    });
    const [rows, setRows] = useState<Record<string, GridRow>>(() => Object.fromEntries(run.payslips.map(p => [p.id, initial(p)])));
    const [saving, setSaving] = useState(false);
    const set = (id: string, patch: Partial<GridRow>) => setRows(r => ({ ...r, [id]: { ...r[id], ...patch } }));

    const changed = run.payslips.filter(p => JSON.stringify(rows[p.id]) !== JSON.stringify(initial(p)));
    const lopError = (p: Payslip) => {
        const v = rows[p.id].lop.trim();
        if (!v) return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n * 2)) return 'Whole or half days';
        if (n > p.basisDays) return `Max ${p.basisDays}`;
        return null;
    };
    const hasError = run.payslips.some(p => lopError(p));

    const save = async () => {
        if (hasError) { toast.error('Fix the LOP days marked in red'); return; }
        if (changed.length === 0) { onClose(); return; }
        setSaving(true);
        try {
            await api.put(`/admin/payroll/runs/${run.id}/inputs`, {
                items: changed.map(p => ({
                    payslipId: p.id,
                    lopDays: Number(rows[p.id].lop || 0),
                    bonus: rupeesToPaise(rows[p.id].bonus || '0'),
                    otherDeduction: rupeesToPaise(rows[p.id].ded || '0'),
                    note: rows[p.id].note.trim() || null,
                })),
            });
            toast.success(`${changed.length} ${changed.length === 1 ? 'salary' : 'salaries'} recalculated`);
            onSaved();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to save'));
        } finally {
            setSaving(false);
        }
    };

    const cell = 'h-8 w-full px-2 rounded-lg border border-border bg-background text-xs text-right tabular-nums focus:outline-none focus:border-foreground/30';
    return (
        <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60">
                <div>
                    <p className="text-sm font-semibold">LOP &amp; bonus for {monthLabel(run.month)}</p>
                    <p className="text-[11px] text-muted-foreground">LOP = unpaid leave days (half days like 1.5 are fine). Amounts in ₹. Salaries are recalculated when you save.</p>
                </div>
                <div className="flex items-center gap-2">
                    <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
                    <PrimaryButton onClick={save} disabled={saving || hasError}>
                        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> Save{changed.length ? ` (${changed.length})` : ''}</>}
                    </PrimaryButton>
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--scrollbar-thumb) transparent' }}>
                <table className="w-full min-w-[820px] text-xs">
                    <thead className="sticky top-0 z-10 bg-muted text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <tr>
                            <th className="text-left px-4 py-2 w-20">Emp ID</th>
                            <th className="text-left px-2 py-2">Employee</th>
                            <th className="text-right px-2 py-2 w-20">Days</th>
                            <th className="text-right px-2 py-2 w-24">LOP days</th>
                            <th className="text-right px-2 py-2 w-28">Bonus ₹</th>
                            <th className="text-right px-2 py-2 w-28">Other deduction ₹</th>
                            <th className="text-left px-2 py-2 w-56">Note</th>
                            <th className="text-right px-4 py-2 w-28">Net now</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                        {run.payslips.map(p => {
                            const r = rows[p.id];
                            const err = lopError(p);
                            const dirty = changed.includes(p);
                            return (
                                <tr key={p.id} className={dirty ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                                    <td className="px-4 py-1.5 font-medium">{p.employeeCode || '-'}</td>
                                    <td className="px-2 py-1.5">
                                        <p className="font-semibold">{p.staffName}</p>
                                        <p className="text-[10px] text-muted-foreground">{p.staffDesignation || STAFF_TYPE_LABEL[p.staffType]}</p>
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-muted-foreground">{p.basisDays}</td>
                                    <td className="px-2 py-1.5">
                                        <input inputMode="decimal" placeholder="0" value={r.lop} title={err ?? undefined}
                                            onChange={e => set(p.id, { lop: e.target.value.replace(/[^\d.]/g, '').slice(0, 4) })}
                                            className={`${cell} ${err ? '!border-red-500' : ''}`} />
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <input inputMode="decimal" placeholder="0" value={r.bonus} onChange={e => set(p.id, { bonus: e.target.value.replace(/[^\d.]/g, '').slice(0, 10) })} className={cell} />
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <input inputMode="decimal" placeholder="0" value={r.ded} onChange={e => set(p.id, { ded: e.target.value.replace(/[^\d.]/g, '').slice(0, 10) })} className={cell} />
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <input placeholder="e.g. Diwali bonus, Advance recovery" value={r.note} maxLength={200}
                                            onChange={e => set(p.id, { note: e.target.value })} className={`${cell} !text-left`} />
                                    </td>
                                    <td className="px-4 py-1.5 text-right font-semibold tabular-nums">{formatINR(p.netPay)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Progress of the background publish (PDFs + emails), or what went wrong.
function PublishProgress({ run, onRetry, retrying }: { run: RunDetail; onRetry: () => void; retrying: boolean }) {
    const running = run.publishState === 'RUNNING';
    const pct = run.publishTotal ? Math.round((run.publishDone / run.publishTotal) * 100) : 0;
    return (
        <div className={`shrink-0 rounded-xl border px-4 py-3 text-xs ${running ? 'border-border/60 bg-card' : 'border-red-300/60 bg-red-50 dark:bg-red-950/30 dark:border-red-900/60'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    {running ? <Loader2 size={15} className="animate-spin text-muted-foreground" /> : <AlertTriangle size={15} className="text-red-600 dark:text-red-400" />}
                    <div>
                        <p className="font-semibold">
                            {running ? `Publishing payslips… ${run.publishDone} of ${run.publishTotal} done` : `Publishing stopped: ${run.publishDone} of ${run.publishTotal} done`}
                        </p>
                        <p className={running ? 'text-muted-foreground' : 'text-red-700 dark:text-red-300'}>
                            {running ? 'Making PDFs and emailing staff. It runs on the server, so you can leave this page.' : run.publishError}
                        </p>
                    </div>
                </div>
                {!running && (
                    <PrimaryButton onClick={onRetry} disabled={retrying}>
                        {retrying ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Retry
                    </PrimaryButton>
                )}
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: running ? TERRACOTTA : '#dc2626' }} />
            </div>
        </div>
    );
}

// Download the files used to actually pay: bank upload CSV + cash / cheque list.
function PaymentsBar({ run }: { run: RunDetail }) {
    const unpaidAll = run.payslips.filter(p => p.status !== 'PAID');
    // Stays after everyone is paid: then the files list everyone, as a record.
    const allPaid = unpaidAll.length === 0;
    const unpaid = allPaid ? run.payslips : unpaidAll;
    const bank = unpaid.filter(p => p.paymentMode === 'BANK');
    const bankReady = bank.filter(p => p.bank);
    const other = unpaid.filter(p => p.paymentMode !== 'BANK');
    const [busy, setBusy] = useState<string | null>(null);

    const download = async (list: 'bank' | 'other' | 'pf') => {
        setBusy(list);
        try {
            const res = await api.get(list === 'pf' ? `/admin/payroll/runs/${run.id}/pf-ecr.txt` : `/admin/payroll/runs/${run.id}/payments.csv?list=${list}${allPaid ? '&include=all' : ''}`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = list === 'pf' ? `pf-ecr-${run.month}.txt` : `salary-${list === 'bank' ? 'bank' : 'cash-cheque'}-${run.month}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Could not download the file'));
        } finally {
            setBusy(null);
        }
    };

    const total = (list: Payslip[]) => formatINR(list.reduce((t, p) => t + p.netPay, 0));
    return (
        <div className="h-full flex items-center gap-x-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5 text-xs overflow-hidden">
            <span className="font-semibold shrink-0">Pay salaries</span>
            {allPaid && (
                <span className="shrink-0 whitespace-nowrap flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={12} /> All {run.payslips.length} paid · {total(run.payslips)}
                </span>
            )}
            {bankReady.length > 0 && (
                <SmallButton onClick={() => download('bank')} disabled={!!busy} title="CSV to upload on your bank's bulk payment page" className="shrink-0 whitespace-nowrap">
                    {busy === 'bank' ? <Loader2 size={11} className="animate-spin" /> : <FaFileExcel size={13} className="text-[#1D6F42]" />} Bank file · {bankReady.length} · {total(bankReady)}
                </SmallButton>
            )}
            {run.payslips.some(p => p.pfWages > 0) && (
                <SmallButton onClick={() => download('pf')} disabled={!!busy} className="shrink-0 whitespace-nowrap" title="ECR text file to upload on the EPFO portal for this month's PF">
                    {busy === 'pf' ? <Loader2 size={11} className="animate-spin" /> : <Landmark size={12} />} PF ECR file
                </SmallButton>
            )}
            {other.length > 0 && (
                <SmallButton onClick={() => download('other')} disabled={!!busy} className="shrink-0 whitespace-nowrap">
                    {busy === 'other' ? <Loader2 size={11} className="animate-spin" /> : <FaFileExcel size={13} className="text-[#1D6F42]" />} Cash / cheque list · {other.length} · {total(other)}
                </SmallButton>
            )}
            {bank.length > bankReady.length && (
                <span className="shrink-0 whitespace-nowrap flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={12} /> {bank.length - bankReady.length} not in the bank file (bank details missing)
                </span>
            )}
            {!allPaid && (
                <span className="text-muted-foreground truncate min-w-0" title="After paying, use Mark paid in the table to add the UTR / cheque numbers.">
                    After paying, use <b>Mark paid</b> in the table to add the UTR / cheque numbers.
                </span>
            )}
        </div>
    );
}

// Mark unpaid payslips as paid, each with its UTR / cheque number (optional).
function PayDialog({ run, onClose, onDone }: { run: RunDetail; onClose: () => void; onDone: () => void }) {
    const unpaid = run.payslips.filter(p => p.status !== 'PAID');
    const [selected, setSelected] = useState<Set<string>>(() => new Set(unpaid.map(p => p.id)));
    const [refs, setRefs] = useState<Record<string, string>>({});
    const [common, setCommon] = useState('');
    const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
    const [saving, setSaving] = useState(false);

    const toggle = (id: string) => setSelected(sel => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const chosen = unpaid.filter(p => selected.has(p.id));
    // The common UTR is a bank batch number, so it only belongs to bank transfers.
    // Typing one unticks cash / cheque people; clearing it ticks them again.
    const onCommonChange = (value: string) => {
        const wasEmpty = !common.trim();
        const isEmpty = !value.trim();
        setCommon(value);
        if (wasEmpty === isEmpty) return;
        setSelected(sel => {
            const n = new Set(sel);
            for (const p of unpaid) if (p.paymentMode !== 'BANK') { if (isEmpty) n.add(p.id); else n.delete(p.id); }
            return n;
        });
    };
    const refFor = (p: RunDetail['payslips'][number]) => (refs[p.id] ?? '').trim() || (p.paymentMode === 'BANK' ? common.trim() : '') || null;

    const save = async () => {
        if (chosen.length === 0) { toast.error('Select at least one person'); return; }
        setSaving(true);
        try {
            await api.post(`/admin/payroll/runs/${run.id}/mark-paid-bulk`, {
                paidOn,
                items: chosen.map(p => ({ payslipId: p.id, paymentRef: refFor(p) })),
            });
            toast.success(`${chosen.length} marked as paid`);
            onDone();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to mark paid'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={o => !o && !saving && onClose()}>
            <DialogContent className="sm:max-w-2xl bg-card max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden" onOpenAutoFocus={e => e.preventDefault()}>
                <DialogHeader className="shrink-0 px-5 pt-5 pb-4 border-b border-border/50">
                    <DialogTitle>Mark salaries as paid</DialogTitle>
                    <DialogDescription>Only after the money has actually been sent. Add the bank UTR or cheque number so there is a record.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 text-xs">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                            <span className="font-semibold text-muted-foreground">Paid on</span>
                            <input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)}
                                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-foreground/30" />
                        </label>
                        <label className="block space-y-1">
                            <span className="font-semibold text-muted-foreground">Same UTR for all bank transfers (optional)</span>
                            <input value={common} onChange={e => onCommonChange(e.target.value)} maxLength={100} placeholder="e.g. bank batch / UTR number"
                                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-foreground/30" />
                        </label>
                    </div>
                    <div className="rounded-xl border border-border/60 divide-y divide-border/40">
                        <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <input type="checkbox" checked={chosen.length === unpaid.length} onChange={() => setSelected(chosen.length === unpaid.length ? new Set() : new Set(unpaid.map(p => p.id)))} className="accent-[#DA7756]" />
                            <span className="flex-1">Employee</span>
                            <span className="w-24 text-right">Amount</span>
                            <span className="w-44">UTR / cheque no.</span>
                        </div>
                        {unpaid.map(p => (
                            <div key={p.id} className={`flex items-center gap-3 px-3 py-2 ${selected.has(p.id) ? '' : 'opacity-50'}`}>
                                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="accent-[#DA7756]" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{p.staffName}</p>
                                    <p className="text-[10px] text-muted-foreground">{PAYMENT_MODE_LABEL[p.paymentMode]}{p.bank ? ` · ••••${p.bank.last4}` : ''}</p>
                                </div>
                                <span className="w-24 text-right font-semibold tabular-nums">{formatINR(p.netPay)}</span>
                                <input value={refs[p.id] ?? ''} onChange={e => setRefs(r => ({ ...r, [p.id]: e.target.value }))} maxLength={100}
                                    placeholder={(p.paymentMode === 'BANK' && common) || (p.paymentMode === 'CASH' ? 'optional' : p.paymentMode === 'CHEQUE' ? 'Cheque no.' : 'UTR no.')} disabled={!selected.has(p.id)}
                                    className="w-44 h-8 px-2 rounded-lg border border-border bg-background focus:outline-none focus:border-foreground/30" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-4 border-t border-border/50 bg-muted/20">
                    <span className="text-xs text-muted-foreground">{chosen.length} selected · {formatINR(chosen.reduce((t, p) => t + p.netPay, 0))}</span>
                    <div className="flex gap-2">
                        <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
                        <button type="button" onClick={save} disabled={saving || chosen.length === 0}
                            className="inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-60">
                            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={13} /> Mark {chosen.length} paid</>}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
