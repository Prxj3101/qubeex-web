'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, LayoutGrid, Settings2, Shield, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/authStore';
import { EmptyState, SecondaryButton } from '@/app/admin/payroll/_components/ui';
import type { SettingsResponse } from './admissions.types';
import AdmissionsBoard from './AdmissionsBoard';
import PlacementPanel from './PlacementPanel';
import SettingsPanel from './SettingsPanel';
import AdmissionFormSetup from './AdmissionFormSetup';
import ShareFormDialog from './ShareFormDialog';
import ApplicationForm from './ApplicationForm';
import ApplicationDrawer from './ApplicationDrawer';

const tabs = [
    { key: 'board', label: 'Applications', icon: LayoutGrid },
    { key: 'place', label: 'Place in class', icon: UserCheck },
    { key: 'form', label: 'Admission form', icon: FileText },
] as const;
type Tab = typeof tabs[number]['key'] | 'settings';

export default function AdmissionsPage() {
    const user = useAuthStore(s => s.user);
    const [tabState, setTabState] = useState<Tab>('board');
    // The open tab is kept in the address (?tab=...), so a refresh stays on the same tab.
    const setTab = (next: Tab) => {
        setTabState(next);
        const url = new URL(window.location.href);
        if (next === 'board') url.searchParams.delete('tab'); else url.searchParams.set('tab', next);
        window.history.replaceState(window.history.state, '', url);
    };
    useEffect(() => {
        const saved = new URLSearchParams(window.location.search).get('tab');
        if (saved !== 'place' && saved !== 'form' && saved !== 'settings') return;
        const t = setTimeout(() => setTabState(saved), 0);
        return () => clearTimeout(t);
    }, []);
    const [setup, setSetup] = useState<SettingsResponse | null>(null);
    const [setupError, setSetupError] = useState('');
    // The form tab exists only while the admission form is on.
    const tab: Tab = tabState === 'form' && setup && !setup.settings.admissionForm.enabled ? 'board' : tabState;
    const [sharing, setSharing] = useState(false);
    const [adding, setAdding] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const [boardKey, setBoardKey] = useState(0);
    const [view, setView] = useState<'open' | 'closed'>('open');
    // Settings open with fresh data; autosaves after that do not reload the panel.
    const [settingsKey, setSettingsKey] = useState(0);

    const loadSetup = useCallback((signal?: AbortSignal) => api.get('/admin/admissions/settings', { signal }).then(res => {
        if (!signal?.aborted) { setSetup(res.data.data); setSetupError(''); }
    }).catch(err => { if (!signal?.aborted) setSetupError(getErrorMessage(err, 'Could not load admissions')); }), []);
    useEffect(() => { const controller = new AbortController(); void loadSetup(controller.signal); return () => controller.abort(); }, [loadSetup]);

    const refresh = () => setBoardKey(k => k + 1);
    // Always open settings with fresh data (e.g. the admission counter moves on every admit).
    const openSettings = () => { setTab('settings'); void loadSetup().then(() => setSettingsKey(k => k + 1)); };

    if (!user) return null;
    if (user.role === 'SUB_ADMIN' && !user.permissions?.includes('ADMISSIONS')) {
        return <EmptyState icon={Shield} title="Admissions access restricted" text="Contact your admin to request admissions access." />;
    }

    return (
        <div className="h-full min-h-0 min-w-0 w-full flex flex-col px-1">
            <div className="shrink-0 pb-1 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                    {tabs.filter(t => t.key !== 'form' || setup?.settings.admissionForm.enabled).map(({ key, label, icon: Icon }) => (
                        <button key={key} type="button" onClick={() => setTab(key)} className="relative" aria-pressed={tab === key}>
                            {tab === key && <motion.div layoutId="admissionsTab" className="absolute inset-0 bg-primary rounded-4xl" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
                            <span className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl whitespace-nowrap ${tab === key ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                <Icon size={14} />{label}
                            </span>
                        </button>
                    ))}
                </div>
                <button type="button" onClick={openSettings} aria-pressed={tab === 'settings'} aria-label="Admission settings" title="Admission settings"
                    className={`relative flex items-center justify-center w-[41px] h-[41px] rounded-full border border-border/50 transition-colors ${tab === 'settings' ? 'text-white' : 'bg-muted/50 text-muted-foreground hover:text-foreground'}`}>
                    {tab === 'settings' && <motion.div layoutId="admissionsTab" className="absolute inset-0 bg-primary rounded-full" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
                    <Settings2 size={16} className="relative z-10" />
                </button>
                {tab === 'board' && setup && (
                    <div className="ml-auto flex gap-1 bg-muted/50 rounded-xl p-0.5 border border-border/50 w-fit shrink-0">
                        {([{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }] as const).map(item => (
                            <button key={item.value} type="button" aria-pressed={view === item.value} onClick={() => setView(item.value)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${view === item.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{item.label}</button>
                        ))}
                    </div>
                )}
            </div>

            {setupError ? (
                <EmptyState icon={Shield} title="Could not load admissions" text={setupError}><SecondaryButton onClick={() => void loadSetup()}>Retry</SecondaryButton></EmptyState>
            ) : !setup ? (
                <p role="status" className="py-16 text-center text-sm text-muted-foreground">Loading admissions...</p>
            ) : (
                <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                    {tab === 'board' && <AdmissionsBoard key={boardKey} setup={setup} view={view} onOpen={setOpenId} onSettings={openSettings} onShare={() => setSharing(true)} onAdd={() => setAdding(true)} />}
                    {tab === 'place' && <PlacementPanel key={boardKey} onOpen={setOpenId} />}
                    {tab === 'form' && setup.settings.admissionForm.enabled && <AdmissionFormSetup onSaved={() => void loadSetup()} />}
                    {tab === 'settings' && <SettingsPanel key={settingsKey} setup={setup} onSaved={next => { setSetup(next); refresh(); }} />}
                </div>
            )}

            {setup && <ShareFormDialog open={sharing} onClose={() => setSharing(false)} setup={setup} onSettings={() => { setSharing(false); openSettings(); }} />}
            {setup && adding && (
                <ApplicationForm standards={setup.standards} fields={setup.settings.fields} questions={setup.settings.questions}
                    onClose={() => setAdding(false)}
                    onSaved={id => { setAdding(false); refresh(); setOpenId(id); toast.success('Application added'); }} />
            )}
            {openId && <ApplicationDrawer id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
        </div>
    );
}
