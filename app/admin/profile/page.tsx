'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Mail, Calendar, Phone, MapPin, User,
  Hash, Globe, BookOpen, School, GraduationCap,
  Users, Zap, FileText, CheckCircle, ShieldCheck,
  Pencil, X, Check, Camera, ChevronRight, Info,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useUserAvatarStore } from '@/store/userAvatarStore';
import { useUserTitleStore } from '@/store/userTitleStore';
import { formatDisplayName } from '@/lib/displayName';
import NextImage from 'next/image';

// ── Types ─────────────────────────────────────────────────────────────────────
type AdminUser = {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  prefix?: string | null;
  title?: string | null;
  displayId?: string | null;
};

type InstData = {
  id: string;
  institutionCode?: string | null;
  name: string;
  email: string;
  type: 'SCHOOL' | 'COLLEGE' | 'COACHING';
  status: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  pincode?: string | null;
  country?: string | null;
  board?: string | null;
  medium?: string | null;
  logoUrl?: string | null;
  establishedOn?: string | null;
  adminPhone?: string | null;
  adminDob?: string | null;
  adminGender?: string | null;
  adminPrefix?: string | null;
  adminTitle?: string | null;
  createdAt: string;
  updatedAt: string;
  admin?: AdminUser | null;
  users?: AdminUser[];
  teacherCount?: number;
  studentCount?: number;
  subscription?: {
    plan?: { name: string };
    status?: string;
    activationDate?: string | null;
    planOption?: string | null;
  } | null;
  isTrial?: boolean;
};

// ── Verified Badge ────────────────────────────────────────────────────────────
function VerifiedBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
      <path d="M20 2 L23.5 6.5 L29 5 L31.5 10.5 L37.5 12 L36 18 L40 22 L36 26 L37.5 32 L31.5 33.5 L29 39 L23.5 37.5 L20 42 L16.5 37.5 L11 39 L8.5 33.5 L2.5 32 L4 26 L0 22 L4 18 L2.5 12 L8.5 10.5 L11 5 L16.5 6.5 Z" fill="#DA7756" />
      <path d="M13 21l5 5 9-10" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Phone field helpers ───────────────────────────────────────────────────────
const INST_PHONE_CODES = [
  { code: '+91', flag: '🇮🇳', max: 10 },
  { code: '+1',  flag: '🇺🇸', max: 10 },
  { code: '+44', flag: '🇬🇧', max: 10 },
  { code: '+61', flag: '🇦🇺', max: 9  },
  { code: '+971',flag: '🇦🇪', max: 9  },
  { code: '+65', flag: '🇸🇬', max: 8  },
];

function parseInstPhone(val: string) {
  const match = (val ?? '').match(/^(\+\d+)\s*(.*)$/);
  return match ? { code: match[1], number: match[2] } : { code: '+91', number: val ?? '' };
}

