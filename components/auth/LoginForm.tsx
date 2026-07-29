'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { CursorWave } from '@/components/auth/CursorWave';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Eye, EyeOff, LogIn, AtSign, Lock, ChevronRight } from 'lucide-react';

// ─── Role based redirect ──────────────────────────────────────────────────────

const ROLE_REDIRECT: Record<string, string> = {
    SUPER_ADMIN: '/superadmin/overview',
    ADMIN: '/admin/overview',
    SUB_ADMIN: '/admin/overview',
    TEACHER: '/teacher/overview',
    STUDENT: '/student/overview',
};




// ─── Main Component ───────────────────────────────────────────────────────────

export function LoginForm() {
    const router = useRouter();
    const { setAuth } = useAuthStore();

    const [identifier, setIdentifier] = useState('');
    // Tracks the identifier exactly as the user typed it (original casing),
    // so that backspacing past the ID pattern (e.g. deleting the "-0" back
    // off "SKPS-0") reverts the display to the original as-typed casing
    // instead of staying stuck uppercase.
    const [rawIdentifier, setRawIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState<'id' | 'pw' | null>(null);

    // ─── Floating particles background ───────────────────────────────────────────

    const [particles, setParticles] = useState<{
        id: number; x: number; y: number; size: number;
        opacity: number; duration: number; delay: number;
    }[]>([]);

    useEffect(() => {
        setParticles(Array.from({ length: 18 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 3 + 1,
            opacity: Math.random() * 0.15 + 0.05,
            duration: Math.random() * 8 + 6,
            delay: Math.random() * 4,
        })));
    }, []);

    // Detect if identifier is email or ID
    const isEmail = identifier.includes('@');

    // Once the user has typed a 4-letter institution code, a dash, and started
    // the next segment with a digit (e.g. "SKPS-0..."), we're confident it's an
    // ID (not an email) — from that point on, force-uppercase everything so
    // users never have to hit caps lock to type IDs like SKPS-01A2-0001.
    const ID_DETECT_RE = /^[A-Za-z]{4}-\d/;
    const handleIdentifierChange = (newDisplayed: string) => {
        // Reconstruct the as-typed (raw) string: for an append, the newly
        // typed tail arrives in its natural case (our transform hasn't run
        // on it yet); for a deletion, just truncate the existing raw value
        // to match — this preserves original casing so removing the "-0"
        // reverts display back to whatever was typed before it.
        const newRaw = newDisplayed.length >= rawIdentifier.length
            ? rawIdentifier + newDisplayed.slice(rawIdentifier.length)
            : rawIdentifier.slice(0, newDisplayed.length);
        setRawIdentifier(newRaw);
        setIdentifier(ID_DETECT_RE.test(newRaw) ? newRaw.toUpperCase() : newRaw);
    };

    const canSubmit = identifier.trim().length > 0 && password.length >= 1 && !loading;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        try {
            const res = await api.post('/auth/login', {
                email: identifier.trim(),
                password,
            });
            const { token, user, institution } = res.data.data;
            // The institution type actually lives on `institution.type`, not
            // `user.institutionType` (that field is rarely populated for any
            // role). setAuth's cookie-write only fires off `institutionType`
            // on the user object, so merge it in here — this is what makes
            // the login-time theme write (School violet vs College blue)
            // actually work for EVERY role, teacher included, not just admin.
            // Uppercased defensively — isInstType() only matches
            // 'SCHOOL'|'COLLEGE'|'COACHING' exactly, and we don't want a
            // lowercase 'college' from the API to silently fail that check
            // and fall back to the School theme.
            const rawInstType = institution?.type ?? user.institutionType ?? null;
            const normalizedInstType = typeof rawInstType === 'string' ? rawInstType.toUpperCase() : rawInstType;
            setAuth({ ...user, institutionType: normalizedInstType, permissions: user.permissions ?? null }, token);

            const subStatus = institution?.subscriptionStatus;
            const instStatus = institution?.status;

            if (instStatus === 'SUSPENDED' || subStatus === 'EXPIRED' || subStatus === 'LOCKED') {
                router.push('/suspended');
                return;
            }

            if (user.role === 'STUDENT' && user.mustChangePassword) {
                toast.success(`Welcome, ${user.name || 'Student'}! Please set your password to continue.`);
                router.push('/student/set-password');
                return;
            }

            toast.success(`Welcome back, ${user.name || user.email}!`);
            router.push(ROLE_REDIRECT[user.role] || '/login');
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Invalid credentials'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0B0B0F' }}>

            {/* ── Background ── */}
            <CursorWave />

            <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 15 }}>
                {/* Gradient blobs */}
                <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle at 30% 30%, #71717A, transparent 60%)', transform: 'translate(-30%, -30%)' }} />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-15"
                    style={{ background: 'radial-gradient(circle at 70% 70%, #DA7756, transparent 60%)', transform: 'translate(20%, 20%)' }} />
                <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full opacity-8"
                    style={{ background: 'radial-gradient(circle, #71717A40, transparent 70%)', transform: 'translate(-50%, -50%)' }} />

                {/* Floating particles */}
                {particles.map(p => (
                    <motion.div key={p.id}
                        className="absolute rounded-full bg-white"
                        style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            width: p.size,
                            height: p.size,
                            opacity: p.opacity,
                        }}
                        animate={{ y: [0, -24, 0], opacity: [p.opacity, p.opacity * 2.5, p.opacity] }}
                        transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
                    />
                ))}
            </div>

            {/* ── Card ── */}
            <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full max-w-[420px]"
                style={{ zIndex: 20 }}
            >
                {/* Glow behind card */}
                <div className="absolute inset-0 rounded-3xl opacity-30 blur-2xl -z-10"
                    style={{ background: 'linear-gradient(135deg, #71717A40, #DA775640)' }} />

                <div className="relative bg-white/[0.04] border border-white/[0.09] rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl">

                    {/* Top accent line */}
                    <div className="h-[2px] w-full"
                        style={{ background: 'linear-gradient(90deg, transparent 0%, #7C3AED 33%, #6946EB 40%, #5652EA 44%, #425EE8 48%, #2F6AE6 52%, #5A6DC2 56%, #85719E 60%, #AF747A 63%, #DA7756 66%, transparent 100%)' }} />

                    <div className="px-5 sm:px-8 pt-8 pb-9">

                        {/* Logo */}
                        <motion.div
                            initial={{ opacity: 0, y: -12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.4 }}
                            className="flex flex-col items-center mb-8"
                        >
                            <div className="flex flex-col items-center gap-2 mb-4">
                                <img
                                    src="/QubeEx_darkmode_DA7756.png"
                                    alt="QubeEx Logo"
                                    style={{ width: 'auto', height: '60px' }}
                                    className="rounded-md"
                                />
                                <span className="text-[30px] font-bold text-[#FAE5D9]" style={{ fontFamily: 'var(--font-poppins)' }}>
                                    QubeEx
                                </span>
                            </div>
                            <p className="text-sm text-white/40 -mt-4">Sign in to your account</p>
                        </motion.div>

                        {/* Form */}
                        <motion.form
                            onSubmit={handleSubmit}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.25, duration: 0.4 }}
                            className="space-y-4"
                        >
                            {/* Identifier field */}
                            <div>
                                <label className="block text-xs font-semibold text-white/50 mb-2 tracking-wide uppercase">
                                    Email or ID
                                </label>
                                <div className={`relative flex items-center rounded-xl border transition-all duration-200 ${focused === 'id'
                                    ? 'border-[#71717A]/70 bg-[#71717A]/8 shadow-[0_0_0_3px_#71717A18]'
                                    : 'border-white/10 bg-white/[0.04] hover:border-white/20'
                                    }`}>
                                    <AtSign size={15} className={`absolute left-3.5 transition-colors duration-200 ${focused === 'id' ? 'text-[#71717A]' : 'text-white/25'}`} />
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={e => handleIdentifierChange(e.target.value)}
                                        onFocus={() => setFocused('id')}
                                        onBlur={() => setFocused(null)}
                                        placeholder="you@example.com or INST-0001"
                                        className="w-full h-12 pl-10 pr-4 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
                                        autoComplete="username"
                                    />
                                    {/* Email/ID badge */}
                                    {identifier.length > 0 && (
                                        <span className={`absolute right-3 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isEmail
                                            ? 'bg-[#71717A]/15 text-[#A1A1AA]'
                                            : 'bg-[#DA7756]/15 text-[#DA7756]'
                                            }`}>
                                            {isEmail ? 'EMAIL' : 'ID'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Password field */}
                            <div>
                                <label className="block text-xs font-semibold text-white/50 mb-2 tracking-wide uppercase">
                                    Password
                                </label>
                                <div className={`relative flex items-center rounded-xl border transition-all duration-200 ${focused === 'pw'
                                    ? 'border-[#71717A]/70 bg-[#71717A]/8 shadow-[0_0_0_3px_#71717A18]'
                                    : 'border-white/10 bg-white/[0.04] hover:border-white/20'
                                    }`}>
                                    <Lock size={15} className={`absolute left-3.5 transition-colors duration-200 ${focused === 'pw' ? 'text-[#71717A]' : 'text-white/25'}`} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onFocus={() => setFocused('pw')}
                                        onBlur={() => setFocused(null)}
                                        placeholder="••••••••••"
                                        className="w-full h-12 pl-10 pr-11 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3.5 text-white/25 hover:text-white/60 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={!canSubmit}
                                    suppressHydrationWarning
                                    className="relative w-full h-12 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed group"
                                    style={{ background: canSubmit ? 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' : 'rgba(255,255,255,0.06)' }}
                                >
                                    {/* Shimmer on hover */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)', transform: 'translateX(-100%)', animation: 'shimmer 1.5s infinite' }} />

                                    <span className="relative flex items-center justify-center gap-2">
                                        {loading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Signing in…
                                            </>
                                        ) : (
                                            <>
                                                <LogIn size={16} />
                                                Sign In
                                                <ChevronRight size={14} className="opacity-60 group-hover:translate-x-0.5 transition-transform" />
                                            </>
                                        )}
                                    </span>
                                </button>
                            </div>
                        </motion.form>

                        {/* Footer hint */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-center text-[11px] text-white/20 mt-6"
                        >
                            Forgot your credentials? Contact your administrator.
                        </motion.p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
