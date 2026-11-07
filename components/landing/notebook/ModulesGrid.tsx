'use client';

import { motion } from 'framer-motion';
import {
    BarChart3, Banknote, Bot, Bus, CalendarCheck, ClipboardList, FileText, LayoutGrid, MessagesSquare, Package, PenLine,
    Presentation, Sparkles, UserCog, Users, Video, Wallet, type LucideIcon,
} from 'lucide-react';
import { DISPLAY, EASE } from '../motion';
import { HAND, INK, TERRA } from './paper';
import { GoldSheen } from './BusRoute';

// The feature list, ERP style: 16 areas (4 x 4), each with its main pieces
// as bullets. Names only, no how-it-works details.

// secret: exclusive feature - golden card that keeps what's inside a surprise (see it in a demo)
type Area = { icon: LucideIcon; name: string; points: string[]; color: string; soft: string; secret?: boolean };

const AREAS: Area[] = [
    { icon: ClipboardList, name: 'Admissions', color: '#0EA5E9', soft: '#E3F4FC',
        points: ['Complete journey, enquiry to enrolment', 'Online admission portal', 'Application board', 'Custom admission forms'] },
    { icon: Users, name: 'Student management', color: '#2563EB', soft: '#E8F0FE',
        points: ['Student profiles & records', 'Classes & divisions', 'Courses & subjects', 'Student notes & flags'] },
    { icon: CalendarCheck, name: 'Attendance', color: '#0D9488', soft: '#E3F5F2',
        points: ['One-tap daily attendance', 'Authentic attendance sheet', 'Export to Excel', 'Long-absence alerts'] },
    { icon: Wallet, name: 'Fees management', color: TERRA, soft: '#FBEDE6',
        points: ['Online payment gateway', 'Fee structures', 'Instant receipts', 'Dues & reminders', 'AI fee forecast'] },
    { icon: FileText, name: 'Exams & report cards', color: '#DB2777', soft: '#FCEAF3',
        points: ['Marks entry', 'Marksheets', 'Report cards', 'Progress tracking'] },
    { icon: PenLine, name: 'AI tests & assignments', color: '#C026D3', soft: '#FAE8FB',
        points: ['Online tests', 'Anti-cheating with tab-switch detection', 'AI question papers', 'Assignments & course material'] },
    { icon: LayoutGrid, name: 'AI timetable scheduling', color: '#7C3AED', soft: '#F0EAFD',
        points: ['Whole-school timetable in one click', 'Rules in plain words', 'Clash-free, every time', 'Absent-teacher cover'] },
    { icon: Presentation, name: 'AI Blackboard', color: '#B8860B', soft: '#FFF4CC', points: [], secret: true },
    { icon: Video, name: 'Online classes', color: '#2563EB', soft: '#E8F0FE',
        points: ['Live online classes', 'Google Meet integration', 'Class links shared with students'] },
    { icon: Bot, name: 'Jarvis AI', color: '#E11D48', soft: '#FDE8EC',
        points: ['Ask anything in plain words', 'Schedules whatever you tell it', 'Smart reminders & alerts'] },
    { icon: BarChart3, name: 'AI analytics & insights', color: '#4F46E5', soft: '#ECEBFD',
        points: ['School health score', 'Attendance, fee & result trends', 'Live dashboards', 'Exportable reports'] },
    { icon: UserCog, name: 'Staff management', color: '#475569', soft: '#EEF1F5',
        points: ['Teachers & staff', 'Sub-admins & permissions', 'Staff room', 'Full audit logs'] },
    { icon: Banknote, name: 'Payroll', color: '#CA8A04', soft: '#FBF3D9',
        points: ['One-click payroll runs', 'Biometric staff attendance', 'PF, TDS & payslips', 'Payslip updates on email & phone'] },
    { icon: Package, name: 'Inventory', color: '#B45309', soft: '#FCF0E1',
        points: ['Manage & track stock and items', 'Manage purchases', 'Track teacher requests', 'Issue ledger'] },
    { icon: MessagesSquare, name: 'Communication & apps', color: '#0891B2', soft: '#E2F5F9',
        points: ['Updates on email, WhatsApp & SMS', 'Staff rooms & class chatrooms', 'Teacher–parent chat', 'Student, parent & teacher apps'] },
    { icon: Bus, name: 'Transport', color: '#F59E0B', soft: '#FEF3C7',
        points: ['Live GPS bus tracking', 'Routes & stops', 'Parent alerts in the app'] },
];

