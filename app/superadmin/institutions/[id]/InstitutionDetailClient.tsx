"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  ArrowLeft,
  Landmark,
  LayoutGrid,
  SlidersHorizontal,
  Building2,
  Mail,
  Calendar,
  Phone,
  MapPin,
  User,
  Send,
  ToggleLeft,
  ToggleRight,
  Hash,
  Globe,
  IndianRupee,
  BookOpen,
  School,
  GraduationCap,
  HardDrive,
  Sparkles,
  Users,
  Zap,
  CheckCircle,
  XCircle,
  ShieldCheck,
  FileText,
  ChevronRight,
  Info,
  Pencil,
  X,
  Check,
  BookMarked,
  ClipboardList,
  Bell,
  Trophy,
  Upload,
  Camera,
  Flag,
  Wallet,
  BarChart2,
  Calendar as CalendarIcon,
  Cpu,
  FlaskConical,
  ArrowUpRight,
} from "lucide-react";
import { Institution } from "@/types";
import api from "@/lib/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/error";


import type {
  BillItem,
  Bill,
  ApiBill,
  InstData,
  AdminUser,
  TrialUsage,
  PlanDashboardResponse,
} from "./institution-detail.types";
import { PRICING, ALL_FEATURES, statusCfg, PLAN_BASE, COMMITTED_DISCOUNT } from "./institution-detail.constants";
import {
  toIST,
  mapApiBillToUiBill,
  getRate,
  getMarginalMonthlyBill,
  getEffectiveRate,
  fmt,
  getDefaultFeatures,
  getPlanFeatures,
} from "./institution-detail.utils";
import {
  Toggle,
  InfoBox,
  SectionCard,
  InfoRow,
  EditableField,
  InlineEditActions,
} from "./institution-detail.ui";

// ── Verified Badge ────────────────────────────────────────────────────────────
function VerifiedBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
      <path d="M20 2 L23.5 6.5 L29 5 L31.5 10.5 L37.5 12 L36 18 L40 22 L36 26 L37.5 32 L31.5 33.5 L29 39 L23.5 37.5 L20 42 L16.5 37.5 L11 39 L8.5 33.5 L2.5 32 L4 26 L0 22 L4 18 L2.5 12 L8.5 10.5 L11 5 L16.5 6.5 Z" fill="#DA7756" />
      <path d="M13 21l5 5 9-10" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDob(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}

