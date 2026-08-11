'use client';

import { useEffect, useState } from 'react';
import { Database, HardDrive, ShieldCheck, Loader2, CheckCircle2, XCircle, PlugZap } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

type Mode = 'MANAGED' | 'BYOD';
type Engine = 'POSTGRES' | 'MYSQL' | 'SQLSERVER';

interface DbConfig {
    mode: Mode;
    engine?: Engine | null;
    host?: string | null;
    port?: number | null;
    databaseName?: string | null;
    username?: string | null;
    hasPassword?: boolean;
    sslMode?: string | null;
    status?: string;
    lastTestedAt?: string | null;
    lastError?: string | null;
}

interface TestResult { ok: boolean; latencyMs?: number; error?: string }

const ENGINES: { value: Engine; label: string; note?: string }[] = [
    { value: 'POSTGRES', label: 'PostgreSQL' },
    { value: 'MYSQL', label: 'MySQL', note: 'coming soon' },
    { value: 'SQLSERVER', label: 'SQL Server', note: 'coming soon' },
];

const getErr = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
    ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    ?? fallback;

export function DataStorageConfig({ institutionId }: { institutionId: string }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);

    const [mode, setMode] = useState<Mode>('MANAGED');
    const [engine, setEngine] = useState<Engine>('POSTGRES');
    const [host, setHost] = useState('');
    const [port, setPort] = useState('5432');
    const [databaseName, setDatabaseName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [sslMode, setSslMode] = useState('require');
    const [hasPassword, setHasPassword] = useState(false);
    const [status, setStatus] = useState<string>('PENDING');
    const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await api.get(`/superadmin/institutions/${institutionId}/db-config`);
                if (!active) return;
                const c: DbConfig = res.data.data;
                setMode(c.mode ?? 'MANAGED');
                if (c.engine) setEngine(c.engine);
                setHost(c.host ?? '');
                setPort(c.port ? String(c.port) : '5432');
                setDatabaseName(c.databaseName ?? '');
                setUsername(c.username ?? '');
                setHasPassword(!!c.hasPassword);
                setSslMode(c.sslMode ?? 'require');
                setStatus(c.status ?? 'PENDING');
                setLastTestedAt(c.lastTestedAt ?? null);
                setLastError(c.lastError ?? null);
            } catch {
                // non-blocking
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [institutionId]);

    const draftBody = () => ({
        mode,
        engine,
        host: host.trim(),
        port: Number(port),
        databaseName: databaseName.trim(),
        username: username.trim(),
        ...(password ? { password } : {}),
        sslMode,
    });

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await api.post(`/superadmin/institutions/${institutionId}/db-config/test`, draftBody());
            setTestResult(res.data.data as TestResult);
            if (res.data.data?.ok) toast.success('Connection successful'); else toast.error('Connection failed');
        } catch (e) {
            const msg = getErr(e, 'Connection test failed');
            setTestResult({ ok: false, error: msg });
            toast.error(msg);
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const body = mode === 'MANAGED' ? { mode: 'MANAGED' } : draftBody();
            const res = await api.put(`/superadmin/institutions/${institutionId}/db-config`, body);
            const c = res.data.data as DbConfig & { test?: TestResult };
            setStatus(c.status ?? 'PENDING');
            setLastTestedAt(c.lastTestedAt ?? null);
            setLastError(c.lastError ?? null);
            setHasPassword(!!c.hasPassword);
            setPassword('');
            if (mode === 'BYOD' && c.status === 'FAILED') {
                toast.error('Saved, but the connection test failed — check the details.');
            } else {
                toast.success('Data storage configuration saved');
            }
        } catch (e) {
            toast.error(getErr(e, 'Failed to save configuration'));
        } finally {
            setSaving(false);
        }
    };

    const statusBadge = () => {
        const map: Record<string, { cls: string; label: string; Icon: React.ElementType }> = {
            CONNECTED: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400', label: 'Connected', Icon: CheckCircle2 },
            FAILED: { cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', label: 'Failed', Icon: XCircle },
            PENDING: { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', label: 'Not tested', Icon: PlugZap },
        };
        const s = map[status] ?? map.PENDING;
        return (
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
                <s.Icon size={11} /> {s.label}
            </span>
        );
    };

    const inputCls = 'w-full h-9 px-3 rounded-lg border border-border bg-muted/40 text-sm focus:outline-none focus:border-primary/50';

    return (
        <div className="bg-card border border-border/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <Database size={15} className="text-muted-foreground" />
                    <h3 className="text-sm font-bold">Data Storage Configuration</h3>
                </div>
                {mode === 'BYOD' && statusBadge()}
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
                Choose where this institution&apos;s academic data is stored. Credentials are encrypted and never shown again.
            </p>

            {loading ? (
                <div className="h-24 rounded-xl bg-muted/40 animate-pulse" />
            ) : (
                <>
                    {/* Mode selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                        <button
                            onClick={() => setMode('MANAGED')}
                            className={`text-left p-3.5 rounded-xl border-2 transition-all ${mode === 'MANAGED' ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <HardDrive size={14} className={mode === 'MANAGED' ? 'text-primary' : 'text-muted-foreground'} />
                                <p className={`text-xs font-bold ${mode === 'MANAGED' ? 'text-primary' : ''}`}>QubeEx Managed</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Data stored on QubeEx&apos;s database (default).</p>
                        </button>
                        <button
                            onClick={() => setMode('BYOD')}
                            className={`text-left p-3.5 rounded-xl border-2 transition-all ${mode === 'BYOD' ? 'border-[#DA7756] bg-[#DA7756]/5' : 'border-border/50 hover:border-border'}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Database size={14} className={mode === 'BYOD' ? 'text-[#DA7756]' : 'text-muted-foreground'} />
                                <p className={`text-xs font-bold ${mode === 'BYOD' ? 'text-[#DA7756]' : ''}`}>Institution-Owned (BYOD)</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Academic data stored in the institution&apos;s own database.</p>
                        </button>
                    </div>

                    {mode === 'BYOD' && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Database Engine</label>
                                    <select value={engine} onChange={e => setEngine(e.target.value as Engine)} className={inputCls}>
                                        {ENGINES.map(en => (
                                            <option key={en.value} value={en.value}>{en.label}{en.note ? ` (${en.note})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">SSL / TLS</label>
                                    <select value={sslMode} onChange={e => setSslMode(e.target.value)} className={inputCls}>
                                        <option value="disable">Disable</option>
                                        <option value="require">Require</option>
                                        <option value="verify-full">Verify full</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Host / Server URL</label>
                                    <input value={host} onChange={e => setHost(e.target.value)} placeholder="db.example.com" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Port</label>
                                    <input value={port} onChange={e => setPort(e.target.value.replace(/[^0-9]/g, ''))} placeholder="5432" className={inputCls} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Database Name</label>
                                    <input value={databaseName} onChange={e => setDatabaseName(e.target.value)} placeholder="institution_db" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Username</label>
                                    <input value={username} onChange={e => setUsername(e.target.value)} placeholder="db_user" className={inputCls} autoComplete="off" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                                    Password {hasPassword && <span className="text-[10px] text-muted-foreground font-normal">— leave blank to keep the saved one</span>}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder={hasPassword ? '•••••••• (saved)' : 'Database password'}
                                    className={inputCls}
                                    autoComplete="new-password"
                                />
                            </div>

                            {testResult && (
                                <div className={`text-[11px] rounded-lg px-3 py-2 ${testResult.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                                    {testResult.ok ? `✓ Connected${testResult.latencyMs != null ? ` in ${testResult.latencyMs}ms` : ''}` : `✗ ${testResult.error ?? 'Connection failed'}`}
                                </div>
                            )}
                            {!testResult && status === 'FAILED' && lastError && (
                                <div className="text-[11px] rounded-lg px-3 py-2 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">✗ {lastError}</div>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    onClick={handleTest}
                                    disabled={testing}
                                    className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400 hover:opacity-80 transition-all disabled:opacity-50"
                                >
                                    {testing ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
                                    Test Connection
                                </button>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <ShieldCheck size={11} /> Encrypted at rest
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Save */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">
                            {lastTestedAt ? `Last tested ${new Date(lastTestedAt).toLocaleString('en-IN')}` : 'Not tested yet'}
                        </span>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 h-9 px-5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                            Save Configuration
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
