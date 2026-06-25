'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Eye, EyeOff, ShieldCheck, CheckCircle2, XCircle, Lock } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/store/authStore';

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

export default function StudentSetPasswordPage() {
    const router = useRouter();
    const { user, setUser } = useAuthStore();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    // Redirect away if password is already set
    useEffect(() => {
        if (user && user.mustChangePassword === false) {
            router.replace('/student/overview');
        }
    }, [user, router]);

    const strength = getStrength(password);
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
    const allRulesPassed = RULES.every(r => r.test(password));
    const canSubmit = allRulesPassed && passwordsMatch && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            await api.post('/auth/student/set-initial-password', { newPassword: password });
            // Update local auth state so mustChangePassword is cleared
            if (user) setUser({ ...user, mustChangePassword: false });
            setDone(true);
            setTimeout(() => router.replace('/student/overview'), 2000);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Failed to set password. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0A1E' }}>
                <div className="fixed inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-15"
                        style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }} />
                </div>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                        className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={36} className="text-emerald-400" />
                    </motion.div>
                    <h1 className="text-2xl font-bold text-white mb-2">Password Set!</h1>
                    <p className="text-white/50 text-sm">Taking you to your dashboard…</p>
                    <div className="mt-6 w-48 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
                        <motion.div className="h-full bg-emerald-500 rounded-full"
                            initial={{ width: 0 }} animate={{ width: '100%' }}
                            transition={{ duration: 1.8, ease: 'linear' }} />
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#0F0A1E' }}>
            <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 8 }}>
                <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #7C3AED, transparent 70%)' }} />
                <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full opacity-15"
                    style={{ background: 'radial-gradient(circle, #6EE7B7, transparent 70%)' }} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="relative w-full max-w-md"
                style={{ zIndex: 20 }}
            >
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={28} className="text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Set Your Password</h1>
                    <p className="text-sm text-white/50 mt-1">
                        {user?.name ? `Welcome, ${user.name}!` : 'Welcome!'} Create a secure password to activate your account.
                    </p>
                </div>

                <div className="h-[2px] w-full mb-0"
                    style={{ background: 'linear-gradient(90deg, transparent, #6EE7B7, #7C3AED, transparent)' }} />
                <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">

                    {/* New Password */}
                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-white/60 mb-2">
                            New Password <span className="text-emerald-400">*</span>
                        </label>
                        <div className="relative">
                            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Create a strong password"
                                className="w-full h-11 pl-10 pr-10 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#7C3AED]/60 transition-all"
                            />
                            <button onClick={() => setShowPassword(v => !v)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        {password.length > 0 && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2.5 space-y-2">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                                            style={{ background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.08)' }} />
                                    ))}
                                </div>
                                <p className="text-[11px] font-medium" style={{ color: strength.color }}>{strength.label}</p>
                            </motion.div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div className="mb-5">
                        <label className="block text-xs font-semibold text-white/60 mb-2">
                            Confirm Password <span className="text-emerald-400">*</span>
                        </label>
                        <div className="relative">
                            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter your password"
                                className={`w-full h-11 pl-10 pr-10 rounded-xl bg-white/5 border text-sm text-white placeholder:text-white/25 focus:outline-none transition-all ${confirmPassword.length > 0
                                    ? passwordsMatch ? 'border-emerald-500/50' : 'border-red-500/50'
                                    : 'border-white/10 focus:border-[#7C3AED]/60'}`}
                            />
                            <button onClick={() => setShowConfirm(v => !v)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        {confirmPassword.length > 0 && (
                            <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                                {passwordsMatch ? <><CheckCircle2 size={11} /> Passwords match</> : <><XCircle size={11} /> Passwords do not match</>}
                            </p>
                        )}
                    </div>

                    {/* Rules */}
                    {password.length > 0 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-1.5 mb-5">
                            {RULES.map(rule => {
                                const passed = rule.test(password);
                                return (
                                    <div key={rule.label} className={`flex items-center gap-1.5 text-[11px] transition-colors ${passed ? 'text-emerald-400' : 'text-white/30'}`}>
                                        {passed ? <CheckCircle2 size={11} className="shrink-0" /> : <XCircle size={11} className="shrink-0" />}
                                        {rule.label}
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="w-full h-12 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{ background: canSubmit ? 'linear-gradient(135deg, #34d399 0%, #10b981 40%, #059669 100%)' : 'rgba(255,255,255,0.08)' }}
                    >
                        {submitting
                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Setting password…</>
                            : <><ShieldCheck size={16} /> Activate My Account</>
                        }
                    </button>
                </div>

                <p className="text-center text-xs text-white/20 mt-6">
                    QubeEx Student Portal · Your account is secured
                </p>
            </motion.div>
        </div>
    );
}
