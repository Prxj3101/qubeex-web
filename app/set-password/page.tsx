'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck, CheckCircle2, XCircle, Lock, Hash, Building2, User, Mail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { CursorWave } from '@/components/auth/CursorWave';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';

// ─── Password strength checker ───────────────────────────────────────────────

function getStrength(pw: string): { score: number; label: string; color: string } {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
    if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' };
    if (score <= 3) return { score, label: 'Good', color: '#3b82f6' };
    return { score, label: 'Strong', color: '#10b981' };
}

const RULES = [
    { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
    { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'One number', test: (pw: string) => /[0-9]/.test(pw) },
    { label: 'One special character', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
];

// ─── Token data type ─────────────────────────────────────────────────────────

type TokenData = {
    institutionName: string;
    institutionCode: string;
    adminName: string;
    email: string;
    userId?: string;
    valid: boolean;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

function SetPasswordContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [tokenData, setTokenData] = useState<TokenData | null>(null);
    const [tokenLoading, setTokenLoading] = useState(true);
    const [tokenExpired, setTokenExpired] = useState(false);

    const [instituteId, setInstituteId] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    // Verify token on mount, then autofill institution code
    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setTokenExpired(true);
                setTokenLoading(false);
                return;
            }
            try {
                const res = await api.get(`/auth/verify-invite?token=${token}`);
                const data: TokenData = res.data.data;
                setTokenData(data);
                // Autofill institution code — admin just verifies
                if (data.institutionCode) setInstituteId(data.institutionCode);
            } catch {
                setTokenExpired(true);
            } finally {
                setTokenLoading(false);
            }
        };
        verify();
    }, [token]);

    const strength = getStrength(password);
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
    const allRulesPassed = RULES.every(r => r.test(password));
    const canSubmit = allRulesPassed && passwordsMatch && instituteId.trim().length > 0 && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            await api.post('/auth/set-password', {
                token,
                instituteId: instituteId.trim(),
                password,
            });
            setDone(true);
            setTimeout(() => router.push('/login'), 2500);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to set password. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    // ── Loading ──
    if (tokenLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0A1E' }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
                    <p className="text-sm text-white/50">Verifying invite link…</p>
                </div>
            </div>
        );
    }

    // ── Expired / Invalid ──
    if (tokenExpired || !tokenData?.valid) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0F0A1E' }}>
                {/* bg blobs */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #ef4444, transparent 70%)' }} />
                </div>

                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="relative w-full max-w-md text-center">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 lg:p-10 backdrop-blur-xl">
                        <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                            <AlertTriangle size={28} className="text-red-400" />
                        </div>
                        <h1 className="text-lg lg:text-xl font-bold text-white mb-2">Link Expired</h1>
                        <p className="text-sm text-white/50 leading-relaxed">
                            This invite link is no longer valid. Invite links expire after <span className="text-white/70 font-medium">1 hour</span> for security reasons.
                        </p>
                        <p className="text-sm text-white/40 mt-3">
                            Please contact your QubeEx administrator to resend the invite.
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ── Success ──
    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0F0A1E' }}>
                <div className="fixed inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-15"
                        style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }} />
                </div>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="text-center">
                    <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                        className="w-16 h-16 lg:w-20 lg:h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={36} className="text-emerald-400" />
                    </motion.div>
                    <h1 className="text-xl lg:text-2xl font-bold text-white mb-2">Password Set!</h1>
                    <p className="text-white/50 text-sm">Redirecting you to login…</p>
                    <div className="mt-6 w-48 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
                        <motion.div className="h-full bg-emerald-500 rounded-full"
                            initial={{ width: 0 }} animate={{ width: '100%' }}
                            transition={{ duration: 2.3, ease: 'linear' }} />
                    </div>
                </motion.div>
            </div>
        );
    }

    // ── Main Form ──
    return (
        <div className="h-screen overflow-hidden flex items-center justify-center px-4" style={{ background: '#0F0A1E' }}>
            <CursorWave />
            {/* Background effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 8 }}>
                <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #7C3AED, transparent 70%)' }} />
                <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full opacity-15"
                    style={{ background: 'radial-gradient(circle, #DA7756, transparent 70%)' }} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="relative w-full max-w-md flex flex-col"
                style={{ zIndex: 20, maxHeight: '92vh' }}
            >
                {/* Logo + Brand — fixed outside card */}
                <div className="text-center mb-5 shrink-0">
                    <div className="flex flex-col items-center gap-2 mb-3">
                        <img
                            src="/QubeEx_darkmode_DA7756.png"
                            alt="QubeEx Logo"
                            style={{ width: 'auto', height: '52px' }}
                            className="rounded-md"
                        />
                        <span className="text-xl lg:text-[26px] font-bold text-[#FAE5D9]" style={{ fontFamily: 'var(--font-poppins)' }}>
                            QubeEx
                        </span>
                    </div>
                    <h1 className="text-base lg:text-[18px] font-bold text-white">Set Your Password</h1>
                    <p className="text-xs text-white/50 mt-1">Complete your Admin account setup to get started</p>
                </div>

                {/* Top accent line */}
                <div className="h-[2px] w-full shrink-0"
                    style={{ background: 'linear-gradient(90deg, transparent, #7C3AED, #DA7756, transparent)' }} />

                {/* Card — fixed size, inner content scrolls */}
                <div className="bg-white/[0.04] border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col min-h-0 flex-1 overflow-hidden">
                    <div className="overflow-y-auto flex-1 px-4 lg:px-6 pt-6"
                        style={{ scrollbarWidth: 'none' }}>

                        {/* Institution Info — read only */}
                        <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 mb-6 space-y-3">
                            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">Your Account Details</p>
                            {[
                                { icon: Building2, label: 'Institution', value: tokenData.institutionName },
                                { icon: User, label: 'Your Name', value: tokenData.adminName },
                                { icon: Mail, label: 'Email', value: tokenData.email },
                            ].map(({ icon: Icon, label, value }) => (
                                <div key={label} className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                        <Icon size={13} className="text-white/40" />
                                    </div>
                                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                        <span className="text-xs text-white/40 shrink-0">{label}</span>
                                        <span className="text-xs font-medium text-white/80 truncate text-right">{value}</span>
                                    </div>
                                </div>
                            ))}

                            {/* Institution ID highlight */}
                            <div className="mt-3 pt-3 border-t border-white/8">
                                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Institution ID</p>
                                <p className="text-lg font-bold tracking-widest font-mono" style={{ color: '#DA7756' }}>
                                    {tokenData.institutionCode ?? ''}
                                </p>
                            </div>

                            {/* Admin ID highlight */}
                            <div className="mt-3 pt-3 border-t border-white/8">
                                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Admin ID</p>
                                <p className="text-lg font-bold tracking-widest font-mono" style={{ color: '#DA7756' }}>
                                    {tokenData.userId ?? ''}
                                </p>
                                <p className="text-[10px] text-white/30 mt-1">This has been pre-filled below. Keep it safe for future logins.</p>
                            </div>
                        </div>

                        {/* Admin ID — pre-filled, read-only */}
                        <div className="mb-5">
                            <label className="block text-xs font-semibold text-white/60 mb-2">
                                Admin ID <span className="text-[#DA7756]">*</span>
                            </label>
                            <div className="relative">
                                <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                <input
                                    type="text"
                                    value={tokenData.userId ?? ''}
                                    readOnly
                                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#DA7756]/8 border border-[#DA7756]/30 text-sm font-mono font-semibold tracking-wider text-[#DA7756] focus:outline-none cursor-default select-all"
                                />
                            </div>
                            <p className="text-[11px] text-white/30 mt-1.5 flex items-center gap-1">
                                <ShieldCheck size={11} />
                                Auto-filled from your invite — use this to log in after setup
                            </p>
                        </div>

                        {/* New Password */}
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-white/60 mb-2">
                                New Password <span className="text-[#DA7756]">*</span>
                            </label>
                            <div className="relative">
                                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Create a strong password"
                                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#7C3AED]/60 focus:bg-white/8 transition-all"
                                />
                                <button onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>

                            {/* Strength bar */}
                            {password.length > 0 && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-2.5 space-y-2">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                                                style={{ background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.08)' }} />
                                        ))}
                                    </div>
                                    <p className="text-[11px] font-medium" style={{ color: strength.color }}>
                                        {strength.label}
                                    </p>
                                </motion.div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div className="mb-5">
                            <label className="block text-xs font-semibold text-white/60 mb-2">
                                Confirm Password <span className="text-[#DA7756]">*</span>
                            </label>
                            <div className="relative">
                                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter your password"
                                    className={`w-full h-11 pl-10 pr-10 rounded-xl bg-white/5 border text-sm text-white placeholder:text-white/25 focus:outline-none focus:bg-white/8 transition-all ${confirmPassword.length > 0
                                        ? passwordsMatch
                                            ? 'border-emerald-500/50 focus:border-emerald-500/70'
                                            : 'border-red-500/50 focus:border-red-500/70'
                                        : 'border-white/10 focus:border-[#7C3AED]/60'
                                        }`}
                                />
                                <button onClick={() => setShowConfirm(v => !v)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            {confirmPassword.length > 0 && (
                                <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {passwordsMatch
                                        ? <><CheckCircle2 size={11} /> Passwords match</>
                                        : <><XCircle size={11} /> Passwords do not match</>
                                    }
                                </p>
                            )}
                        </div>

                        {/* Password rules */}
                        {password.length > 0 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-5">
                                {RULES.map(rule => {
                                    const passed = rule.test(password);
                                    return (
                                        <div key={rule.label} className={`flex items-center gap-1.5 text-[11px] transition-colors ${passed ? 'text-emerald-400' : 'text-white/30'}`}>
                                            {passed
                                                ? <CheckCircle2 size={11} className="shrink-0" />
                                                : <XCircle size={11} className="shrink-0" />
                                            }
                                            {rule.label}
                                        </div>
                                    );
                                })}
                            </motion.div>
                        )}

                    </div>

                    {/* Fixed bottom — submit + footer */}
                    <div className="shrink-0 px-4 lg:px-6 pb-6 pt-4 border-t border-white/8">
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="w-full h-12 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{ background: canSubmit ? 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' : 'rgba(255,255,255,0.08)' }}
                        >
                            {submitting
                                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Setting password…</>
                                : <><ShieldCheck size={16} /> Set Password & Continue</>
                            }
                        </button>
                        <p className="text-center text-xs text-white/20 mt-4">
                            Having trouble? Contact your QubeEx representative.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default function SetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0A1E' }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
                    <p className="text-sm text-white/50">Loading...</p>
                </div>
            </div>
        }>
            <SetPasswordContent />
        </Suspense>
    );
}