// Golden "exclusive" card: same size as the others, but what's inside stays a surprise.
function SecretCard({ a }: { a: Area }) {
    return (
        <div
            className="group relative flex h-full flex-col overflow-hidden rounded-2xl border-2 p-5 shadow-[4px_5px_0_rgba(38,41,74,0.85)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[5px_8px_0_rgba(38,41,74,0.85)]"
            style={{ borderColor: '#8A6416', background: 'linear-gradient(140deg, #FFF6D6 0%, #FFE08A 40%, #F5C04A 75%, #E3A92E 100%)' }}
        >
            <GoldSheen />
            {/* ribbon */}
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#4A3405] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[#FFE08A]">
                <Sparkles size={11} />Exclusive
            </span>
            <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-white/70 text-[#8A6416] transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105">
                <a.icon size={23} />
            </span>
            <h3 style={DISPLAY} className="relative mt-4 text-lg font-bold leading-tight text-[#3A2904]">{a.name}</h3>
            {/* what's inside: hidden on purpose */}
            <div className="relative mt-3.5 flex-1 border-t border-dashed border-[#B98A2A]/50 pt-3.5">
                <div className="space-y-2.5" aria-hidden>
                    {[88, 70, 80].map((w, k) => (
                        <div key={k} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#8A6416]/60" />
                            <span className="h-2.5 rounded-full bg-[#8A6416]/20 blur-[1.5px]" style={{ width: `${w}%` }} />
                        </div>
                    ))}
                </div>
                <div className="absolute inset-0 grid place-items-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8A6416]/40 bg-white/85 px-3 py-1.5 text-[12.5px] font-bold text-[#4A3405] shadow-sm">
                        <Sparkles size={13} />See it in a live demo
                    </span>
                </div>
            </div>
            <p style={HAND} className="relative mt-3 text-[19px] leading-tight text-[#5C430B]">only on QubeEx, worth the wait.</p>
        </div>
    );
}

export default function ModulesGrid() {
    return (
        <section id="features" className="relative scroll-mt-6">
            <div className="mx-auto w-full max-w-7xl px-6 py-14 sm:px-10 lg:py-20">
                <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.7, ease: EASE }}
                >
                    <p style={HAND} className="text-2xl text-[#8A6A5A] sm:text-3xl">everything in the bag,</p>
                    <h2 style={DISPLAY} className="mt-1 text-4xl font-bold tracking-[-0.02em] text-[#190D2E] sm:text-6xl">
                        All the features your <span style={{ color: TERRA }}>school needs.</span>
                    </h2>
                    <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-[#575C7A] sm:text-xl">
                        One login for the office, the staff room, the classroom and home.
                    </p>
                </motion.div>

                <ul className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {AREAS.map((a, i) => (
                        <motion.li
                            key={a.name}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ duration: 0.5, ease: EASE, delay: (i % 4) * 0.06 }}
                        >
                            {a.secret ? <SecretCard a={a} /> : <div
                                className="group relative flex h-full flex-col rounded-2xl border-2 bg-white p-5 shadow-[4px_5px_0_rgba(38,41,74,0.85)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[5px_8px_0_rgba(38,41,74,0.85)]"
                                style={{ borderColor: INK }}
                            >
                                <span
                                    className="grid h-12 w-12 place-items-center rounded-xl transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105"
                                    style={{ background: a.soft, color: a.color }}
                                >
                                    <a.icon size={23} />
                                </span>
                                <h3 style={DISPLAY} className="mt-4 text-lg font-bold leading-tight text-[#190D2E]">{a.name}</h3>
                                <ul className="mt-3.5 space-y-1.5 border-t border-dashed border-[#E3DCCF] pt-3.5">
                                    {a.points.map((p) => (
                                        <li key={p} className="flex items-start gap-2 text-[14px] leading-snug text-[#2E2A3A]">
                                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.color }} />
                                            {p}
                                        </li>
                                    ))}
                                </ul>
                            </div>}
                        </motion.li>
                    ))}
                </ul>

                <p style={HAND} className="mt-10 text-center text-2xl text-[#8A6A5A]">
                    ...and more on the way.
                </p>
            </div>
        </section>
    );
}