function formatDob(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toIST(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const statusCfg: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
  PENDING: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  SUSPENDED: { label: 'Suspended', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
};

const ADMIN_PREFIX_OPTIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.', 'Er.', 'CA', 'Adv.'];
const ADMIN_TITLE_OPTIONS = ['Principal', 'Vice Principal', 'Head Master', 'Head Mistress', 'Director', 'Admin', 'Dean', 'Rector', 'Superintendent', 'Coordinator', 'Chairman', 'Secretary', 'Trustee'];
const ADMIN_GENDER_OPTIONS = [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }];

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionCard({ title, children, editBtn }: {
  title: React.ReactNode; children: React.ReactNode; editBtn?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/30">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        {editBtn}
      </div>
      <div className="px-5 pt-2 pb-5">{children}</div>
    </div>
  );
}

function PhoneEditField({ value, onChange, label = 'Phone No' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const { code, number } = parseInstPhone(value);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (dropRef.current && dropRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex gap-1.5 flex-1">
        <div className="shrink-0">
          <button ref={btnRef} type="button" onClick={handleToggle}
            className="h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs flex items-center gap-1 whitespace-nowrap hover:bg-primary/10 transition-all">
            {code} <ChevronRight size={10} className="text-muted-foreground rotate-90" />
          </button>
          {open && typeof document !== 'undefined' && createPortal(
            <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.15) transparent' }}
              className="bg-card border border-border rounded-xl shadow-xl py-1 min-w-[130px] max-h-[108px] overflow-y-auto">
              {INST_PHONE_CODES.map((c) => (
                <button key={c.code} type="button"
                  onClick={() => { onChange(`${c.code} ${number}`); setOpen(false); }}
                  className={`w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors ${code === c.code ? 'text-primary font-semibold' : 'text-foreground'}`}>
                  {c.flag} {c.code}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
        <input
          value={number}
          onChange={(e) => {
            const raw = e.target.value;
            const maxDigits = INST_PHONE_CODES.find((c) => c.code === code)?.max ?? 10;
            if (raw.replace(/\D/g, '').length <= maxDigits) onChange(`${code} ${raw}`);
          }}
          placeholder="98765 43210"
          className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 placeholder:font-normal"
        />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-none">
      <Icon size={14} className="text-muted-foreground shrink-0 mt-0.5" />
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground flex-1">{value}</span>
    </div>
  );
}

function EditableField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 placeholder:font-normal"
      />
    </div>
  );
}

function InlineEditActions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex gap-1.5">
      <button onClick={onCancel}
        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:opacity-80 transition-all">
        <X size={11} /> Cancel
      </button>
      <button onClick={onSave}
        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-90 transition-all"
        style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
        <Check size={11} /> Save
      </button>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded-xl ${className ?? ''}`} />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type SubAdminSelfData = {
  id: string;
  name?: string | null;
  email: string;
  displayId?: string | null;
  avatarUrl?: string | null;
  designation?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  qualification?: string | null;
  experience?: string | null;
  createdAt: string;
  isActive: boolean;
};

export default function AdminProfilePage() {
  const { user, setUser } = useAuthStore();
  const isSubAdmin = user?.role === 'SUB_ADMIN';
  const setUserAvatarUrl = useUserAvatarStore(s => s.setAvatarUrl);
  const setUserTitle = useUserTitleStore(s => s.setTitle);
  const setUserPrefix = useUserTitleStore(s => s.setPrefix);
  const [inst, setInst] = useState<InstData | null>(null);
  const [subAdminSelf, setSubAdminSelf] = useState<SubAdminSelfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoErr, setLogoErr] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [logoExpanded, setLogoExpanded] = useState(false);
  const [adminPhotoExpanded, setAdminPhotoExpanded] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [adminAvatarPreview, setAdminAvatarPreview] = useState<string | null>(null);
  const adminAvatarRef = useRef<HTMLInputElement>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    api.get('/admin/me')
      .then((res) => {
        const d = res.data?.data ?? res.data;
        if (d) {
          setInst(d as InstData);
          setCurrentLogoUrl(d.logoUrl ?? null);
          if (!isSubAdmin && d.adminAvatarUrl) {
            setAdminAvatarPreview(d.adminAvatarUrl);
            setUserAvatarUrl(d.adminAvatarUrl);
          }
        }
      })
      .catch(() => { /* non-critical */ })
      .finally(() => setLoading(false));

    if (isSubAdmin) {
      api.get('/admin/subadmin/me')
        .then((res) => {
          const d = res.data?.data ?? res.data;
          if (d) {
            setSubAdminSelf(d as SubAdminSelfData);
            if (d.avatarUrl) {
              setAdminAvatarPreview(d.avatarUrl);
              setUserAvatarUrl(d.avatarUrl);
            }
          }
        })
        .catch(() => { /* non-critical */ });
    }
  }, []);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const editingSectionRef = useRef<string | null>(null);
  editingSectionRef.current = editingSection;

  // Background poll — surfaces superadmin-side institution/admin-detail changes without a
  // manual reload. Skipped while a section is being edited so it can't clobber in-progress input.
  useEffect(() => {
    const poll = setInterval(() => {
      if (editingSectionRef.current) return;
      api.get('/admin/me')
        .then((res) => {
          const d = res.data?.data ?? res.data;
          if (d) setInst(d as InstData);
        })
        .catch(() => {});
      if (isSubAdmin) {
        api.get('/admin/subadmin/me')
          .then((res) => {
            const d = res.data?.data ?? res.data;
            if (d) setSubAdminSelf(d as SubAdminSelfData);
          })
          .catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(poll);
  }, [isSubAdmin]);
  const [instDraft, setInstDraft] = useState({ name: '', email: '', phone: '', board: '', medium: '', establishedOn: '' });
  const [instSaved, setInstSaved] = useState({ name: '', email: '', phone: '', board: '', medium: '', establishedOn: '' });
  const [locDraft, setLocDraft] = useState({ address: '', city: '', state: '', country: '', pincode: '' });
  const [locSaved, setLocSaved] = useState({ address: '', city: '', state: '', country: '', pincode: '' });
  const [adminDraft, setAdminDraft] = useState({ adminName: '', adminPrefix: 'Mr.', adminTitle: 'Admin', adminPhone: '', adminDob: '', adminGender: 'Male' });
  const [adminSaved, setAdminSaved] = useState({ adminName: '', adminPrefix: 'Mr.', adminTitle: 'Admin', adminPhone: '', adminDob: '', adminGender: 'Male' });

  useEffect(() => {
    if (!inst) return;
    const i = { name: inst.name, email: inst.email, phone: inst.phone ?? '', board: inst.board ?? '', medium: inst.medium ?? '', establishedOn: inst.establishedOn ?? '' };
    const l = { address: inst.address ?? '', city: inst.city ?? '', state: inst.state ?? '', country: inst.country ?? '', pincode: inst.pincode ?? '' };
    setInstDraft(i); setInstSaved(i);
    setLocDraft(l); setLocSaved(l);

    if (isSubAdmin) return;
    const adminUser_ = inst.admin ?? inst.users?.find((u) => u.role === 'ADMIN') ?? null;
    const a = {
      adminName: adminUser_?.name ?? adminUser_?.email?.split('@')[0] ?? '',
      adminPrefix: adminUser_?.prefix ?? inst.adminPrefix ?? 'Mr.',
      adminTitle: adminUser_?.title ?? inst.adminTitle ?? 'Admin',
      adminPhone: adminUser_?.phone ?? inst.adminPhone ?? '',
      adminDob: adminUser_?.dob ?? inst.adminDob ?? '',
      adminGender: adminUser_?.gender ?? inst.adminGender ?? 'Male',
    };
    setAdminDraft(a); setAdminSaved(a);
  }, [inst, isSubAdmin]);

  useEffect(() => {
    if (!isSubAdmin || !subAdminSelf) return;
    const a = {
      adminName: subAdminSelf.name ?? subAdminSelf.email.split('@')[0] ?? '',
      adminPrefix: '',
      adminTitle: subAdminSelf.designation ?? '',
      adminPhone: subAdminSelf.phone ?? '',
      adminDob: subAdminSelf.dob ?? '',
      adminGender: subAdminSelf.gender ?? '',
    };
    setAdminDraft(a); setAdminSaved(a);
  }, [subAdminSelf, isSubAdmin]);

  const cancelEdit = (s: string) => {
    if (s === 'inst') setInstDraft({ ...instSaved });
    if (s === 'loc') setLocDraft({ ...locSaved });
    if (s === 'admin') setAdminDraft({ ...adminSaved });
    setEditingSection(null);
  };

  const saveEdit = async (s: string) => {
    try {
      if (s === 'inst') {
        await api.patch('/admin/institution', { name: instDraft.name, email: instDraft.email, phone: instDraft.phone || undefined, board: instDraft.board, medium: instDraft.medium, establishedOn: instDraft.establishedOn || undefined });
        setInstSaved({ ...instDraft });
      }
      if (s === 'loc') {
        await api.patch('/admin/institution', { address: locDraft.address, city: locDraft.city, state: locDraft.state, country: locDraft.country, pincode: locDraft.pincode });
        setLocSaved({ ...locDraft });
      }
      if (s === 'admin') {
        if (isSubAdmin) {
          const res = await api.patch('/admin/subadmin/me', {
            name: adminDraft.adminName || undefined,
            designation: adminDraft.adminTitle || undefined,
            phone: adminDraft.adminPhone || undefined,
            dob: adminDraft.adminDob || undefined,
            gender: adminDraft.adminGender || undefined,
          });
          setSubAdminSelf(prev => prev ? { ...prev, ...res.data.data } : prev);
        } else {
          await api.patch('/admin/me', {
            name: adminDraft.adminName || undefined,
            prefix: adminDraft.adminPrefix || undefined,
            title: adminDraft.adminTitle || undefined,
            phone: adminDraft.adminPhone || undefined,
            dob: adminDraft.adminDob || undefined,
            gender: adminDraft.adminGender || undefined,
          });
          setUserPrefix(adminDraft.adminPrefix || null);
        }
        setAdminSaved({ ...adminDraft });
        setUserTitle(adminDraft.adminTitle || null);
        if (adminDraft.adminName && user && adminDraft.adminName !== user.name) {
          setUser({ ...user, name: adminDraft.adminName });
        }
      }
      setEditingSection(null);
      toast.success('Changes saved');
    } catch {
      toast.error('Failed to save changes');
    }
  };

  const editBtns = (s: string) =>
    editingSection === s ? (
      <InlineEditActions onCancel={() => cancelEdit(s)} onSave={() => saveEdit(s)} />
    ) : (
      <button
        onClick={() => setEditingSection(s)}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
      >
        <Pencil size={11} /> Edit
      </button>
    );

  // ── Logo upload ────────────────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Only PNG, JPG, or WEBP images are allowed');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be 2 MB or smaller');
      return;
    }
    try {
      setLogoUploading(true);
      const uploadRes = await api.post('/admin/institution/logo', file, {
        headers: { 'Content-Type': file.type },
      });
      const newLogoUrl: string = uploadRes.data?.data?.logoUrl;
      setCurrentLogoUrl(newLogoUrl);
      setLogoErr(false);
      toast.success('Logo updated');
    } catch {
      toast.error('Failed to upload logo');
    } finally {
      setLogoUploading(false);
      if (logoFileRef.current) logoFileRef.current.value = '';
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2 pt-0 px-1 pb-2 outline-none">
        <div className="sticky top-0 z-20 bg-background pb-0 shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UserIcon size={21} /> My Profile
          </h1>
          <p className="text-[13px] text-muted-foreground">View and manage your institution profile</p>
          <div className="h-px bg-border/60 mt-2" />
        </div>
        <div className="space-y-4 pt-2">
          <Skeleton className="h-36" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  if (!inst) {
    return (
      <div className="space-y-2 pt-0 px-1 pb-2 outline-none">
        <div className="sticky top-0 z-20 bg-background pb-0 shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UserIcon size={21} /> My Profile
          </h1>
          <div className="h-px bg-border/60 mt-2" />
        </div>
        <p className="text-sm text-muted-foreground pt-6 text-center">Could not load institution data.</p>
      </div>
    );
  }

  const status = statusCfg[inst.status] ?? statusCfg['PENDING'];
  const TypeIcon = inst.type === 'SCHOOL' ? School : inst.type === 'COLLEGE' ? GraduationCap : BookOpen;
  const initials = inst.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const joinDate = toIST(inst.createdAt);
  const planName = inst.isTrial ? 'Trial' : (inst.subscription?.plan?.name ?? inst.subscription?.planOption ?? 'BASIC');
  const instCode = inst.institutionCode ?? null;
  const studentCount = inst.studentCount ?? 0;
  const teacherCount = inst.teacherCount ?? 0;
  const adminUser = inst.admin ?? inst.users?.find((u) => u.role === 'ADMIN') ?? null;
  // profileUser is "whoever is viewing their own profile" — the real admin for
  // an ADMIN viewer, the sub-admin's own record for a SUB_ADMIN viewer. Used
  // for the read-only email/role/joined/active fields in the Admin Info card
  // so a sub-admin never sees the institution admin's account details.
  const profileUser = isSubAdmin
    ? (subAdminSelf ? { email: subAdminSelf.email, role: 'SUB_ADMIN', createdAt: subAdminSelf.createdAt, isActive: subAdminSelf.isActive } : null)
    : adminUser;
  const adminName = isSubAdmin
    ? (subAdminSelf?.name ?? subAdminSelf?.email?.split('@')[0] ?? user?.name ?? '—')
    : formatDisplayName(
        adminUser?.name ?? adminUser?.email?.split('@')[0] ?? user?.name ?? '—',
        adminUser?.prefix ?? inst.adminPrefix
      );
  const myUser = inst.users?.find((u) => u.id === user?.id) ?? null;
  const myDisplayId = myUser?.displayId ?? null;

  return (
    <div className="space-y-2 pt-0 px-1 pb-2 overflow-y-auto h-full">

      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background pb-0 shrink-0">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <UserIcon size={21} /> My Profile
        </h1>
        <p className="text-[13px] text-muted-foreground">View and manage your institution profile</p>
        <div className="h-px bg-border/60 mt-2" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        {/* Hero card */}
        <div className="bg-card border border-border/50 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-muted ring-2 ring-border overflow-hidden flex items-center justify-center cursor-pointer"
                onClick={() => currentLogoUrl && !logoErr ? setLogoExpanded(true) : (!logoUploading && logoFileRef.current?.click())}>
                {currentLogoUrl && !logoErr ? (
                  <img src={currentLogoUrl} alt={inst.name} className="w-full h-full object-cover" onError={() => setLogoErr(true)} />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground select-none">{initials}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center shadow-sm cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                onClick={() => !logoUploading && logoFileRef.current?.click()}>
                {logoUploading
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={11} className="text-white" />
                }
              </div>
              <input ref={logoFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />

              <AnimatePresence>
                {logoExpanded && currentLogoUrl && !logoErr && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={() => setLogoExpanded(false)}>
                    <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                      onClick={e => e.stopPropagation()}>
                      <img src={currentLogoUrl} alt={inst.name} className="w-full h-full object-cover" />
                      <button onClick={() => setLogoExpanded(false)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                        <X size={14} className="text-white" />
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold leading-tight">{instSaved.name}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <TypeIcon size={11} />
                  {inst.type}
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${status.cls}`}>
                  {status.label}
                </span>
                {planName && (
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase"
                    style={{
                      background: planName === 'PRO' ? '#DA775620' : planName === 'Trial' ? '#F59E0B20' : '#7C3AED20',
                      color: planName === 'PRO' ? '#DA7756' : planName === 'Trial' ? '#F59E0B' : '#7C3AED',
                    }}
                  >
                    {planName}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border/50">
                {[
                  { label: 'Students', value: studentCount },
                  { label: 'Teachers', value: teacherCount },
                  { label: 'Joined', value: joinDate },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-lg font-bold leading-tight">{value}</p>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Admin Profile Card */}
        <div className="bg-card border border-border/50 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-bold bg-primary/10 text-primary overflow-hidden select-none cursor-pointer"
                onClick={() => adminAvatarPreview && !adminAvatarPreview.startsWith('data:') ? setAdminPhotoExpanded(true) : adminAvatarRef.current?.click()}>
                {adminAvatarPreview
                  ? <NextImage src={adminAvatarPreview} alt={adminSaved.adminName} fill sizes="160px" className="object-cover" unoptimized={adminAvatarPreview.startsWith('data:')} />
                  : adminSaved.adminName
                    ? adminSaved.adminName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                    : <UserIcon size={24} />
                }
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center shadow-sm cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                onClick={() => adminAvatarRef.current?.click()}>
                <Camera size={11} className="text-white" />
              </div>

              <AnimatePresence>
                {adminPhotoExpanded && adminAvatarPreview && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={() => setAdminPhotoExpanded(false)}>
                    <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                      onClick={e => e.stopPropagation()}>
                      <img src={adminAvatarPreview} alt={adminSaved.adminName} className="w-full h-full object-cover" />
                      <button onClick={() => setAdminPhotoExpanded(false)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                        <X size={14} className="text-white" />
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
              <input ref={adminAvatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setAdminAvatarPreview(reader.result as string);
                    setUserAvatarUrl(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                  try {
                    const res = await api.post(isSubAdmin ? '/admin/subadmin/me/photo' : '/admin/me/photo', file, {
                      headers: { 'Content-Type': file.type },
                    });
                    const signedUrl: string = res.data.data.avatarUrl;
                    setAdminAvatarPreview(signedUrl);
                    setUserAvatarUrl(signedUrl);
                    toast.success('Photo updated!');
                  } catch {
                    toast.error('Failed to upload photo');
                  }
                }} />
            </div>
            <div className="flex-1 min-w-0">
              <div>
                <h2 className="text-lg font-bold leading-tight">
                  {adminSaved.adminPrefix && <span className="mr-1" style={{ color: '#DA7756' }}>{adminSaved.adminPrefix}</span>}
                  {adminSaved.adminName || '—'}
                </h2>
                <div className="flex items-center gap-1 mt-0.5">
                  {adminSaved.adminTitle && <p className="text-[11px] text-muted-foreground">{adminSaved.adminTitle}</p>}
                  <VerifiedBadge />
                </div>
                {profileUser && (
                  <p className="text-[12px] font-semibold mt-1.5" style={{ color: '#DA7756' }}>
                    {profileUser.email}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border/50">
                {[
                  { label: 'Role', value: profileUser?.role ?? '—' },
                  { label: 'Joined', value: profileUser ? toIST(profileUser.createdAt) : '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-sm font-bold leading-tight">{value}</p>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Institution Info */}
          <SectionCard title="Institution Info" editBtn={isSubAdmin ? undefined : editBtns('inst')}>
            {editingSection === 'inst' ? (
              <>
                <EditableField label="Name" value={instDraft.name} onChange={(v) => setInstDraft((d) => ({ ...d, name: v }))} placeholder="e.g. Delhi Public School" />
                <EditableField label="Email" value={instDraft.email} onChange={(v) => setInstDraft((d) => ({ ...d, email: v }))} placeholder="admin@school.edu.in" />
                <PhoneEditField value={instDraft.phone} onChange={(v) => setInstDraft((d) => ({ ...d, phone: v }))} />
                <EditableField label="Board" value={instDraft.board} onChange={(v) => setInstDraft((d) => ({ ...d, board: v }))} placeholder="e.g. CBSE / ICSE" />
                <EditableField label="Medium" value={instDraft.medium} onChange={(v) => setInstDraft((d) => ({ ...d, medium: v }))} placeholder="e.g. English / Hindi" />
                <EditableField
                  label="Established On"
                  value={instDraft.establishedOn}
                  onChange={(v) => setInstDraft((d) => ({ ...d, establishedOn: formatDob(v) }))}
                  placeholder="YYYY-MM-DD"
                />
              </>
            ) : (
              <>
                <InfoRow
                  icon={Hash}
                  label="Institute ID"
                  value={
                    instCode ? (
                      <span className="font-mono text-xs font-semibold tracking-wider" style={{ color: '#DA7756' }}>
                        {instCode}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground/50 text-[11px]">—</span>
                    )
                  }
                />
                <InfoRow icon={Building2} label="Name" value={instSaved.name} />
                <InfoRow icon={TypeIcon} label="Type" value={inst.type} />
                <InfoRow icon={Mail} label="Email" value={instSaved.email} />
                <InfoRow icon={Phone} label="Phone No" value={instSaved.phone || '—'} />
                <InfoRow icon={BookOpen} label="Board" value={instSaved.board || '—'} />
                <InfoRow icon={Globe} label="Medium" value={instSaved.medium || '—'} />
                <InfoRow icon={Calendar} label="Established On" value={instSaved.establishedOn ? toIST(instSaved.establishedOn) : '—'} />
                <InfoRow icon={Calendar} label="Joined (IST)" value={joinDate} />
              </>
            )}
          </SectionCard>

          {/* Admin / Sub-Admin Info */}
          <SectionCard title={isSubAdmin ? 'My Info' : 'Admin Info'} editBtn={editBtns('admin')}>
            {profileUser ? (
              <>
                {editingSection === 'admin' ? (
                  <>
                    {/* Full Name with prefix */}
                    <div className="flex items-start gap-3 py-2.5 border-b border-border/40">
                      <span className="text-xs text-muted-foreground w-28 shrink-0 mt-2">Full Name</span>
                      <div className="flex-1 space-y-2">
                        {!isSubAdmin && (
                          <div className="flex flex-wrap gap-1.5">
                            {ADMIN_PREFIX_OPTIONS.map((opt) => (
                              <button key={opt} type="button"
                                onClick={() => setAdminDraft((d) => ({ ...d, adminPrefix: d.adminPrefix === opt ? '' : opt }))}
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                                  adminDraft.adminPrefix === opt
                                    ? 'border-transparent text-white'
                                    : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-transparent'
                                }`}
                                style={adminDraft.adminPrefix === opt ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {adminDraft.adminPrefix && (
                            <span className="text-xs font-semibold shrink-0" style={{ color: '#DA7756' }}>{adminDraft.adminPrefix}</span>
                          )}
                          <input
                            value={adminDraft.adminName}
                            onChange={(e) => setAdminDraft((d) => ({ ...d, adminName: e.target.value }))}
                            placeholder="Enter full name"
                            className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 placeholder:font-normal"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Display Title / Designation */}
                    {isSubAdmin ? (
                      <EditableField label="Designation" value={adminDraft.adminTitle} onChange={(v) => setAdminDraft((d) => ({ ...d, adminTitle: v }))} placeholder="e.g. Accounts Coordinator" />
                    ) : (
                      <div className="flex items-start gap-3 py-2.5 border-b border-border/40">
                        <span className="text-xs text-muted-foreground w-28 shrink-0 mt-0.5">Display Title</span>
                        <div className="flex flex-wrap gap-1.5">
                          {ADMIN_TITLE_OPTIONS.map((opt) => (
                            <button key={opt} type="button"
                              onClick={() => setAdminDraft((d) => ({ ...d, adminTitle: d.adminTitle === opt ? '' : opt }))}
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                                adminDraft.adminTitle === opt
                                  ? 'border-transparent text-white'
                                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-transparent'
                              }`}
                              style={adminDraft.adminTitle === opt ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <PhoneEditField label={isSubAdmin ? 'Phone' : 'Admin Phone'} value={adminDraft.adminPhone} onChange={(v) => setAdminDraft((d) => ({ ...d, adminPhone: v }))} />
                    <EditableField label="DOB" value={adminDraft.adminDob} onChange={(v) => setAdminDraft((d) => ({ ...d, adminDob: formatDob(v) }))} placeholder="YYYY-MM-DD" />
                    {/* Gender pills */}
                    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
                      <span className="text-xs text-muted-foreground w-28 shrink-0">Gender</span>
                      <div className="flex gap-2">
                        {ADMIN_GENDER_OPTIONS.map((opt) => (
                          <button key={opt.value} type="button"
                            onClick={() => setAdminDraft((d) => ({ ...d, adminGender: opt.value }))}
                            className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
                              adminDraft.adminGender === opt.value
                                ? 'border-transparent text-white'
                                : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                            }`}
                            style={adminDraft.adminGender === opt.value ? { background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' } : {}}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-none">
                      <Hash size={14} className="text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground w-28 shrink-0 flex items-center gap-1">
                        User ID
                        <div className="relative group/tip">
                          <Info size={11} className="text-muted-foreground/50 cursor-pointer hover:text-primary transition-colors" />
                          <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tip:block z-50 pointer-events-none">
                            <div className="bg-gray-900 dark:bg-gray-800 text-[11px] text-white rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                              This is your unique login ID
                            </div>
                          </div>
                        </div>
                      </span>
                      <span className="text-xs font-medium text-foreground flex-1">
                        {myDisplayId ? (
                          <span className="font-mono text-xs font-semibold tracking-wider" style={{ color: '#DA7756' }}>
                            {myDisplayId}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/50 text-[11px]">—</span>
                        )}
                      </span>
                    </div>
                    <InfoRow icon={User} label="Full Name" value={
                      <span>
                        {adminSaved.adminPrefix && <span className="font-semibold mr-1" style={{ color: '#DA7756' }}>{adminSaved.adminPrefix}</span>}
                        {adminSaved.adminName || '—'}
                      </span>
                    } />
                    {adminSaved.adminTitle && (
                      <InfoRow icon={ShieldCheck} label={isSubAdmin ? 'Designation' : 'Display Title'} value={
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(218,119,86,0.12)', color: '#DA7756' }}>
                          {adminSaved.adminTitle}
                        </span>
                      } />
                    )}
                    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-none">
                      <Mail size={14} className="text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground w-28 shrink-0 flex items-center gap-1">
                        Email
                        <div className="relative group/tip">
                          <Info size={11} className="text-muted-foreground/50 cursor-pointer hover:text-primary transition-colors" />
                          <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tip:block z-50 pointer-events-none">
                            <div className="bg-gray-900 dark:bg-gray-800 text-[11px] text-white rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                              This email is used for login
                            </div>
                          </div>
                        </div>
                      </span>
                      <span className="text-xs font-medium text-foreground flex-1">{profileUser?.email ?? '—'}</span>
                    </div>
                    <InfoRow icon={Phone} label="Phone" value={adminSaved.adminPhone || '—'} />
                    <InfoRow icon={Calendar} label="Date of Birth" value={adminSaved.adminDob ? toIST(adminSaved.adminDob) : '—'} />
                    <InfoRow icon={User} label="Gender" value={adminSaved.adminGender || '—'} />
                    <InfoRow icon={ShieldCheck} label="Role" value={profileUser?.role ?? '—'} />
                    <InfoRow icon={CheckCircle} label="Account Active" value={profileUser?.isActive ? 'Yes' : 'Pending setup'} />
                    <InfoRow icon={Calendar} label="Created (IST)" value={profileUser ? toIST(profileUser.createdAt) : '—'} />
                  </>
                )}
              </>
            ) : (
              <InfoRow icon={User} label="Name" value={adminName} />
            )}
          </SectionCard>

          {/* Location */}
          <SectionCard title="Location" editBtn={isSubAdmin ? undefined : editBtns('loc')}>
            {editingSection === 'loc' ? (
              <>
                <EditableField label="Address" value={locDraft.address} onChange={(v) => setLocDraft((d) => ({ ...d, address: v }))} placeholder="Street / Building / Area" />
                <EditableField label="City" value={locDraft.city} onChange={(v) => setLocDraft((d) => ({ ...d, city: v }))} placeholder="e.g. Mumbai" />
                <EditableField label="State" value={locDraft.state} onChange={(v) => setLocDraft((d) => ({ ...d, state: v }))} placeholder="e.g. Maharashtra" />
                <EditableField label="Country" value={locDraft.country} onChange={(v) => setLocDraft((d) => ({ ...d, country: v }))} placeholder="e.g. India" />
                <EditableField label="Pincode" value={locDraft.pincode} onChange={(v) => setLocDraft((d) => ({ ...d, pincode: v }))} placeholder="e.g. 400001" />
              </>
            ) : (
              <>
                <InfoRow icon={MapPin} label="Address" value={locSaved.address || '—'} />
                <InfoRow icon={MapPin} label="City" value={locSaved.city || '—'} />
                <InfoRow icon={MapPin} label="State" value={locSaved.state || '—'} />
                <InfoRow icon={Globe} label="Country" value={locSaved.country || '—'} />
                <InfoRow icon={Hash} label="Pincode" value={locSaved.pincode || '—'} />
              </>
            )}
          </SectionCard>

          {/* Platform Stats */}
          <SectionCard title="Platform Stats">
            <InfoRow icon={Users} label="Total Students" value={studentCount} />
            <InfoRow icon={User} label="Total Teachers" value={teacherCount} />
            <InfoRow icon={FileText} label="Tests Conducted" value="—" />
            <InfoRow icon={Zap} label="Last Active" value="—" />
            <InfoRow icon={Calendar} label="Last Updated (IST)" value={toIST(inst.updatedAt)} />
          </SectionCard>

        </div>
      </motion.div>
      <div className="pb-1" />
    </div>
  );
}