const ADMIN_PREFIX_OPTIONS = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof.", "Er.", "CA", "Adv."];
const ADMIN_TITLE_OPTIONS = ["Principal", "Vice Principal", "Head Master", "Head Mistress", "Director", "Admin", "Dean", "Rector", "Superintendent", "Coordinator", "Chairman", "Secretary", "Trustee"];
const ADMIN_GENDER_OPTIONS = [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other" }];

// ── Phone edit field (portal dropdown, same as student detail) ────────────────
const INST_PHONE_CODES = [
  { code: "+91", flag: "🇮🇳", max: 10 },
  { code: "+1", flag: "🇺🇸", max: 10 },
  { code: "+44", flag: "🇬🇧", max: 10 },
  { code: "+61", flag: "🇦🇺", max: 9 },
  { code: "+971", flag: "🇦🇪", max: 9 },
  { code: "+65", flag: "🇸🇬", max: 8 },
];

function parseInstPhone(val: string) {
  const match = (val ?? "").match(/^(\+\d+)\s*(.*)$/);
  return match ? { code: match[1], number: match[2] } : { code: "+91", number: val ?? "" };
}

function PhoneEditField({ value, onChange, label = "Phone No" }: { value: string; onChange: (v: string) => void; label?: string }) {
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
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
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
          {open && typeof document !== "undefined" && createPortal(
            <div ref={dropRef} style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.15) transparent" }}
              className="bg-card border border-border rounded-xl shadow-xl py-1 min-w-[130px] max-h-[108px] overflow-y-auto">
              {INST_PHONE_CODES.map((c) => (
                <button key={c.code} type="button"
                  onClick={() => { onChange(`${c.code} ${number}`); setOpen(false); }}
                  className={`w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors ${code === c.code ? "text-primary font-semibold" : "text-foreground"}`}>
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
            if (raw.replace(/\D/g, "").length <= maxDigits) onChange(`${code} ${raw}`);
          }}
          placeholder="98765 43210"
          className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 placeholder:font-normal"
        />
      </div>
    </div>
  );
}

function ViewDetailsTab({
  inst,
  onStatusToggle,
  onResendInvite,
  onDelete,
  onInstitutionPatch,
}: {
  inst: InstData;
  onStatusToggle: () => void;
  onResendInvite: () => void;
  onDelete: () => Promise<void>;
  onInstitutionPatch: (patch: Omit<Partial<InstData>, "admin"> & { admin?: Partial<AdminUser> }) => void;
}) {
  const status = statusCfg[inst.status] ?? statusCfg["PENDING"];
  const TypeIcon =
    inst.type === "SCHOOL"
      ? School
      : inst.type === "COLLEGE"
        ? GraduationCap
        : BookOpen;
  const initials = inst.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const joinDate = toIST(inst.createdAt);
  const [logoErr, setLogoErr] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(inst.logoUrl ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoExpanded, setLogoExpanded] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [adminAvatarPreview, setAdminAvatarPreview] = useState<string | null>(inst.adminAvatarUrl ?? null);
  const [adminAvatarExpanded, setAdminAvatarExpanded] = useState(false);
  const adminAvatarRef = useRef<HTMLInputElement>(null);
  // Keep the shown photo in sync with the fetched value so an admin's updated
  // profile photo is reflected here automatically on refetch (no manual reload).
  useEffect(() => {
    setAdminAvatarPreview(inst.adminAvatarUrl ?? null);
  }, [inst.adminAvatarUrl]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Only PNG, JPG, or WEBP images are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2 MB or smaller");
      return;
    }
    try {
      setLogoUploading(true);
      const uploadRes = await api.post("/superadmin/institutions/logo", file, {
        headers: { "Content-Type": file.type },
      });
      const newLogoUrl: string = uploadRes.data?.data?.logoUrl;
      await api.put(`/superadmin/institutions/${inst.id}`, { logoUrl: newLogoUrl });
      setCurrentLogoUrl(newLogoUrl);
      setLogoErr(false);
      toast.success("Logo updated");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to upload logo"));
    } finally {
      setLogoUploading(false);
      if (logoFileRef.current) logoFileRef.current.value = "";
    }
  };

  // Enrich admin info from either dedicated field or users array
  const adminUser =
    inst.admin ?? inst.users?.find((u) => u.role === "ADMIN") ?? null;
  const adminName = adminUser?.name ?? adminUser?.email?.split("@")[0] ?? "—";
  const studentCount = inst.studentCount ?? 0;
  const teacherCount = inst.teacherCount ?? 0;
  const planName = inst.subscription?.plan?.name ?? "—";
  const instCode = inst.institutionCode ?? null;
  const logoUrl = inst.logoUrl ?? null;

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [instDraft, setInstDraft] = useState({
    name: inst.name,
    email: inst.email,
    phone: inst.phone ?? "",
    board: inst.board ?? "",
    medium: inst.medium ?? "",
    establishedOn: inst.establishedOn ?? "",
  });
  const [instSaved, setInstSaved] = useState({ ...instDraft });
  const [locDraft, setLocDraft] = useState({
    address: inst.address ?? "",
    city: inst.city ?? "",
    state: inst.state ?? "",
    country: inst.country ?? "",
    pincode: inst.pincode ?? "",
  });
  const [locSaved, setLocSaved] = useState({ ...locDraft });
  const [adminDraft, setAdminDraft] = useState({
    adminName,
    adminEmail: adminUser?.email ?? "",
    adminPrefix: adminUser?.prefix ?? inst.adminPrefix ?? "Mr.",
    adminTitle: adminUser?.title ?? inst.adminTitle ?? "Admin",
    adminPhone: adminUser?.phone ?? inst.adminPhone ?? "",
    adminDob: adminUser?.dob ?? inst.adminDob ?? "",
    adminGender: adminUser?.gender ?? inst.adminGender ?? "",
  });
  const [adminSaved, setAdminSaved] = useState({ ...adminDraft });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [savingInst, setSavingInst] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);

  const cancelEdit = (s: string) => {
    if (s === "inst") setInstDraft({ ...instSaved });
    if (s === "loc") setLocDraft({ ...locSaved });
    if (s === "admin") setAdminDraft({ ...adminSaved });
    setEditingSection(null);
  };
  const saveEdit = async (s: string) => {
    if (s === "inst") {
      if (savingInst) return;
      setSavingInst(true);
      try {
        const res = await api.put(`/superadmin/institutions/${inst.id}`, instDraft);
        const saved = res.data.data;
        const next = {
          name: saved.name,
          email: saved.email,
          phone: saved.phone ?? "",
          board: saved.board ?? "",
          medium: saved.medium ?? "",
          establishedOn: saved.establishedOn ?? "",
        };
        setInstDraft(next);
        setInstSaved(next);
        onInstitutionPatch(next);
        setEditingSection(null);
        toast.success("Institution details updated");
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
          ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg ?? "Failed to update institution details");
      } finally {
        setSavingInst(false);
      }
      return;
    }
    if (s === "loc") {
      if (savingLoc) return;
      setSavingLoc(true);
      try {
        const res = await api.put(`/superadmin/institutions/${inst.id}`, locDraft);
        const saved = res.data.data;
        const next = {
          address: saved.address ?? "",
          city: saved.city ?? "",
          state: saved.state ?? "",
          country: saved.country ?? "",
          pincode: saved.pincode ?? "",
        };
        setLocDraft(next);
        setLocSaved(next);
        onInstitutionPatch(next);
        setEditingSection(null);
        toast.success("Location details updated");
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
          ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg ?? "Failed to update location details");
      } finally {
        setSavingLoc(false);
      }
      return;
    }
    if (s === "admin") {
      if (savingAdmin) return;
      setSavingAdmin(true);
      try {
        const res = await api.patch(`/superadmin/institutions/${inst.id}/admin`, adminDraft);
        const saved = res.data.data;
        setAdminDraft((d) => ({ ...d, ...saved }));
        setAdminSaved((d) => ({ ...d, ...saved }));
        onInstitutionPatch({
          adminPhone: saved.adminPhone,
          adminDob: saved.adminDob,
          adminGender: saved.adminGender,
          adminPrefix: saved.adminPrefix,
          adminTitle: saved.adminTitle,
          admin: { name: saved.adminName, email: saved.adminEmail },
        });
        setEditingSection(null);
        toast.success("Admin details updated");
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
          ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg ?? "Failed to update admin details");
      } finally {
        setSavingAdmin(false);
      }
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="bg-card border border-border/50 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          {/* Logo / initials — click photo to view large, click camera badge to upload */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-muted ring-2 ring-border overflow-hidden flex items-center justify-center cursor-pointer"
              onClick={() => currentLogoUrl && !logoErr ? setLogoExpanded(true) : (!logoUploading && logoFileRef.current?.click())}>
              {currentLogoUrl && !logoErr ? (
                <img
                  src={currentLogoUrl}
                  alt={inst.name}
                  className="w-full h-full object-cover"
                  onError={() => setLogoErr(true)}
                />
              ) : (
                <span className="text-xl font-bold text-muted-foreground select-none">
                  {initials}
                </span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center shadow-sm cursor-pointer"
              style={{ background: "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)" }}
              onClick={() => !logoUploading && logoFileRef.current?.click()}>
              {logoUploading
                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={11} className="text-white" />
              }
            </div>
            <input
              ref={logoFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />

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
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold leading-tight">
                  {instSaved.name}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    <TypeIcon size={11} />
                    {inst.type}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${status.cls}`}
                  >
                    {status.label}
                  </span>
                  {planName !== "—" && (
                    <span
                      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase"
                      style={{
                        background:
                          planName === "PRO" ? "#DA775620" : planName === "TRIAL" ? "#F59E0B20" : "#7C3AED20",
                        color: planName === "PRO" ? "#DA7756" : planName === "TRIAL" ? "#F59E0B" : "#7C3AED",
                      }}
                    >
                      {planName}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={onResendInvite}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <Send size={12} /> Resend Invite
                </button>
                <button
                  onClick={() => setStatusConfirm(true)}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${inst.status === "ACTIVE" ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"}`}
                >
                  {inst.status === "ACTIVE" ? (
                    <>
                      <ToggleLeft size={13} /> Suspend
                    </>
                  ) : (
                    <>
                      <ToggleRight size={13} /> Activate
                    </>
                  )}
                </button>
                {inst.status === "SUSPENDED" && (
                  <button
                    onClick={() => { setDeleteConfirm(true); setDeleteInput(""); }}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-all"
                  >
                    <XCircle size={13} /> Delete
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
              {[
                { label: "Students", value: studentCount },
                { label: "Teachers", value: teacherCount },
                { label: "Joined", value: joinDate },
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
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold bg-primary/10 text-primary overflow-hidden select-none cursor-pointer"
              onClick={() => adminAvatarPreview ? setAdminAvatarExpanded(true) : adminAvatarRef.current?.click()}>
              {adminAvatarPreview
                ? <img src={adminAvatarPreview} alt={adminSaved.adminName} className="w-full h-full object-cover" />
                : adminSaved.adminName
                  ? adminSaved.adminName.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
                  : <User size={24} />
              }
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center shadow-sm cursor-pointer"
              style={{ background: "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)" }}
              onClick={() => adminAvatarRef.current?.click()}>
              <Camera size={11} className="text-white" />
            </div>
            <input ref={adminAvatarRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => setAdminAvatarPreview(reader.result as string);
                  reader.readAsDataURL(file);
                  toast.success("Photo updated!");
                }
                e.target.value = "";
              }} />

            <AnimatePresence>
              {adminAvatarExpanded && adminAvatarPreview && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                  onClick={() => setAdminAvatarExpanded(false)}>
                  <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="relative w-72 h-72 rounded-2xl overflow-hidden shadow-2xl"
                    onClick={e => e.stopPropagation()}>
                    <img src={adminAvatarPreview} alt={adminSaved.adminName} className="w-full h-full object-cover" />
                    <button onClick={() => setAdminAvatarExpanded(false)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-all">
                      <X size={14} className="text-white" />
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 min-w-0">
            <div>
              <h2 className="text-lg font-bold leading-tight">
                {adminSaved.adminPrefix && <span className="mr-1" style={{ color: "#DA7756" }}>{adminSaved.adminPrefix}</span>}
                {adminSaved.adminName || "—"}
              </h2>
              <div className="flex items-center gap-1 mt-0.5">
                {adminSaved.adminTitle && <p className="text-[11px] text-muted-foreground">{adminSaved.adminTitle}</p>}
                <VerifiedBadge />
              </div>
              {adminUser && (
                <p className="text-[12px] font-semibold mt-1.5" style={{ color: "#DA7756" }}>
                  {adminSaved.adminEmail}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
              {[
                { label: "Role", value: adminUser?.role ?? "—" },
                { label: "Joined", value: adminUser ? toIST(adminUser.createdAt) : "—" },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Institution Info" editBtn={editBtns("inst")}>
          {editingSection === "inst" ? (
            <>
              <EditableField
                label="Name"
                value={instDraft.name}
                onChange={(v) => setInstDraft((d) => ({ ...d, name: v }))}
                placeholder="e.g. Delhi Public School"
              />
              <EditableField
                label="Email"
                value={instDraft.email}
                onChange={(v) => setInstDraft((d) => ({ ...d, email: v }))}
                placeholder="admin@school.edu.in"
              />
              <PhoneEditField
                value={instDraft.phone}
                onChange={(v) => setInstDraft((d) => ({ ...d, phone: v }))}
              />
              <EditableField
                label="Board"
                value={instDraft.board}
                onChange={(v) => setInstDraft((d) => ({ ...d, board: v }))}
                placeholder="e.g. CBSE / ICSE"
              />
              <EditableField
                label="Medium"
                value={instDraft.medium}
                onChange={(v) => setInstDraft((d) => ({ ...d, medium: v }))}
                placeholder="e.g. English / Hindi"
              />
              <EditableField
                label="Established On"
                value={instDraft.establishedOn}
                onChange={(v) => {
                  const digits = v.replace(/\D/g, "").slice(0, 8);
                  let formatted = digits;
                  if (digits.length > 6) formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
                  else if (digits.length > 4) formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
                  setInstDraft((d) => ({ ...d, establishedOn: formatted }));
                }}
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
                    <span
                      className="font-mono text-xs font-semibold tracking-wider"
                      style={{ color: "#DA7756" }}
                    >
                      {instCode}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground/50 text-[11px]">
                      —
                    </span>
                  )
                }
              />
              <InfoRow icon={Building2} label="Name" value={instSaved.name} />
              <InfoRow icon={TypeIcon} label="Type" value={inst.type} />
              <InfoRow icon={Mail} label="Email" value={instSaved.email} />
              <InfoRow
                icon={Phone}
                label="Phone No"
                value={instSaved.phone || "—"}
              />
              <InfoRow
                icon={BookOpen}
                label="Board"
                value={instSaved.board || "—"}
              />
              <InfoRow
                icon={Globe}
                label="Medium"
                value={instSaved.medium || "—"}
              />
              <InfoRow icon={Calendar} label="Joined (IST)" value={joinDate} />
              <InfoRow
                icon={Calendar}
                label="Established On"
                value={instSaved.establishedOn ? toIST(instSaved.establishedOn) : "—"}
              />
            </>
          )}
        </SectionCard>
        <SectionCard title="Admin Info" editBtn={editBtns("admin")}>
          {adminUser ? (
            <div>
              {editingSection === "admin" ? (
                <>
                  {/* Full Name with prefix */}
                  <div className="flex items-start gap-3 py-2.5 border-b border-border/40">
                    <span className="text-xs text-muted-foreground w-28 shrink-0 mt-2">Full Name</span>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {ADMIN_PREFIX_OPTIONS.map((opt) => (
                          <button key={opt} type="button"
                            onClick={() => setAdminDraft((d) => ({ ...d, adminPrefix: d.adminPrefix === opt ? "" : opt }))}
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${adminDraft.adminPrefix === opt
                                ? "border-transparent text-white"
                                : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-transparent"
                              }`}
                            style={adminDraft.adminPrefix === opt ? { background: "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)" } : {}}>
                            {opt}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {adminDraft.adminPrefix && (
                          <span className="text-xs font-semibold shrink-0" style={{ color: "#DA7756" }}>{adminDraft.adminPrefix}</span>
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
                  {/* Admin Email — this is the admin's login email */}
                  <div className="flex items-start gap-3 py-2.5 border-b border-border/40">
                    <span className="text-xs text-muted-foreground w-28 shrink-0 mt-2 flex items-center gap-1">
                      Admin Email
                      <div className="relative group/tip">
                        <Info size={11} className="text-muted-foreground/50 cursor-pointer hover:text-primary transition-colors" />
                        <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tip:block z-50 pointer-events-none">
                          <div className="bg-gray-900 dark:bg-gray-800 text-[11px] text-white rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                            Changes the admin's login email
                          </div>
                        </div>
                      </div>
                    </span>
                    <input
                      type="email"
                      value={adminDraft.adminEmail}
                      onChange={(e) => setAdminDraft((d) => ({ ...d, adminEmail: e.target.value }))}
                      placeholder="admin@school.edu.in"
                      className="flex-1 h-8 px-2.5 rounded-lg border border-primary/50 bg-primary/5 text-xs font-medium focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 placeholder:font-normal"
                    />
                  </div>
                  {/* Display Title */}
                  <div className="flex items-start gap-3 py-2.5 border-b border-border/40">
                    <span className="text-xs text-muted-foreground w-28 shrink-0 mt-0.5">Display Title</span>
                    <div className="flex flex-wrap gap-1.5">
                      {ADMIN_TITLE_OPTIONS.map((opt) => (
                        <button key={opt} type="button"
                          onClick={() => setAdminDraft((d) => ({ ...d, adminTitle: d.adminTitle === opt ? "" : opt }))}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${adminDraft.adminTitle === opt
                              ? "border-transparent text-white"
                              : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-transparent"
                            }`}
                          style={adminDraft.adminTitle === opt ? { background: "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)" } : {}}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <PhoneEditField
                    label="Admin Phone"
                    value={adminDraft.adminPhone}
                    onChange={(v) => setAdminDraft((d) => ({ ...d, adminPhone: v }))}
                  />
                  <EditableField
                    label="DOB"
                    value={adminDraft.adminDob}
                    onChange={(v) => setAdminDraft((d) => ({ ...d, adminDob: formatDob(v) }))}
                    placeholder="YYYY-MM-DD"
                  />
                  {/* Gender pills */}
                  <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-none">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">Gender</span>
                    <div className="flex gap-2">
                      {ADMIN_GENDER_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button"
                          onClick={() => setAdminDraft((d) => ({ ...d, adminGender: opt.value }))}
                          className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${adminDraft.adminGender === opt.value
                              ? "border-transparent text-white"
                              : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                            }`}
                          style={adminDraft.adminGender === opt.value ? { background: "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)" } : {}}>
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
                      Admin ID
                      <div className="relative group/tip">
                        <Info size={11} className="text-muted-foreground/50 cursor-pointer hover:text-primary transition-colors" />
                        <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tip:block z-50 pointer-events-none">
                          <div className="bg-gray-900 dark:bg-gray-800 text-[11px] text-white rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                            This ID is used for admin login
                          </div>
                        </div>
                      </div>
                    </span>
                    {adminUser?.displayId ? (
                      <span className="font-mono text-xs font-semibold tracking-wider" style={{ color: '#DA7756' }}>
                        {adminUser.displayId}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground/50 text-[11px]">—</span>
                    )}
                  </div>
                  <InfoRow icon={User} label="Admin Name" value={
                    <span>
                      {adminSaved.adminPrefix && <span className="font-semibold mr-1" style={{ color: "#DA7756" }}>{adminSaved.adminPrefix}</span>}
                      {adminSaved.adminName || "—"}
                    </span>
                  } />
                  {adminSaved.adminTitle && (
                    <InfoRow icon={ShieldCheck} label="Display Title" value={
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(218,119,86,0.12)", color: "#DA7756" }}>
                        {adminSaved.adminTitle}
                      </span>
                    } />
                  )}
                  <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-none">
                    <Mail size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-28 shrink-0 flex items-center gap-1">
                      Admin Email
                      <div className="relative group/tip">
                        <Info size={11} className="text-muted-foreground/50 cursor-pointer hover:text-primary transition-colors" />
                        <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tip:block z-50 pointer-events-none">
                          <div className="bg-gray-900 dark:bg-gray-800 text-[11px] text-white rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                            This email is used for admin login
                          </div>
                        </div>
                      </div>
                    </span>
                    <span className="text-xs font-medium text-foreground flex-1">{adminSaved.adminEmail}</span>
                  </div>
                  <InfoRow icon={Phone} label="Admin Phone" value={adminSaved.adminPhone || "—"} />
                  <InfoRow icon={Calendar} label="Admin DOB" value={adminSaved.adminDob ? toIST(adminSaved.adminDob) : "—"} />
                  <InfoRow icon={User} label="Admin Gender" value={adminSaved.adminGender || "—"} />
                  <InfoRow icon={ShieldCheck} label="Role" value={adminUser.role} />
                  <InfoRow icon={CheckCircle} label="Account Active" value={adminUser.isActive ? "Yes" : "Pending setup"} />
                  <InfoRow icon={Calendar} label="Created (IST)" value={toIST(adminUser.createdAt)} />
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No admin assigned yet
            </p>
          )}
        </SectionCard>
        <SectionCard title="Location" editBtn={editBtns("loc")}>
          {editingSection === "loc" ? (
            <>
              <EditableField label="Address" value={locDraft.address} onChange={(v) => setLocDraft((d) => ({ ...d, address: v }))} placeholder="Street / Building / Area" />
              <EditableField label="City" value={locDraft.city} onChange={(v) => setLocDraft((d) => ({ ...d, city: v }))} placeholder="e.g. Mumbai" />
              <EditableField label="State" value={locDraft.state} onChange={(v) => setLocDraft((d) => ({ ...d, state: v }))} placeholder="e.g. Maharashtra" />
              <EditableField label="Country" value={locDraft.country} onChange={(v) => setLocDraft((d) => ({ ...d, country: v }))} placeholder="e.g. India" />
              <EditableField label="Pincode" value={locDraft.pincode} onChange={(v) => setLocDraft((d) => ({ ...d, pincode: v }))} placeholder="e.g. 400001" />
            </>
          ) : (
            <>
              <InfoRow icon={MapPin} label="Address" value={locSaved.address || "—"} />
              <InfoRow icon={MapPin} label="City" value={locSaved.city || "—"} />
              <InfoRow icon={MapPin} label="State" value={locSaved.state || "—"} />
              <InfoRow icon={Globe} label="Country" value={locSaved.country || "—"} />
              <InfoRow icon={Hash} label="Pincode" value={locSaved.pincode || "—"} />
            </>
          )}
        </SectionCard>
        <SectionCard title="Platform Stats">
          <InfoRow icon={Users} label="Total Students" value={studentCount} />
          <InfoRow icon={User} label="Total Teachers" value={teacherCount} />
          <InfoRow icon={FileText} label="Tests Conducted" value="—" />
          <InfoRow icon={Zap} label="Last Active" value="—" />
          <InfoRow
            icon={Calendar}
            label="Last Updated (IST)"
            value={toIST(inst.updatedAt)}
          />
        </SectionCard>
      </div>

      {/* Delete Confirmation Modal */}
      {/* Suspend / Activate confirm */}
      {statusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-card border rounded-2xl overflow-hidden max-w-sm w-full mx-4 shadow-2xl ${inst.status === "ACTIVE" ? "border-amber-500/30" : "border-emerald-500/30"}`}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${inst.status === "ACTIVE" ? "bg-amber-100 dark:bg-amber-950/50" : "bg-emerald-100 dark:bg-emerald-950/50"}`}>
                  {inst.status === "ACTIVE"
                    ? <ToggleLeft size={16} className="text-amber-600 dark:text-amber-400" />
                    : <ToggleRight size={16} className="text-emerald-600 dark:text-emerald-400" />
                  }
                </div>
                <h3 className={`text-base font-bold ${inst.status === "ACTIVE" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {inst.status === "ACTIVE" ? "Suspend Institution?" : "Activate Institution?"}
                </h3>
              </div>
              <button
                onClick={() => setStatusConfirm(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-6">
              <div className={`rounded-xl p-3 border ${inst.status === "ACTIVE" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/50" : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/50"}`}>
                <p className={`text-xs font-semibold mb-1 ${inst.status === "ACTIVE" ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {inst.status === "ACTIVE" ? "Access will be revoked immediately" : "Access will be restored immediately"}
                </p>
                <p className={`text-[11px] ${inst.status === "ACTIVE" ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-500"}`}>
                  {inst.status === "ACTIVE"
                    ? `Suspending ${inst.name} will block all logins. All data will be preserved and the institution can be reactivated anytime.`
                    : `Activating ${inst.name} will restore full access for all users immediately.`
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
              <button
                onClick={() => setStatusConfirm(false)}
                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => { setStatusConfirm(false); onStatusToggle(); }}
                className={`h-9 px-5 rounded-xl text-xs font-semibold text-white transition-all flex items-center gap-2 ${inst.status === "ACTIVE" ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
              >
                {inst.status === "ACTIVE"
                  ? <><ToggleLeft size={13} /> Yes, Suspend</>
                  : <><ToggleRight size={13} /> Yes, Activate</>
                }
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-red-500/30 rounded-2xl overflow-hidden max-w-md w-full mx-4 shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                  <XCircle size={16} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-base font-bold text-red-600 dark:text-red-400">Delete Institution</h3>
              </div>
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3 border border-red-200/50 dark:border-red-900/50">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">This action is irreversible</p>
                <p className="text-[11px] text-red-600 dark:text-red-500">
                  All data for <span className="font-bold">{inst.name}</span> will be permanently deleted — users, subscriptions, bills, audit logs, and all associated records.
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Type <span className="font-mono font-bold text-foreground">{inst.name}</span> to confirm
                </p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder={inst.name}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50"
                />
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }}
                className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                disabled={deleteInput.trim() !== inst.name || deleting}
                onClick={async () => {
                  setDeleting(true);
                  await onDelete();
                  setDeleting(false);
                }}
                className="h-9 px-5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Permanently Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function ManagePlanTab({ inst, onPatch }: { inst: InstData; onPatch?: (patch: Omit<Partial<InstData>, "admin"> & { admin?: Partial<AdminUser> }) => void }) {
  const router = useRouter();
  const instType =
    (inst.type as keyof typeof PRICING) in PRICING
      ? (inst.type as keyof typeof PRICING)
      : "SCHOOL";
  const pricing = PRICING[instType];
  const initialPlan =
    (inst.subscription?.plan?.name as "BASIC" | "PRO" | "TRIAL") ?? "BASIC";
  const [planActive, setPlanActive] = useState(
    (inst.subscription?.status ?? "") === "ACTIVE",
  );
  const [plan, setPlan] = useState<"BASIC" | "PRO" | "TRIAL">(initialPlan);
  const [planOption, setPlanOption] = useState<"NORMAL" | "COMMITTED">(
    // "FLEXIBLE" is the old name for this option (pause/half-billing removed —
    // it's now just "Normal": full rate, no pause, deactivate = full block).
    // Treat any legacy "FLEXIBLE" value from the backend as "NORMAL" too.
    inst.subscription?.planOption === "COMMITTED" ? "COMMITTED" : "NORMAL",
  );
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState("0");
  const [discount, setDiscount] = useState(inst.subscription?.discount ?? 0);
  const [licencePaid, setLicencePaid] = useState(
    (inst.subscription?.paymentStatus ?? "") === "PAID",
  );
  const [activating, setActivating] = useState(false);
  const [showTrialConfirm, setShowTrialConfirm] = useState(false);
  const [features, setFeatures] = useState<Record<string, boolean>>(
    getDefaultFeatures("BASIC"),
  );
  const [storageAddGb, setStorageAddGb] = useState(0);
  const [storageAddInput, setStorageAddInput] = useState("0");
  const [storagePricePerGb, setStoragePricePerGb] = useState<number | "">("");
  const [storageAdded, setStorageAdded] = useState(false);
  const [tokenAddK, setTokenAddK] = useState(0);
  const [tokenAddInput, setTokenAddInput] = useState("0");
  const [tokenPricePer10k, setTokenPricePer10k] = useState<number | "">("");
  const [tokenAdded, setTokenAdded] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<
    "deactivate" | "upgrade" | "downgrade" | "enable_addon" | null
  >(null);
  const [upgradePaid, setUpgradePaid] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [upgradeDate, setUpgradeDate] = useState<Date | null>(null);
  const [upgradeModalTab, setUpgradeModalTab] = useState<"current" | "after">(
    "current",
  );
  const [addonExpiries, setAddonExpiries] = useState<Record<string, Date>>({});
  const [pendingEnableKey, setPendingEnableKey] = useState<string | null>(null);
  const [addonExtraBill, setAddonExtraBill] = useState(0);
  const [billModal, setBillModal] = useState<Bill | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [resendingBill, setResendingBill] = useState(false);
  const [activationDate, setActivationDate] = useState(
    inst.subscription?.activationDate
      ? new Date(inst.subscription.activationDate)
      : new Date(),
  );
  const [savingAddons, setSavingAddons] = useState(false);
  const [dashboardData, setDashboardData] = useState<PlanDashboardResponse | null>(null);
  const [loadingBills, setLoadingBills] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState("");
  const [extending, setExtending] = useState(false);
  const [churnOpen, setChurnOpen] = useState(false);
  const [churnConfirm, setChurnConfirm] = useState(false);
  const [churning, setChurning] = useState(false);
  const [trialUsage, setTrialUsage] = useState<TrialUsage | null>(null);
  const [loadingTrialUsage, setLoadingTrialUsage] = useState(false);

  const buildStrictAddonsPayload = useCallback(() => {
    const extraStorage =
      storageAdded && storageAddGb > 0 && typeof storagePricePerGb === "number"
        ? [{ gbPurchased: storageAddGb, price: storageAddGb * storagePricePerGb }]
        : [];

    const aiTokenAddon =
      tokenAdded && tokenAddK > 0 && typeof tokenPricePer10k === "number"
        ? { active: true as const, tokensPerMonth: tokenAddK * 1_000_000, pricePerMillion: tokenPricePer10k }
        : undefined;

    return {
      addons: {
        performanceInsightsAndAnalytics: {
          active: Boolean(features.performance_analytics),
          billingCycle: "MONTHLY" as const,
          amount: 0,
        },
        timetableAutoScheduling: {
          active: Boolean(features.auto_timetable),
          billingCycle: "MONTHLY" as const,
          amount: 0,
        },
        ...(extraStorage.length > 0 ? { extraStorage } : {}),
        ...(aiTokenAddon ? { aiTokenAddon } : {}),
      },
    };
  }, [
    features,
    storageAdded,
    storageAddGb,
    storagePricePerGb,
    tokenAdded,
    tokenAddK,
    tokenPricePer10k,
  ]);

  const fetchPlanDashboard = useCallback(async () => {
    try {
      const res = await api.get(`/superadmin/institutions/${inst.id}/plan/dashboard`);
      const data = res.data?.data as PlanDashboardResponse;
      setDashboardData(data);
      if (data?.planDetails?.activationDate) {
        setActivationDate(new Date(data.planDetails.activationDate));
      }
    } catch {
      // non-blocking for existing UI
    }
  }, [inst.id]);

  const fetchBills = useCallback(async () => {
    try {
      setLoadingBills(true);
      const res = await api.get(`/superadmin/institutions/${inst.id}/bills`);
      const apiBills = (res.data?.bills ?? []) as ApiBill[];
      setBills(apiBills.map(mapApiBillToUiBill));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to load bills"));
    } finally {
      setLoadingBills(false);
    }
  }, [inst.id]);

  const fetchTrialUsage = useCallback(async () => {
    setLoadingTrialUsage(true);
    try {
      const res = await api.get(`/superadmin/institutions/${inst.id}/trial/usage`);
      setTrialUsage(res.data?.data ?? null);
    } catch {
      // non-blocking
    } finally {
      setLoadingTrialUsage(false);
    }
  }, [inst.id]);

  useEffect(() => {
    void fetchPlanDashboard();
    void fetchBills();
  }, [fetchPlanDashboard, fetchBills]);

  useEffect(() => {
    if (plan === "TRIAL") void fetchTrialUsage();
  }, [plan, fetchTrialUsage]);
  useEffect(() => {
    if (!planActive) {
      setFeatures(getDefaultFeatures(plan));
      return;
    }
    const today2 = new Date();
    const basicExpiry = new Date(activationDate);
    basicExpiry.setFullYear(basicExpiry.getFullYear() + 1);

    setFeatures((prev) => {
      const updated = { ...getDefaultFeatures(plan) };
      ALL_FEATURES.filter((f) =>
        plan === "PRO" ? f.inPro && f.addOnPro : f.inBasic && f.addOnBasic,
      ).forEach((f) => {
        const finalExpiry = addonExpiries[f.key] ?? basicExpiry;
        updated[f.key] = today2 <= finalExpiry;
      });
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planActive, plan]);

  const activeUsers = (inst.studentCount ?? 0) + (inst.teacherCount ?? 0) + 1;
  const planPricing = pricing[plan] ?? pricing.BASIC;
  const licenceCost = planPricing.licence;
  const discountAmt = Math.round(licenceCost * (discount / 100));
  const finalLicence = licenceCost - discountAmt;
  const billedUsers = Math.max(200, activeUsers);
  // Marginal billing: first 1500 users @ base rate, beyond 1500 @ marginal rate
  const planBase = plan !== "TRIAL" ? PLAN_BASE[plan] : PLAN_BASE.BASIC;
  const monthlyBill = getMarginalMonthlyBill(activeUsers, planBase.baseRate, planBase.marginalRate, planOption);
  const effectiveRate = getEffectiveRate(activeUsers, planBase.baseRate, planBase.marginalRate, planOption);
  // For display: base rate (standard per-user label)
  const currentRate = plan !== "TRIAL" ? planBase.baseRate : 0;
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const canActivate = plan === "TRIAL" || licencePaid;

  const handleActivate = async () => {
    if (plan !== "TRIAL" && !licencePaid) {
      toast.error("Mark licence payment as received first");
      return;
    }

    try {
      setActivating(true);
      const res = await api.post(`/superadmin/institutions/${inst.id}/activate`, {
        plan: plan === "TRIAL" ? "BASIC" : plan,
        paymentReceived: true,
        discountPct: discount,
        planOption: plan === "TRIAL" ? "NORMAL" : planOption,
      });

      setPlanActive(true);
      const activation = res.data?.data?.activationDate;
      if (activation) setActivationDate(new Date(activation));

      setSavingAddons(true);
      await api.patch(`/superadmin/institutions/${inst.id}/addons`, buildStrictAddonsPayload());
      await fetchPlanDashboard();
      await fetchBills();
      toast.success(`${plan} plan activated successfully`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to activate plan"));
    } finally {
      setSavingAddons(false);
      setActivating(false);
    }
  };

  const PLAN_OPTS = [
    {
      key: "BASIC" as const,
      label: "Basic",
      activeColor: "text-primary",
      dot: "bg-primary",
      border: "border-primary bg-primary/5",
      features: [
        { icon: IndianRupee, label: `₹${PLAN_BASE.BASIC.baseRate}/user/mo (up to 1500 users)` },
        { icon: IndianRupee, label: `₹${PLAN_BASE.BASIC.marginalRate}/user/mo (beyond 1500 — marginal)` },
        { icon: Users, label: "Min. 200 users billed" },
        { icon: Sparkles, label: `${PLAN_BASE.BASIC.aiTokens}M AI Tokens/month` },
        { icon: HardDrive, label: `${PLAN_BASE.BASIC.storage} Storage` },
        { icon: Sparkles, label: "13 Default Features" },
        { icon: XCircle, label: "No Whitelabeling" },
      ],
    },
    {
      key: "PRO" as const,
      label: "Pro",
      activeColor: "text-[#DA7756]",
      dot: "bg-[#DA7756]",
      border: "border-[#DA7756] bg-[#DA7756]/5",
      features: [
        { icon: IndianRupee, label: `₹${PLAN_BASE.PRO.baseRate}/user/mo (up to 1500 users)` },
        { icon: IndianRupee, label: `₹${PLAN_BASE.PRO.marginalRate}/user/mo (beyond 1500 — marginal)` },
        { icon: Users, label: "Min. 200 users billed" },
        { icon: Sparkles, label: `${PLAN_BASE.PRO.aiTokens}M AI Tokens/month` },
        { icon: HardDrive, label: `${PLAN_BASE.PRO.storage} Storage` },
        { icon: Sparkles, label: "16 Default Features" },
        { icon: CheckCircle, label: "Whitelabeling" },
      ],
    },
    {
      key: "TRIAL" as const,
      label: "Trial",
      activeColor: "text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
      border: "border-amber-500 bg-amber-50 dark:bg-amber-950/20",
      features: [],
    },
  ];

  // ── ACTIVE VIEW ──
  if (planActive) {
    const basicExpiryDate = new Date(activationDate);
    basicExpiryDate.setFullYear(basicExpiryDate.getFullYear() + 1);
    const today2 = new Date();
    const isExpired = (date: Date) => today2 > date;
    const daysLeft = (date: Date) =>
      Math.max(
        0,
        Math.ceil((date.getTime() - today2.getTime()) / (1000 * 60 * 60 * 24)),
      );

    const isAfter12Months = upgradeDate
      ? upgradeDate.getTime() - activationDate.getTime() >
      365 * 24 * 60 * 60 * 1000
      : false;

    const getFeatureExpiry = (key: string) => {
      const proOnlyKeys = ["leaderboard", "whitelabeling", "student_app_pro"];
      if (proOnlyKeys.includes(key) && upgradeDate && isAfter12Months) {
        const exp = new Date(upgradeDate);
        exp.setFullYear(exp.getFullYear() + 1);
        return exp;
      }

      return basicExpiryDate;
    };

    // Upgrade modal calculations
    const today3 = new Date();
    const monthsUsed = Math.min(
      12,
      Math.floor(
        (today3.getTime() - activationDate.getTime()) /
        (1000 * 60 * 60 * 24 * 30),
      ),
    );
    const monthsRemaining = Math.max(0, 12 - monthsUsed);
    const proLicence = pricing.PRO.licence;
    const basicLicence = pricing.BASIC.licence;
    const remainingCredit = Math.round((monthsRemaining / 12) * basicLicence);
    const upgradeIsAfter12 = monthsUsed >= 12;
    const loyaltyDiscount = upgradeIsAfter12 ? Math.round(proLicence * 0.1) : 0;
    const finalUpgradeCharge = upgradeIsAfter12
      ? proLicence - loyaltyDiscount
      : proLicence - remainingCredit;
    const newMonthlyRate = getRate(pricing.PRO.tiers, activeUsers);

    // Basic features for "Current" tab
    const basicDefaults = ALL_FEATURES.filter(
      (f) => f.inBasic && !f.addOnBasic,
    );
    const basicAddons = ALL_FEATURES.filter((f) => f.inBasic && f.addOnBasic);
    // PRO new features for "After" tab
    const proNewFeatures = ALL_FEATURES.filter((f) => f.inPro && !f.inBasic);
    const proNewAddons = ALL_FEATURES.filter(
      (f) => f.inPro && f.addOnPro && !f.addOnBasic,
    );

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
      if (!active || !payload?.length) return null;
      const { name, value } = payload[0];
      const colorMap: Record<string, string> = {
        Admin: "#7C3AED",
        Teachers: "#F59E0B",
        Students: "#10B981",
      };
      return (
        <div
          className="px-3 py-2 rounded-xl shadow-xl"
          style={{ background: "#1A1030", border: "1px solid #2D1F50" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: colorMap[name] }}
            />
            <span style={{ color: "#F1F5F9", fontSize: 12, fontWeight: 600 }}>
              {name}
            </span>
          </div>
          <p
            style={{
              color: "#F1F5F9",
              fontSize: 13,
              fontWeight: 800,
              marginTop: 2,
            }}
          >
            {value}
          </p>
        </div>
      );
    };

    const tierBreakdown = planPricing.tiers.map((tier) => ({
      ...tier,
      label:
        tier.max === Infinity
          ? `${tier.min}+ users`
          : `${tier.min}–${tier.max} users`,
      isActive: activeUsers >= tier.min && activeUsers <= tier.max,
    }));

    const storageBase = dashboardData?.usageMeters?.storageGb?.total ?? (plan === "PRO" ? 1024 : 500);
    const storageUsed = 0;
    const storageUsedPct = Math.min(
      100,
      Math.round((storageUsed / storageBase) * 100),
    );
    const storagePriceNum =
      typeof storagePricePerGb === "number" ? storagePricePerGb : 0;
    const storageAddTotal = storageAddGb * storagePriceNum;
    const tokenBase = dashboardData?.usageMeters?.aiTokens?.total ?? (PLAN_BASE[plan as "BASIC" | "PRO"].aiTokens * 1_000_000);
    const tokenUsed = 0;
    const tokenUsedPct = Math.min(
      100,
      Math.round((tokenUsed / tokenBase) * 100),
    );
    const tokenPriceNum =
      typeof tokenPricePer10k === "number" ? tokenPricePer10k : 0;
    const tokenAddTotal = tokenAddK * tokenPriceNum;
    const addonBill =
      (storageAdded ? storageAddTotal : 0) +
      (tokenAdded ? tokenAddTotal : 0) +
      addonExtraBill;
    const { defaults: defFeatures, addons: addonFeatures } =
      getPlanFeatures(plan);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const currentMonthDateRange = `${monthStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${monthEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

    const currentMonthItems: BillItem[] = [
      {
        label: "Monthly User Bill",
        desc: `${billedUsers} users × ${fmt(currentRate)}/user`,
        amount: monthlyBill,
        type: "base",
      },
      ...(storageAdded
        ? [
          {
            label: "Storage Add-On",
            desc: `${storageAddGb}GB × ₹${storagePricePerGb}/GB`,
            amount: storageAddTotal,
            type: "addon" as const,
          },
        ]
        : []),
      ...(tokenAdded
        ? [
          {
            label: "AI Tokens Add-On",
            desc: `${tokenAddK}M tokens × ₹${tokenPricePer10k}/1M`,
            amount: tokenAddTotal,
            type: "addon" as const,
          },
        ]
        : []),
      ...(addonExtraBill > 0
        ? [
          {
            label: "Feature Re-enable Charges",
            desc: "Expired add-on features renewed",
            amount: addonExtraBill,
            type: "addon" as const,
          },
        ]
        : []),
    ];
    const currentMonthTotal = currentMonthItems.reduce(
      (sum, i) => sum + i.amount,
      0,
    );

    const allBills = bills;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        {/* Active Banner */}
        <div className="bg-card border border-border/50 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Plan Active
                </span>
              </div>
              <h2
                className="text-2xl font-black"
                style={{ color: plan === "PRO" ? "#DA7756" : "#7C3AED" }}
              >
                {plan}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {instType} · Monthly Billing · {fmt(currentRate)}/user
              </p>

              {/* Dates */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CalendarIcon size={11} /> Activated:{" "}
                  <span className="font-medium text-foreground ml-1">
                    {activationDate.toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </span>
                {upgradeDate && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Zap size={11} className="text-[#DA7756]" /> Upgraded to
                    PRO:{" "}
                    <span className="font-medium text-[#DA7756] ml-1">
                      {upgradeDate.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                )}
              </div>

            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {plan === "BASIC" && (
                <button
                  onClick={() => {
                    setUpgradeModalTab("current");
                    setConfirmDialog("upgrade");
                  }}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{
                    background:
                      "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                  }}
                >
                  <Zap size={13} /> Upgrade to Pro
                </button>
              )}
              {plan === "PRO" && (
                <button
                  onClick={() => setConfirmDialog("downgrade")}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400 hover:opacity-80 transition-all"
                >
                  <ChevronRight size={13} className="rotate-180" /> Downgrade to Basic
                </button>
              )}
              <button
                onClick={() => setConfirmDialog("deactivate")}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-xs font-semibold hover:opacity-80 transition-all"
              >
                <XCircle size={13} /> Deactivate
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
            <div
              className="relative w-[90px] h-[90px] shrink-0"
              style={{ overflow: "visible" }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Admin", value: 1 },
                      { name: "Teachers", value: inst.teacherCount ?? 0 },
                      { name: "Students", value: inst.studentCount ?? 0 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={42}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                    paddingAngle={3}
                    minAngle={8}
                  >
                    <Cell fill="#7C3AED" />
                    <Cell fill="#F59E0B" />
                    <Cell fill="#10B981" />
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                    position={{ x: 95, y: 0 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-sm font-black leading-none">{activeUsers}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Total</p>
              </div>
            </div><div className="space-y-2 shrink-0">
              {[
                {
                  label: "Admin",
                  value: 1,
                  color: "text-violet-600 dark:text-violet-400",
                  dot: "bg-violet-500",
                },
                {
                  label: "Teachers",
                  value: inst.teacherCount ?? 0,
                  color: "text-amber-600 dark:text-amber-400",
                  dot: "bg-amber-500",
                },
                {
                  label: "Students",
                  value: inst.studentCount ?? 0,
                  color: "text-emerald-600 dark:text-emerald-400",
                  dot: "bg-emerald-500",
                },
              ].map(({ label, value, color, dot }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <div>
                    <p className={`text-sm font-black leading-none ${color}`}>
                      {value}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Billing Summary */}
        <SectionCard title="Billing Summary">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoBox
                label="Active Users"
                value={String(activeUsers)}
                sub="billed this month"
                onAction={() => router.push(`/superadmin/institutions/${inst.id}/users`)}
              />
              <InfoBox
                label="Current Rate"
                value={fmt(currentRate)}
                sub="per user / month"
              />
              <InfoBox
                label="Next Bill"
                value={fmt(monthlyBill + addonBill)}
                sub={nextMonth.toLocaleDateString("en-IN")}
                highlight
              />
            </div>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Pricing Tiers
                </p>
              </div>
              <div className="divide-y divide-border/30">
                {tierBreakdown.map((tier, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 ${tier.isActive ? "bg-[#DA7756]/5" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {tier.isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756]" />
                      )}
                      <span
                        className={`text-xs ${tier.isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      >
                        {tier.label}
                      </span>
                      {tier.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#DA7756]/15 text-[#DA7756] font-semibold">
                          Current
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-bold ${tier.isActive ? "text-[#DA7756]" : "text-muted-foreground"}`}
                    >
                      {fmt(tier.rate)}/user
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-200/50 dark:border-violet-900/50">
              <p className="text-[11px] text-violet-600 dark:text-violet-400">
                💡 Minimum 200 users billed per month. Current active:{" "}
                {activeUsers} users — billed as {billedUsers} users.{" "}
                {fmt(monthlyBill)} est. next bill.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Add-Ons */}
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Sparkles size={15} />
              Add-Ons
              {addonBill > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  +{fmt(addonBill)} this month
                </span>
              )}
            </span>
          }
        >
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive size={14} className="text-muted-foreground" />
                  <p className="text-xs font-semibold">Storage</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {storageUsed}GB / {storageBase}GB used
                </span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${storageUsedPct}%`,
                    background:
                      storageUsedPct > 85
                        ? "#ef4444"
                        : storageUsedPct > 70
                          ? "#f59e0b"
                          : "#7C3AED",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{storageUsedPct}% used</span>
                <span>{storageBase - storageUsed}GB remaining</span>
              </div>
              <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold">Add Storage</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={10}
                    value={storageAddGb}
                    onChange={(e) => {
                      setStorageAddGb(Number(e.target.value));
                      setStorageAddInput(e.target.value);
                    }}
                    className="flex-1 accent-[#7C3AED] h-1.5 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={storageAddInput}
                      onChange={(e) => {
                        setStorageAddInput(e.target.value);
                        setStorageAddGb(
                          Math.max(0, Number(e.target.value) || 0),
                        );
                      }}
                      className="w-16 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">GB</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">
                    Rate ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={storagePricePerGb}
                    onChange={(e) =>
                      setStoragePricePerGb(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="Enter rate"
                    className="w-28 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-primary"
                  />
                  <span className="text-xs text-muted-foreground">/ GB</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <InfoBox
                    label="Add"
                    value={`${storageAddGb} GB`}
                    sub="one-time"
                  />
                  <InfoBox
                    label="Rate"
                    value={
                      storagePricePerGb !== ""
                        ? `₹${storagePricePerGb}/GB`
                        : "—"
                    }
                    sub="per GB"
                  />
                  <InfoBox
                    label="This Month"
                    value={
                      storagePricePerGb !== "" ? fmt(storageAddTotal) : "—"
                    }
                    highlight
                  />
                </div>
                <button
                  disabled={
                    storageAddGb === 0 ||
                    storagePricePerGb === "" ||
                    storageAdded
                  }
                  onClick={() => {
                    setStorageAdded(true);
                    toast.success(
                      `${storageAddGb}GB storage added — added to this month's bill`,
                    );
                  }}
                  className="w-full h-9 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background:
                      "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                  }}
                >
                  {storageAdded
                    ? "✅ Storage Added to Bill"
                    : "Add Storage to This Month's Bill"}
                </button>
              </div>
            </div>
            <div className="h-px bg-border/50" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-muted-foreground" />
                  <p className="text-xs font-semibold">AI Tokens</p>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    Monthly limit
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {(tokenUsed / 1000000).toFixed(1)}M /{" "}
                  {(tokenBase / 1000000).toFixed(0)}M used
                </span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${tokenUsedPct}%`,
                    background:
                      tokenUsedPct > 85
                        ? "#ef4444"
                        : tokenUsedPct > 70
                          ? "#f59e0b"
                          : "#DA7756",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{tokenUsedPct}% used this month</span>
                <span>
                  {((tokenBase - tokenUsed) / 1000000).toFixed(1)}M remaining
                </span>
              </div>
              <div className="bg-muted/40 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold">Add AI Tokens</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={tokenAddK}
                    onChange={(e) => {
                      setTokenAddK(Number(e.target.value));
                      setTokenAddInput(e.target.value);
                    }}
                    className="flex-1 accent-[#DA7756] h-1.5 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={tokenAddInput}
                      onChange={(e) => {
                        setTokenAddInput(e.target.value);
                        setTokenAddK(Math.max(0, Number(e.target.value) || 0));
                      }}
                      className="w-16 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-primary"
                    />
                    <span className="text-xs text-muted-foreground">×1M</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">
                    Rate ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={tokenPricePer10k}
                    onChange={(e) =>
                      setTokenPricePer10k(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="Enter rate"
                    className="w-28 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-primary"
                  />
                  <span className="text-xs text-muted-foreground">
                    / 1M tokens
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <InfoBox
                    label="Add"
                    value={`${tokenAddK}M tokens`}
                    sub="this month"
                  />
                  <InfoBox
                    label="Rate"
                    value={
                      tokenPricePer10k !== "" ? `₹${tokenPricePer10k}/1M` : "—"
                    }
                    sub="per 1M tokens"
                  />
                  <InfoBox
                    label="This Month"
                    value={tokenPricePer10k !== "" ? fmt(tokenAddTotal) : "—"}
                    highlight
                  />
                </div>
                <button
                  disabled={
                    tokenAddK === 0 || tokenPricePer10k === "" || tokenAdded
                  }
                  onClick={() => {
                    setTokenAdded(true);
                    toast.success(
                      `${tokenAddK}M tokens added — added to this month's bill`,
                    );
                  }}
                  className="w-full h-9 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background:
                      "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                  }}
                >
                  {tokenAdded
                    ? "✅ Tokens Added to Bill"
                    : "Add Tokens to This Month's Bill"}
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Payment History */}
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <FileText size={15} /> Bills & Payments
            </span>
          }
        >
          <div className="space-y-4">
            {/* Current Month */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Current Month
                <span className="text-[10px] font-normal normal-case ml-2 text-violet-600 dark:text-violet-400">
                  {now.toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · Generates{" "}
                  {monthEnd.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
                <span>📅 {currentMonthDateRange}</span>
                <span className="font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  Generates on{" "}
                  {monthEnd.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border/40">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Bill Breakdown
                  </p>
                </div>
                <div className="divide-y divide-border/30">
                  {currentMonthItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2.5"
                    >
                      <div>
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.desc}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.type === "addon" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            Add-On
                          </span>
                        )}
                        <span className="text-xs font-bold">
                          {fmt(item.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20 border-t border-border/50">
                  <p className="text-xs font-bold">Total</p>
                  <p
                    className="text-sm font-black"
                    style={{ color: "#DA7756" }}
                  >
                    {fmt(currentMonthTotal)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-muted-foreground">
                  💡 Bill will be sent to admin dashboard on{" "}
                  {new Date(
                    now.getFullYear(),
                    now.getMonth() + 1,
                    1,
                  ).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <button
                  onClick={() =>
                    setBillModal({
                      id: "current",
                      type: "MONTHLY" as const,
                      month: now.toLocaleDateString("en-IN", {
                        month: "long",
                        year: "numeric",
                      }),
                      dateRange: currentMonthDateRange,
                      items: currentMonthItems,
                      total: currentMonthTotal,
                      status: "PENDING" as const,
                      generatedOn: monthEnd.toLocaleDateString("en-IN"),
                    })
                  }
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all"
                >
                  <FileText size={11} /> View Bill
                </button>
              </div>
            </div>
            <div className="h-px bg-border/50" />

            {/* Bill History */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Bill History
              </p>
              <div className="divide-y divide-border/40 max-h-[300px] overflow-y-auto">
                {loadingBills ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Loading bills...
                  </div>
                ) : allBills.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No generated bills yet
                  </div>
                ) : allBills.map((bill, idx) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold">{bill.month}</p>
                        {bill.type === "LICENCE" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                            Licence
                          </span>
                        )}
                        {bill.type === "UPGRADE_PRORATION" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                            Upgrade
                          </span>
                        )}
                        {idx === 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {bill.dateRange}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{fmt(bill.total)}</p>
                      {/* Status toggle */}
                      <button
                        disabled={bill.status === "FAILED"}
                        onClick={async () => {
                          const nextStatus = bill.status === "PAID" ? "PENDING" : "PAID";
                          try {
                            const res = await api.patch(
                              `/superadmin/institutions/${inst.id}/bills/${bill.id}/status`,
                              { status: nextStatus },
                            );
                            setBills((prev) =>
                              prev.map((b) =>
                                b.id === bill.id ? { ...b, status: nextStatus } : b,
                              ),
                            );
                            if (res.data?.data?.reactivated) {
                              setPlanActive(true);
                              toast.success("Payment recorded and institution reactivated");
                            } else {
                              toast.success(`Bill marked as ${nextStatus === "PAID" ? "Paid" : "Pending"}`);
                            }
                            await fetchPlanDashboard();
                          } catch (err: unknown) {
                            toast.error(getErrorMessage(err, "Failed to update bill"));
                          }
                        }}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all ${bill.status === "PAID"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 hover:bg-emerald-200"
                            : bill.status === "FAILED"
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 cursor-not-allowed"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 hover:bg-amber-200"
                          }`}
                      >
                        {bill.status}
                      </button>
                      <button
                        onClick={() => setBillModal(bill)}
                        className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all"
                      >
                        View
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/superadmin/institutions/${inst.id}/bills/${bill.id}/resend`);
                            toast.success(`Bill resent to admin for ${bill.month}`);
                          } catch (err: unknown) {
                            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to resend";
                            toast.error(msg);
                          }
                        }}
                        className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-white transition-all hover:opacity-90"
                        style={{
                          background:
                            "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                        }}
                      >
                        Resend
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Bill Modal */}
        {billModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-2xl overflow-hidden max-w-lg w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                <div>
                  <h3 className="text-base font-bold">
                    Invoice — {billModal.month}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {billModal.dateRange}
                  </p>
                </div>
                <button
                  onClick={() => setBillModal(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold">{inst.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {inst.type} · {instType}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {inst.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Plan</p>
                    <p
                      className="text-sm font-bold"
                      style={{ color: plan === "PRO" ? "#DA7756" : "#7C3AED" }}
                    >
                      {plan}
                    </p>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${billModal.status === "PAID" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"}`}
                    >
                      {billModal.status}
                    </span>
                  </div>
                </div>
                <div className="h-px bg-border/50" />
                <div className="space-y-2.5">
                  {billModal.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.desc}
                        </p>
                      </div>
                      <p className="text-xs font-bold">{fmt(item.amount)}</p>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Total Amount</p>
                  <p
                    className="text-lg font-black"
                    style={{ color: "#DA7756" }}
                  >
                    {fmt(billModal.total)}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Generated: {billModal.generatedOn}
                </p>
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                <button
                  onClick={() => setBillModal(null)}
                  className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  <button
                    disabled={resendingBill}
                    onClick={async () => {
                      setResendingBill(true);
                      try {
                        await api.post(`/superadmin/institutions/${inst.id}/bills/${billModal.id}/resend`);
                        toast.success(`Bill resent to admin for ${billModal.month}`);
                      } catch (err: unknown) {
                        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to resend bill";
                        toast.error(msg);
                      } finally {
                        setResendingBill(false);
                      }
                    }}
                    className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {resendingBill && <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />}
                    Resend to Admin
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{
                      background:
                        "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                    }}
                  >
                    Download PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Feature Controls */}
        <SectionCard title="Feature Controls">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Default Features
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
            {defFeatures.map(({ key, label, desc, icon: Icon, comingSoon }) => (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${comingSoon ? "border-border/50 bg-muted/20 opacity-60" : features[key] ? "border-[#DA7756]/30 bg-[#DA7756]/5" : "border-border/50 bg-muted/20"}`}
              >
                <div className="flex items-center gap-2 min-w-0 mr-3">
                  <Icon size={13} className="text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {comingSoon ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      Coming Soon
                    </span>
                  ) : (
                    <>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        Default
                      </span>
                      <Toggle
                        on={features[key] ?? true}
                        onToggle={() =>
                          setFeatures((p) => ({ ...p, [key]: !p[key] }))
                        }
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {addonFeatures.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Add-On Features
                <span className="text-[10px] text-amber-600 dark:text-amber-400 normal-case font-normal ml-2">
                  Year 1 free · Year 2+ billed monthly if enabled
                </span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {addonFeatures.map(({ key, label, desc, icon: Icon, comingSoon }) => {
                  const featureExpiry =
                    addonExpiries[key] ?? getFeatureExpiry(key);
                  const expired = isExpired(featureExpiry);
                  const days = daysLeft(featureExpiry);
                  const enabled = features[key] ?? false;
                  return (
                    <div
                      key={key}
                      className={`flex items-start justify-between p-3 rounded-xl border transition-all ${comingSoon ? "border-border/50 bg-muted/20 opacity-60" : expired && !enabled ? "border-red-200/50 bg-red-50/30 dark:bg-red-950/10 opacity-70" : enabled ? "border-amber-400/30 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/50 bg-muted/20"}`}
                    >
                      <div className="flex items-start gap-2 min-w-0 mr-3">
                        <Icon
                          size={13}
                          className="text-muted-foreground shrink-0 mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {label}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {desc}
                          </p>
                          {comingSoon ? null : expired ? (
                            <p className="text-[10px] text-red-500 font-semibold mt-0.5">
                              ⚠ Expired — ₹10,000/yr to enable
                            </p>
                          ) : (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                              Free until{" "}
                              {featureExpiry.toLocaleDateString("en-IN")} (
                              {days}d)
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {comingSoon ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            Coming Soon
                          </span>
                        ) : (
                          <>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                              Add-On
                            </span>
                            <Toggle
                              on={enabled}
                              onToggle={() => {
                                const newVal = !enabled;
                                if (newVal && expired) {
                                  setPendingEnableKey(key);
                                  setConfirmDialog("enable_addon");
                                } else {
                                  setFeatures((p) => ({ ...p, [key]: newVal }));
                                }
                              }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </SectionCard>

        {/* ── Confirm Dialog ── */}
        {confirmDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-2xl overflow-hidden max-w-2xl w-full mx-4 shadow-2xl"
            >
              {confirmDialog === "upgrade" ? (
                <>
                  {/* Upgrade modal header */}
                  <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                    <div>
                      <h3 className="text-base font-bold">⚡ Upgrade to PRO</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Review your current plan and what you&apos;ll get after
                        upgrading
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmDialog(null)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 bg-muted/50 p-1 mx-6 mt-4 rounded-xl border border-border/50 w-fit">
                    {[
                      { key: "current" as const, label: "📋 Current (Basic)" },
                      {
                        key: "after" as const,
                        label: "⚡ After Upgrade (PRO)",
                      },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setUpgradeModalTab(tab.key)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${upgradeModalTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                    {upgradeModalTab === "current" ? (
                      <>
                        {/* Plan info */}
                        <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Plan Info
                          </p>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Plan</span>
                            <span className="font-semibold text-primary">
                              BASIC
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Activated
                            </span>
                            <span className="font-medium">14 Nov 2025</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Months used
                            </span>
                            <span className="font-medium">
                              {monthsUsed} months
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Months remaining
                            </span>
                            <span className="font-medium">
                              {monthsRemaining} months
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Monthly rate
                            </span>
                            <span className="font-medium">
                              ₹{PLAN_BASE.BASIC.baseRate} / ₹{PLAN_BASE.BASIC.marginalRate} (marginal)
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Storage
                            </span>
                            <span className="font-medium">500GB</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              AI Tokens
                            </span>
                            <span className="font-medium">10M/month</span>
                          </div>
                        </div>

                        {/* Default features */}
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Default Features (always on)
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {basicDefaults.map((f) => (
                              <div
                                key={f.key}
                                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40"
                              >
                                <f.icon
                                  size={12}
                                  className="text-muted-foreground shrink-0"
                                />
                                <span className="text-[11px] font-medium truncate">
                                  {f.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Add-on features — Basic add-ons with expiry */}
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Add-On Features
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 normal-case font-normal ml-2">
                              Free until{" "}
                              {basicExpiryDate.toLocaleDateString("en-IN")}
                            </span>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {basicAddons.map((f) => {
                              const expired = isExpired(basicExpiryDate);
                              const days = daysLeft(basicExpiryDate);
                              return (
                                <div
                                  key={f.key}
                                  className={`flex items-center gap-2 p-2 rounded-lg border ${expired ? "border-red-200/50 bg-red-50/30 dark:bg-red-950/10" : "border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10"}`}
                                >
                                  <f.icon
                                    size={12}
                                    className="text-muted-foreground shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium truncate">
                                      {f.label}
                                    </p>
                                    <p
                                      className={`text-[10px] ${expired ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}
                                    >
                                      {expired
                                        ? "⚠ Expired"
                                        : `${days}d remaining`}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Upgrade charge */}
                        <div className="bg-muted/40 rounded-xl p-4 space-y-2.5">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Upgrade Charge
                          </p>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">PRO upgrade charge</span>
                            <span className="font-bold text-[#DA7756]">{fmt(finalUpgradeCharge)}</span>
                          </div>
                          <div className="h-px bg-border/50 my-1" />
                          <div className="flex justify-between text-xs font-bold">
                            <span>Total due now</span>
                            <span className="text-[#DA7756]">{fmt(finalUpgradeCharge)}</span>
                          </div>
                        </div>
                        {/* Add-on — only smart_board */}
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Add-On Features
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {ALL_FEATURES.filter(
                              (f) => f.inPro && f.addOnPro,
                            ).map((f) => {
                              const exp = upgradeIsAfter12
                                ? new Date(
                                  new Date().setFullYear(
                                    new Date().getFullYear() + 1,
                                  ),
                                )
                                : basicExpiryDate;
                              const days = daysLeft(exp);
                              const expired = isExpired(exp);
                              return (
                                <div
                                  key={f.key}
                                  className={`flex items-center gap-2 p-2 rounded-lg border ${expired ? "border-red-200/50 bg-red-50/30 dark:bg-red-950/10" : "border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10"}`}
                                >
                                  <f.icon
                                    size={12}
                                    className="text-muted-foreground shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium truncate">
                                      {f.label}
                                    </p>
                                    <p
                                      className={`text-[10px] ${expired ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}
                                    >
                                      {expired
                                        ? "⚠ Expired"
                                        : `Free until ${exp.toLocaleDateString("en-IN")} (${days}d)`}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* Feature expiry info */}
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200/50 dark:border-amber-900/50">
                          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">
                            Feature Free Period
                          </p>
                          {!upgradeIsAfter12 ? (
                            <p className="text-[11px] text-amber-600 dark:text-amber-500">
                              All features (Basic + PRO) free until{" "}
                              <span className="font-semibold">
                                {basicExpiryDate.toLocaleDateString("en-IN")}
                              </span>{" "}
                              (original activation + 1 year)
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-600 dark:text-amber-500">
                              Basic add-ons expired. New PRO features free for 1
                              year from upgrade date.
                            </p>
                          )}
                        </div>

                        {/* Payment toggle */}
                        <div
                          className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${upgradePaid ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "border-border/50 bg-card"}`}
                        >
                          <div>
                            <p className="text-xs font-semibold">
                              Upgrade Payment Received
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Mark once upgrade charge of{" "}
                              {fmt(finalUpgradeCharge)} is confirmed
                            </p>
                          </div>
                          <Toggle
                            on={upgradePaid}
                            onToggle={() => setUpgradePaid((v) => !v)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                    <button
                      onClick={() => setConfirmDialog(null)}
                      className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                    >
                      Cancel
                    </button>
                    <div className="flex items-center gap-2">
                      {upgradeModalTab === "current" && (
                        <button
                          onClick={() => setUpgradeModalTab("after")}
                          className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                          style={{ background: "#7C3AED" }}
                        >
                          See After Upgrade →
                        </button>
                      )}
                      {upgradeModalTab === "after" && (
                        <button
                          disabled={!upgradePaid || upgradeLoading}
                          onClick={async () => {
                            setUpgradeLoading(true);
                            try {
                              await api.post(`/superadmin/institutions/${inst.id}/upgrade`);
                              await fetchPlanDashboard();
                              await fetchBills();
                              setPlan("PRO");
                              setFeatures(getDefaultFeatures("PRO"));
                              setUpgradeDate(new Date());
                              toast.success("Upgraded to PRO! Features updated.");
                              setConfirmDialog(null);
                              setUpgradePaid(false);
                            } catch (err: unknown) {
                              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Upgrade failed";
                              toast.error(msg);
                            } finally {
                              setUpgradeLoading(false);
                            }
                          }}
                          className="h-9 px-5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                          style={{
                            background:
                              "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                          }}
                        >
                          {upgradeLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                          Confirm Upgrade — {fmt(finalUpgradeCharge)}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : confirmDialog === "downgrade" ? (
                <>
                  <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                    <div>
                      <h3 className="text-base font-bold">⬇ Downgrade to Basic</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Review what changes when downgrading from PRO to Basic
                      </p>
                    </div>
                    <button onClick={() => setConfirmDialog(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* What you lose */}
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 border border-red-200/50 dark:border-red-900/50">
                      <p className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2">Features Disabled Immediately</p>
                      <div className="space-y-1.5">
                        {ALL_FEATURES.filter((f) => f.inPro && !f.inBasic).map((f) => (
                          <div key={f.key} className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                            <XCircle size={12} />
                            <span>{f.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Billing info */}
                    <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Billing Changes</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">New monthly rate</span>
                        <span className="font-bold">₹{PLAN_BASE.BASIC.baseRate}/user (+ ₹{PLAN_BASE.BASIC.marginalRate} beyond 1500)</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Effective from</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">Next billing cycle</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Refund</span>
                        <span className="font-semibold text-red-500">None</span>
                      </div>
                    </div>
                    {/* Warning box */}
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200/50 dark:border-amber-900/50">
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-1">Important</p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-500">
                        A notification email will be sent to the institution admin. Performance Insights and Timetable Auto-Scheduling addons will be deactivated.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                    <button
                      onClick={() => setConfirmDialog(null)}
                      className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={downgradeLoading}
                      onClick={async () => {
                        setDowngradeLoading(true);
                        try {
                          const res = await api.post(`/superadmin/institutions/${inst.id}/downgrade`);
                          const storageWarning = res.data?.data?.storageWarning;
                          await fetchPlanDashboard();
                          await fetchBills();
                          setPlan("BASIC");
                          setFeatures(getDefaultFeatures("BASIC"));
                          setUpgradeDate(null);
                          if (storageWarning) {
                            toast.warning("Downgraded to Basic. Storage exceeds 500GB limit — consider purchasing extra storage.", { duration: 6000 });
                          } else {
                            toast.success("Downgraded to Basic. Notification sent to admin.");
                          }
                          setConfirmDialog(null);
                        } catch (err: unknown) {
                          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Downgrade failed";
                          toast.error(msg);
                        } finally {
                          setDowngradeLoading(false);
                        }
                      }}
                      className="h-9 px-5 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {downgradeLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      Confirm Downgrade
                    </button>
                  </div>
                </>
              ) : confirmDialog === "enable_addon" && pendingEnableKey ? (
                <div className="p-6">
                  <h3 className="text-base font-bold mb-2">
                    🔓 Enable Add-On Feature?
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    <span className="font-semibold text-foreground">
                      {
                        ALL_FEATURES.find((f) => f.key === pendingEnableKey)
                          ?.label
                      }
                    </span>{" "}
                    free period has expired.
                  </p>
                  <div className="bg-muted/40 rounded-xl p-3 mb-4 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Annual charge
                      </span>
                      <span className="font-bold text-[#DA7756]">
                        ₹10,000/year
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">New expiry</span>
                      <span className="font-medium">
                        {new Date(
                          new Date().setFullYear(new Date().getFullYear() + 1),
                        ).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Added to this month&apos;s bill
                      </span>
                      <span className="font-bold">₹10,000</span>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setConfirmDialog(null);
                        setPendingEnableKey(null);
                      }}
                      className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!pendingEnableKey) return;
                        setFeatures((p) => ({
                          ...p,
                          [pendingEnableKey]: true,
                        }));
                        const newExpiry = new Date();
                        newExpiry.setFullYear(newExpiry.getFullYear() + 1);
                        setAddonExpiries((p) => ({
                          ...p,
                          [pendingEnableKey]: newExpiry,
                        }));
                        setAddonExtraBill((p) => p + 10000);
                        toast.success(
                          `Feature enabled — ₹10,000 added to this month's bill`,
                        );
                        setConfirmDialog(null);
                        setPendingEnableKey(null);
                      }}
                      className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                      style={{
                        background:
                          "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)",
                      }}
                    >
                      Yes, Enable & Add to Bill
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <h3 className="text-base font-bold mb-2">
                    ⚠️ Deactivate Plan?
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    This will permanently deactivate the plan. Institution will lose access immediately.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setConfirmDialog(null)}
                      className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setPlanActive(false);
                        toast.success("Plan deactivated");
                        setConfirmDialog(null);
                      }}
                      className="h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: "#ef4444" }}
                    >
                      Yes, Deactivate
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </motion.div>
    );
  }

  // ── TRIAL VIEW ──
  if (plan === "TRIAL") {
    const trialDays = inst.subscription?.trialDays ?? 14;
    const trialEndDate = trialUsage?.trialEndDate ? new Date(trialUsage.trialEndDate) : null;
    const daysRemaining = trialUsage?.daysRemaining ?? null;
    const trialExpired = daysRemaining !== null && daysRemaining <= 0;
    const trialStartDate = inst.subscription?.startDate ? new Date(inst.subscription.startDate) : null;

    const TrialPieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
      if (!active || !payload?.length) return null;
      const { name, value } = payload[0];
      const colorMap: Record<string, string> = {
        Admin: "#7C3AED",
        Teachers: "#F59E0B",
        Students: "#10B981",
      };
      return (
        <div
          className="px-3 py-2 rounded-xl shadow-xl"
          style={{ background: "#1A1030", border: "1px solid #2D1F50" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: colorMap[name] }}
            />
            <span style={{ color: "#F1F5F9", fontSize: 12, fontWeight: 600 }}>
              {name}
            </span>
          </div>
          <p
            style={{
              color: "#F1F5F9",
              fontSize: 13,
              fontWeight: 800,
              marginTop: 2,
            }}
          >
            {value}
          </p>
        </div>
      );
    };

    const TrialUsageBar = ({
      label,
      icon: Icon,
      used,
      total,
      unitLabel,
      formatter,
      pending,
      onAction,
      urgentWhenLow,
    }: {
      label: string;
      icon: React.ElementType;
      used: number;
      total: number;
      unitLabel: string;
      formatter?: (v: number) => string;
      pending?: boolean;
      onAction?: () => void;
      urgentWhenLow?: boolean;
    }) => {
      const f = formatter ?? ((v: number) => v.toLocaleString("en-IN"));
      const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
      // For "remaining"-style bars (e.g. days left) the bar depletes over time,
      // so a LOW fill is the urgent state; usage bars are the opposite.
      const danger = urgentWhenLow ? pct <= 20 : pct >= 90;
      const warn = urgentWhenLow ? pct <= 40 : pct >= 70;
      const barColor = danger ? "#ef4444" : warn ? "#f59e0b" : "linear-gradient(90deg,#7C3AED,#9D5AFF)";
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Icon size={13} className="text-muted-foreground" />
              <p className="text-xs font-medium">{label}</p>
              {onAction && (
                <button
                  onClick={onAction}
                  className="w-5 h-5 rounded-md flex items-center justify-center text-white shadow-sm hover:scale-105 active:scale-95 transition-all"
                  style={{ background: "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)" }}
                  title="View users"
                >
                  <ArrowUpRight size={11} />
                </button>
              )}
            </div>
            {pending ? (
              <span className="text-[10px] font-medium text-muted-foreground italic">Not tracked yet</span>
            ) : (
              <div className="flex items-center gap-2">
                <p className={`text-xs font-bold ${danger ? "text-red-500" : warn ? "text-amber-500" : "text-foreground"}`}>
                  {f(used)} {unitLabel}
                </p>
                <span className="text-[10px] text-muted-foreground">/ {f(total)} {unitLabel}</span>
              </div>
            )}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            {!pending && (
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
            )}
          </div>
        </div>
      );
    };

    // Active trial dashboard
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        {/* Hero card — mirrors active plan banner exactly */}
        <div className="bg-card border border-border/50 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${trialExpired ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
                <span className={`text-xs font-semibold ${trialExpired ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {trialExpired ? "Trial Expired" : "Trial Active"}
                </span>
              </div>
              <h2 className="text-2xl font-black" style={{ color: "#F59E0B" }}>
                TRIAL
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {instType} · Free trial · {trialDays} days total
              </p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {trialStartDate && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <CalendarIcon size={11} /> Started:{" "}
                    <span className="font-medium text-foreground ml-1">
                      {trialStartDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </span>
                )}
                {trialEndDate && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Flag size={11} className="text-amber-500" /> Ends:{" "}
                    <span className="font-medium text-amber-600 dark:text-amber-400 ml-1">
                      {trialEndDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => { setExtendOpen((v) => !v); setChurnOpen(false); setExtendDays(""); }}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400 hover:opacity-80 transition-all"
              >
                <CalendarIcon size={13} /> Extend
              </button>
              <button
                onClick={() => { setChurnOpen((v) => !v); setExtendOpen(false); setChurnConfirm(false); }}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-xs font-semibold hover:opacity-80 transition-all"
              >
                <XCircle size={13} /> Stop Early
              </button>
            </div>
          </div>

          {/* Users breakdown pie — same as BASIC/PRO active banner */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
            <div className="relative w-[90px] h-[90px] shrink-0" style={{ overflow: "visible" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Admin", value: 1 },
                      { name: "Teachers", value: inst.teacherCount ?? 0 },
                      { name: "Students", value: inst.studentCount ?? 0 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={42}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                    paddingAngle={3}
                    minAngle={8}
                  >
                    <Cell fill="#7C3AED" />
                    <Cell fill="#F59E0B" />
                    <Cell fill="#10B981" />
                  </Pie>
                  <Tooltip content={<TrialPieTooltip />} position={{ x: 95, y: 0 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-sm font-black leading-none">{activeUsers}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Total</p>
              </div>
            </div>
            <div className="space-y-2 shrink-0">
              {[
                { label: "Admin", value: 1, color: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
                { label: "Teachers", value: inst.teacherCount ?? 0, color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
                { label: "Students", value: inst.studentCount ?? 0, color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
              ].map(({ label, value, color, dot }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <div>
                    <p className={`text-sm font-black leading-none ${color}`}>{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/50">
            <InfoBox
              label="Days Left"
              value={daysRemaining !== null ? String(daysRemaining) : "—"}
              sub={`of ${trialDays} days`}
              highlight={daysRemaining !== null && daysRemaining <= 3}
            />
            <InfoBox
              label="Users"
              value={String(trialUsage?.users.used ?? 0)}
              sub={`/ ${trialUsage?.users.limit ?? 500} max`}
              onAction={() => router.push(`/superadmin/institutions/${inst.id}/users`)}
            />
            <InfoBox
              label="AI Tokens Used"
              value="—"
              sub="Not tracked yet"
            />
            <InfoBox
              label="Storage Used"
              value="—"
              sub="Not tracked yet"
            />
          </div>
        </div>

        {/* Extend panel — shown inline when extend is open */}
        {extendOpen && (
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <CalendarIcon size={13} />
                Extend Trial Period
              </span>
            }
          >
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Current end date:{" "}
                <span className="font-medium text-foreground">
                  {trialEndDate
                    ? trialEndDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—"}
                </span>
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  placeholder="Additional days (1–365)"
                  className="flex-1 h-10 rounded-xl border border-border/60 bg-muted/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  disabled={extending || !extendDays || Number(extendDays) < 1}
                  onClick={async () => {
                    const days = parseInt(extendDays, 10);
                    if (!days || days < 1 || days > 365) { toast.error("Enter a number between 1 and 365"); return; }
                    setExtending(true);
                    try {
                      const res = await api.post(`/superadmin/institutions/${inst.id}/trial/extend`, { extraDays: days });
                      const updatedSub = res.data?.data?.subscription ?? res.data?.data;
                      // Reflect the extended total + new end date on the parent's
                      // `inst` state right away — without this, `trialDays` (used
                      // as the meter's total) stayed stuck at the old value since
                      // only trialUsage (daysRemaining) was refetched, making the
                      // bar show e.g. "12/12" instead of "12/28" after extending.
                      onPatch?.({
                        subscription: {
                          ...inst.subscription,
                          trialDays: updatedSub?.trialDays ?? (trialDays + days),
                          endDate: updatedSub?.endDate ?? inst.subscription?.endDate,
                        },
                      });
                      toast.success(`Trial extended by ${days} days`);
                      setExtendOpen(false);
                      setExtendDays("");
                      void fetchTrialUsage();
                    } catch (err: unknown) {
                      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to extend trial";
                      toast.error(msg);
                    } finally {
                      setExtending(false);
                    }
                  }}
                  className="h-10 px-4 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  style={{ background: "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)" }}
                >
                  {extending && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Confirm Extension
                </button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Stop Trial Early — shown as SectionCard when open */}
        {churnOpen && (
          <SectionCard
            title={
              <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle size={13} />
                Stop Trial Early
              </span>
            }
            editBtn={
              <button
                onClick={() => { setChurnOpen(false); setChurnConfirm(false); }}
                className="h-7 px-3 rounded-lg border border-border/60 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition-all"
              >
                Cancel
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                    <XCircle size={14} className="text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">Churn Institution</p>
                </div>
                <p className="text-[11px] text-muted-foreground">End trial permanently. Institution will be locked and no longer accessible.</p>
                {!churnConfirm ? (
                  <button
                    onClick={() => setChurnConfirm(true)}
                    className="w-full py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-950/30 transition-all"
                  >
                    Mark as Churned
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-red-500 font-semibold">⚠️ This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setChurnConfirm(false)}
                        className="flex-1 py-1.5 rounded-lg border border-border/50 text-xs text-muted-foreground hover:bg-muted/30 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={churning}
                        onClick={async () => {
                          setChurning(true);
                          try {
                            await api.post(`/superadmin/institutions/${inst.id}/trial/churn`);
                            toast.success("Institution churned");
                            router.replace("/superadmin/institutions");
                          } catch (err: unknown) {
                            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to churn";
                            toast.error(msg);
                            setChurning(false);
                          }
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 transition-all flex items-center justify-center gap-1"
                      >
                        {churning && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Confirm Churn
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#DA7756]/20 bg-[#DA7756]/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#DA7756]/10 flex items-center justify-center">
                    <Zap size={14} className="text-[#DA7756]" />
                  </div>
                  <p className="text-sm font-semibold text-[#DA7756]">Activate Paid Plan</p>
                </div>
                <p className="text-[11px] text-muted-foreground">Convert to BASIC or PRO. Set up billing and activate the institution on a paid plan.</p>
                <button
                  onClick={() => { setPlan("BASIC"); setChurnOpen(false); setChurnConfirm(false); }}
                  className="w-full py-2 rounded-lg border border-[#DA7756]/30 text-[#DA7756] text-xs font-semibold hover:bg-[#DA7756]/10 transition-all flex items-center justify-center gap-1"
                >
                  Set Up BASIC / PRO →
                </button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Usage meters */}
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <BarChart2 size={13} />
              Usage Meters
            </span>
          }
        >
          {loadingTrialUsage ? (
            <div className="space-y-4 animate-pulse mt-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-3 w-16 bg-muted rounded" />
                  </div>
                  <div className="h-1.5 bg-muted rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5 mt-3">
              <TrialUsageBar
                label="Days Remaining"
                icon={CalendarIcon}
                // Numerator = remaining days (clamped to [0, total]); denominator is
                // always the full trial duration, so the format stays <remaining>/<total>.
                used={Math.max(0, Math.min(daysRemaining ?? 0, trialDays))}
                total={trialDays}
                unitLabel="days"
                urgentWhenLow
              />
              <TrialUsageBar
                label="Users"
                icon={Users}
                used={trialUsage?.users.used ?? 0}
                total={trialUsage?.users.limit ?? 500}
                unitLabel="users"
                onAction={() => router.push(`/superadmin/institutions/${inst.id}/users`)}
              />
              <TrialUsageBar
                label="AI Tokens"
                icon={Cpu}
                used={trialUsage?.aiTokens.used ?? 0}
                total={trialUsage?.aiTokens.limit ?? PLAN_BASE.TRIAL.aiTokens * 1_000_000}
                unitLabel="tokens"
                formatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v.toLocaleString("en-IN")}
                pending
              />
              <TrialUsageBar
                label="Storage"
                icon={HardDrive}
                used={trialUsage?.storageGb.used ?? 0}
                total={trialUsage?.storageGb.limit ?? 10}
                unitLabel="GB"
                formatter={(v) => v.toFixed(2)}
                pending
              />
            </div>
          )}
        </SectionCard>

        {/* Feature Controls — trial gets full PRO feature set, same UI as active PRO plan */}
        {(() => {
          const { defaults: allTrialDefFeatures, addons: allTrialAddonFeatures } = getPlanFeatures("PRO");
          // Whitelabelling is a paid-PRO-only perk — not included free during trial.
          const trialDefFeatures = allTrialDefFeatures.filter((f) => f.key !== "whitelabeling");
          const trialAddonFeatures = allTrialAddonFeatures.filter((f) => f.key !== "whitelabeling");
          return (
            <SectionCard title="Feature Controls">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Default Features
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 normal-case font-normal ml-2">
                  Included free during trial
                </span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
                {trialDefFeatures.map(({ key, label, desc, icon: Icon, comingSoon }) => (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${comingSoon ? "border-border/50 bg-muted/20 opacity-60" : features[key] ?? true ? "border-[#DA7756]/30 bg-[#DA7756]/5" : "border-border/50 bg-muted/20"}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 mr-3">
                      <Icon size={13} className="text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{label}</p>
                        <p className="text-[11px] text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {comingSoon ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Coming Soon
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            Default
                          </span>
                          <Toggle
                            on={features[key] ?? true}
                            onToggle={() => setFeatures((p) => ({ ...p, [key]: !(p[key] ?? true) }))}
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {trialAddonFeatures.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Add-On Features
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 normal-case font-normal ml-2">
                      Included free during trial
                    </span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {trialAddonFeatures.map(({ key, label, desc, icon: Icon }) => {
                      const enabled = features[key] ?? true;
                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${enabled ? "border-amber-400/30 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/50 bg-muted/20"}`}
                        >
                          <div className="flex items-center gap-2 min-w-0 mr-3">
                            <Icon size={13} className="text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{label}</p>
                              <p className="text-[11px] text-muted-foreground">{desc}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                              Add-On
                            </span>
                            <Toggle
                              on={enabled}
                              onToggle={() => setFeatures((p) => ({ ...p, [key]: !enabled }))}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </SectionCard>
          );
        })()}
      </motion.div>
    );
  }

  // ── SETUP VIEW ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Plan Not Activated
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-500/80">
            Configure below and activate to get started.
          </p>
        </div>
      </div>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <LayoutGrid size={15} />
            Select Plan
          </span>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLAN_OPTS.map((p) => {
            const isActive = plan === p.key;
            const price = p.key !== "TRIAL" ? pricing[p.key] : null;
            return (
              <button
                key={p.key}
                onClick={() => {
                  if (p.key === "TRIAL") {
                    setShowTrialConfirm(true);
                  } else {
                    setPlan(p.key);
                  }
                }}
                className={`flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all ${isActive ? p.border : "border-border/50 bg-muted/30 hover:border-border"}`}
              >
                <div className="flex items-center justify-between w-full">
                  <p
                    className={`text-sm font-bold ${isActive ? p.activeColor : "text-foreground"}`}
                  >
                    {p.label}
                  </p>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? "border-current" : "border-muted-foreground/40"}`}
                  >
                    {isActive && (
                      <div className={`w-2 h-2 rounded-full ${p.dot}`} />
                    )}
                  </div>
                </div>
                {price ? (
                  <p className="text-xs font-bold">
                    {fmt(price.licence)}{" "}
                    <span className="font-normal text-muted-foreground">
                      one-time
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Free — no charge
                  </p>
                )}
                {p.features.length > 0 && (
                  <div className="space-y-1.5 mt-1 pt-2 border-t border-border/40 w-full">
                    {p.features.map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <Icon
                          size={11}
                          className={`shrink-0 ${label.startsWith("No") ? "text-muted-foreground/50" : isActive ? "text-current" : "text-muted-foreground"}`}
                        />
                        <span
                          className={`text-[11px] ${label.startsWith("No") ? "text-muted-foreground/50" : ""}`}
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <IndianRupee size={15} />
            Monthly Billing
          </span>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border/40">
              <p className="text-xs font-semibold">Pricing Tiers — {plan}</p>
            </div>
            <div className="divide-y divide-border/30">
              {planPricing.tiers.map((tier, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="text-xs text-muted-foreground">
                    {tier.max === Infinity
                      ? `${tier.min}+ users`
                      : `${tier.min}–${tier.max} users`}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {fmt(tier.rate)}/user/mo
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoBox label="Min. Users" value="200" sub="minimum billed" />
            <InfoBox
              label="Base Rate"
              value={`${fmt(planPricing.tiers[0].rate)}/user`}
              sub="200–1499 users"
            />
            <InfoBox
              label="Min. First Bill"
              value={fmt(200 * planPricing.tiers[0].rate)}
              sub="minimum amount"
              highlight
            />
          </div>
          <p className="text-[11px] text-muted-foreground px-1">
            💡 Min. 200 users billed. Rate drops automatically as your
            institution grows.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <span
              onDoubleClick={() => setShowDiscount((v) => !v)}
              className="cursor-default select-none"
            >
              <Landmark
                size={15}
                className="text-muted-foreground/100 hover:text-muted-foreground/70 transition-colors"
              />
            </span>
            One-time Licence Fee
          </span>
        }
      >
        <div className="bg-muted/40 rounded-xl p-4">
          <p className="text-xs font-semibold">Licence Cost</p>
          <p className="text-xl font-black mt-0.5">{fmt(finalLicence)}</p>
          {showDiscount && (
            <div className="border-t border-border/50 pt-3 mt-3">
              <div className="flex items-center gap-3 mb-1">
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={discount}
                  onChange={(e) => {
                    setDiscount(Number(e.target.value));
                    setDiscountInput(e.target.value);
                  }}
                  className="flex-1 accent-[#DA7756] h-1.5 cursor-pointer"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={discountInput}
                    onChange={(e) => {
                      setDiscountInput(e.target.value);
                      setDiscount(
                        Math.min(
                          50,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      );
                    }}
                    className="w-14 h-7 px-2 text-center rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:border-[#DA7756]"
                  />
                  <span className="text-xs text-muted-foreground">% off</span>
                </div>
              </div>
              {discount > 0 && (
                <p className="text-[11px] text-[#DA7756] font-medium">
                  Saving {fmt(discountAmt)} · Final: {fmt(finalLicence)}
                </p>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={15} />
            Feature Controls
          </span>
        }
      >
        {(() => {
          const { defaults: defFeatures, addons: addonFeatures } =
            getPlanFeatures(plan);
          return (
            <>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Default Features
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 normal-case font-normal ml-2">
                  Year 1 — all enabled
                </span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
                {defFeatures.map(({ key, label, desc, icon: Icon, comingSoon }) => (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${comingSoon ? "border-border/50 bg-muted/20 opacity-60" : features[key] ? "border-[#DA7756]/30 bg-[#DA7756]/5" : "border-border/50 bg-muted/20"}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 mr-3">
                      <Icon
                        size={13}
                        className="text-muted-foreground shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {desc}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {comingSoon ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Coming Soon
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            Default
                          </span>
                          <Toggle
                            on={features[key] ?? true}
                            onToggle={() =>
                              setFeatures((p) => ({ ...p, [key]: !p[key] }))
                            }
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {addonFeatures.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Add-On Features
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 normal-case font-normal ml-2">
                      (Year 2 onwards — billed separately)
                    </span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {addonFeatures.map(({ key, label, desc, icon: Icon, comingSoon }) => (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${comingSoon ? "border-border/50 bg-muted/20 opacity-60" : features[key] ? "border-amber-400/30 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/50 bg-muted/20"}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 mr-3">
                          <Icon
                            size={13}
                            className="text-muted-foreground shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {label}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {desc}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {comingSoon ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              Coming Soon
                            </span>
                          ) : (
                          <>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            Add-On
                          </span>
                          <Toggle
                            on={features[key] ?? false}
                            onToggle={() =>
                              setFeatures((p) => ({ ...p, [key]: !p[key] }))
                            }
                          />
                          </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </SectionCard>

      {/* Plan Option — Normal vs Committed (pause/half-billing removed — only these two options exist) */}
      {(plan as string) !== "TRIAL" && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Plan Option</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["NORMAL", "COMMITTED"] as const).map((opt) => {
              const isSelected = planOption === opt;
              const isCommitted = opt === "COMMITTED";
              return (
                <button
                  key={opt}
                  onClick={() => setPlanOption(opt)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${isSelected ? (isCommitted ? "border-[#DA7756] bg-[#DA7756]/5" : "border-primary bg-primary/5") : "border-border/50 bg-card hover:border-border"}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className={`text-sm font-bold ${isSelected ? (isCommitted ? "text-[#DA7756]" : "text-primary") : "text-foreground"}`}>
                      {isCommitted ? "Committed" : "Normal"}
                    </p>
                    {isSelected && <div className={`w-2 h-2 rounded-full ${isCommitted ? "bg-[#DA7756]" : "bg-primary"}`} />}
                  </div>
                  {isCommitted ? (
                    <>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">15% off monthly bill</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Academic year commitment · No deactivate · Early-exit clawback applies</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] text-muted-foreground font-semibold">Full rate bill</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Deactivate blocks all access (data preserved) · Full monthly rate</p>
                    </>
                  )}
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
                    Effective: ₹{getEffectiveRate(activeUsers, planBase.baseRate, planBase.marginalRate, opt).toFixed(2)}/user
                    {activeUsers > 1500 ? ` · volume${isCommitted ? " + committed stacked" : " tier"}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`p-5 rounded-2xl border-2 transition-all mb-6 ${canActivate ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "border-border/50 bg-muted/20"}`}
      >
        <div className="mb-4">
          <div
            className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${licencePaid ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" : "border-border/50 bg-card"}`}
          >
            <div>
              <p className="text-xs font-semibold">
                Licence Payment Received
              </p>
              <p className="text-[11px] text-muted-foreground">
                Mark once one-time licence payment confirmed
              </p>
            </div>
            <Toggle
              on={licencePaid}
              onToggle={() => setLicencePaid((v) => !v)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">
              {canActivate
                ? "✅ Ready to Activate"
                : "⏳ Complete steps to activate"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {!licencePaid && (plan as string) !== "TRIAL"
                ? "Mark licence payment as received"
                : canActivate
                  ? (plan as string) === "TRIAL"
                    ? `14-day free trial · ${PLAN_BASE.TRIAL.aiTokens}M AI tokens`
                    : `${plan} · ${planOption} · ${fmt(monthlyBill)}/mo${planOption === "COMMITTED" ? ` (${Math.round(COMMITTED_DISCOUNT * 100)}% off)` : ""}`
                  : ""}
            </p>
          </div>
          <button
            onClick={handleActivate}
            disabled={!canActivate || activating}
            className="flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: canActivate
                ? "linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)"
                : "hsl(var(--muted))",
            }}
          >
            {activating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{" "}
                {savingAddons ? "Syncing add-ons..." : "Activating..."}
              </>
            ) : (
              <>
                <Zap size={15} /> Activate Plan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Trial start confirmation */}
      {showTrialConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl overflow-hidden max-w-md w-full mx-4 shadow-2xl"
          >
            <div className="p-6">
              <h3 className="text-base font-bold mb-2">
                🚀 Start Free Trial?
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                This will start a 14-day free trial for{" "}
                <span className="font-semibold text-foreground">{inst.name}</span>{" "}
                with {PLAN_BASE.TRIAL.aiTokens}M AI tokens and up to 500 users.
                You can extend or end the trial later.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowTrialConfirm(false)}
                  className="h-9 px-4 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setPlan("TRIAL");
                    setShowTrialConfirm(false);
                  }}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" }}
                >
                  <Zap size={13} /> Yes, Start Trial
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

export default function InstitutionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [institution, setInstitution] = useState<InstData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "plan">("details");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "plan") setActiveTab("plan");
    }
  }, []);

  const fetchInstitution = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get(`/superadmin/institutions/${id}`);
      const data: InstData = res.data.data;
      const admin = data.users?.find((u) => u.role === "ADMIN") ?? null;
      const teacherCount =
        data.users?.filter((u) => u.role === "TEACHER").length ?? 0;
      const studentCount =
        data.users?.filter((u) => u.role === "STUDENT").length ?? 0;
      setInstitution({ ...data, admin, teacherCount, studentCount });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInstitution();
  }, [fetchInstitution]);

  // Applied after a successful save in ViewDetailsTab so the parent's
  // `institution` state (the source of truth ViewDetailsTab re-derives its
  // local drafts from on every mount) reflects the change immediately —
  // without this, switching tabs and back remounts ViewDetailsTab with the
  // stale pre-save data, making a successful save look like it "reset".
  const handleInstitutionPatch = (patch: Omit<Partial<InstData>, "admin"> & { admin?: Partial<AdminUser> }) => {
    setInstitution((prev) => {
      if (!prev) return prev;
      const { admin: adminPatch, ...rest } = patch;
      const mergedAdmin = adminPatch ? (prev.admin ? { ...prev.admin, ...adminPatch } : prev.admin) : prev.admin;
      const mergedUsers = prev.users?.map((u) =>
        u.role === "ADMIN" && adminPatch ? { ...u, ...adminPatch } : u
      );
      return { ...prev, ...rest, admin: mergedAdmin, users: mergedUsers ?? prev.users };
    });
  };

  const handleStatusToggle = async () => {
    if (!institution) return;
    const newStatus = institution.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await api.patch(`/superadmin/institutions/${id}/status`, {
        status: newStatus,
      });
      setInstitution((prev) => (prev ? { ...prev, status: newStatus } : prev));
      toast.success(
        `Institution ${newStatus === "ACTIVE" ? "activated" : "suspended"}`,
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update status"));
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/superadmin/institutions/${id}`);
      toast.success("Institution permanently deleted");
      router.replace("/superadmin/institutions");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete institution"));
    }
  };

  const handleResendInvite = async () => {
    if (!institution) return;
    const adminEmail =
      institution.admin?.email ??
      institution.users?.find((u) => u.role === "ADMIN")?.email;
    try {
      await api.post(`/superadmin/institutions/${id}/resend-invite`, {
        email: adminEmail,
      });
      toast.success("Invite resent successfully");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to resend invite"));
    }
  };

  if (loading)
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-xl" />
        <div className="h-40 w-full bg-muted rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-48 bg-muted rounded-2xl" />
          <div className="h-48 bg-muted rounded-2xl" />
        </div>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 size={40} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Failed to load institution
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-xs text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );

  if (!institution)
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 size={40} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Institution not found
        </p>
      </div>
    );

  const TABS = [
    { key: "details" as const, label: "View Details" },
    { key: "plan" as const, label: "Manage Plan" },
  ];

  return (
    <div className="space-y-1.5 px-1">
      <div className="sticky top-0 z-20 bg-background pb-1">
        <div className="flex flex-wrap items-center gap-4 pt-1 pb-2">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{institution.name}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              Institutions <ChevronRight size={11} /> {institution.name}
            </p>
          </div>
          <div className="flex gap-1 bg-muted/50 rounded-4xl p-0.5 border border-border/50">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="relative"
                >
                  {isActive && (
                    <motion.div
                      layoutId="instDetailTab"
                      className="absolute inset-0 rounded-4xl bg-primary"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <div
                    className={`relative z-10 px-5 py-2 text-sm font-medium rounded-4xl transition-colors ${isActive ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {tab.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="h-px bg-border/60" />
      </div>
      <AnimatePresence mode="wait">
        {activeTab === "details" ? (
          <ViewDetailsTab
            key="details"
            inst={institution}
            onStatusToggle={handleStatusToggle}
            onResendInvite={handleResendInvite}
            onDelete={handleDelete}
            onInstitutionPatch={handleInstitutionPatch}
          />
        ) : (
          <ManagePlanTab key="plan" inst={institution} onPatch={handleInstitutionPatch} />
        )}
      </AnimatePresence>
      <div className="pb-6" />
    </div>
  );
}
