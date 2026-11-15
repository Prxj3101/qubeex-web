'use client';

import { useEffect, useState } from 'react';
import { BookOpen, FileBarChart, HandCoins, Loader2, ScanLine, Settings2, Shield } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { PageHeader, EmptyState } from '@/app/admin/payroll/_components/ui';
import IssueReturn from './IssueReturn';
import BooksPanel from './BooksPanel';
import FinesPanel from './FinesPanel';
import ReportsPanel from './ReportsPanel';
import SettingsPanel from './SettingsPanel';

const TABS = [
    { key: 'issue', label: 'Issue / Return', icon: ScanLine },
    { key: 'books', label: 'Books', icon: BookOpen },
    { key: 'fines', label: 'Fines', icon: HandCoins },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
    { key: 'settings', label: 'Settings', icon: Settings2 },
] as const;
type Tab = typeof TABS[number]['key'];

export default function LibraryPage() {
    const user = useAuthStore((s) => s.user);
    const [tab, setTab] = useState<Tab>('issue');
    const [configured, setConfigured] = useState<boolean | null>(null);

    const allowed = !!user && (user.role !== 'SUB_ADMIN' || !!user.permissions?.includes('LIBRARY'));

    useEffect(() => {
        if (!allowed) return;
        api.get('/admin/library/settings')
            .then((res) => {
                const ok = !!res.data.data.rulesConfigured;
                setConfigured(ok);
                if (!ok) setTab('settings');
            })
            .catch(() => setConfigured(false));
    }, [allowed]);

    if (!user) return null;
    if (!allowed) return <EmptyState icon={Shield} title="Library access restricted" text="Contact your admin to request library access." />;

    return (
        <div className="h-full min-h-0 flex flex-col px-1">
            <PageHeader title="Library" subtitle="Issue, return and manage books" />
            <div className="shrink-0 py-2 max-w-full overflow-x-auto">
                <div className="flex items-center gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50 w-fit">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} type="button" onClick={() => setTab(key)} aria-pressed={tab === key}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-4xl whitespace-nowrap ${tab === key ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                            <Icon size={14} />{label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pt-2">
                {configured === null ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div> : (
                    <>
                        {tab === 'issue' && <IssueReturn rulesConfigured={configured} />}
                        {tab === 'books' && <BooksPanel />}
                        {tab === 'fines' && <FinesPanel />}
                        {tab === 'reports' && <ReportsPanel />}
                        {tab === 'settings' && <SettingsPanel onSaved={(ok) => setConfigured(ok)} />}
                    </>
                )}
            </div>
        </div>
    );
}
