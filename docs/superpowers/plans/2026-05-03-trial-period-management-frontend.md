# Trial Period Management — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the trial period lifecycle into the superadmin UI — post-creation redirect, a dedicated TrialManagementSection component (3 views: pending / active / locked), and clean integration into the existing institution detail page.

**Architecture:** A new `TrialManagementSection` component handles all trial states. The existing `[id]/page.tsx` conditionally renders it instead of `ManagePlanTab` when the subscription is in a trial lifecycle state. A `showPlanSelection` boolean in the parent allows the trial component to hand off to the existing plan setup UI (BASIC/PRO only) after "Stop Trial Early → Activate Plan" or auto-expiry.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, Framer Motion, Lucide React, Sonner (toast), `@/lib/api` (axios wrapper)

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `components/superadmin/CreateInstitutionModal.tsx` | Add redirect after TRIAL creation; fix help text limits |
| Modify | `app/superadmin/institutions/[id]/page.tsx` | Expand `InstData` type; extract `fetchInstitution`; add `showPlanSelection` state; `hideTrial` prop on `ManagePlanTab`; conditional render |
| Create | `components/superadmin/TrialManagementSection.tsx` | All 3 trial views + `UsageCard` helper |

---

## Task 1: Fix CreateInstitutionModal — Redirect + Help Text

**Files:**
- Modify: `components/superadmin/CreateInstitutionModal.tsx`

- [ ] **Step 1: Add `useRouter` import**

Open `components/superadmin/CreateInstitutionModal.tsx`. Line 3 currently reads:
```tsx
import { useState, useRef } from 'react';
```
Change it to:
```tsx
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
```

- [ ] **Step 2: Instantiate the router inside the component**

The component function starts around line 22 (after the interfaces). Add `const router = useRouter();` as the first line inside the component body, before the existing `useState` calls.

- [ ] **Step 3: Add redirect logic in `handleCreate`**

Find the success block inside `handleCreate` (around lines 133–137):
```tsx
            const newInst: Institution = res.data.data;
            toast.success('Institution created! Invite email sent 🚀');
            onSuccess(newInst);
            onClose();
            resetForm();
```
Replace with:
```tsx
            const newInst: Institution = res.data.data;
            toast.success('Institution created! Invite email sent 🚀');
            if (form.plan === 'TRIAL') {
                router.push(`/superadmin/institutions/${newInst.id}?tab=plan`);
                onClose();
                resetForm();
            } else {
                onSuccess(newInst);
                onClose();
                resetForm();
            }
```

- [ ] **Step 4: Fix stale help text**

Find line 377:
```tsx
                                        Trial starts today · ends in {form.trialDays || '14'} days.
                                        Max 500 users, 5 GB storage, 1M AI tokens/month.
```
Change to:
```tsx
                                        Trial starts today · ends in {form.trialDays || '14'} days.
                                        Max 500 users, 10 GB storage, 2M AI tokens/month.
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /home/hacksmith010/Programming/qubeex/qubeex-web
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/superadmin/CreateInstitutionModal.tsx
git commit -m "feat: redirect to trial manage plan after TRIAL institution creation"
```

---

## Task 2: Expand InstData Type + Extract fetchInstitution + Add showPlanSelection

**Files:**
- Modify: `app/superadmin/institutions/[id]/page.tsx`

- [ ] **Step 1: Add `useCallback` to the React import**

Find the React import at line 3:
```tsx
import { useState, useEffect, useRef } from "react";
```
Change to:
```tsx
import { useState, useEffect, useRef, useCallback } from "react";
```

- [ ] **Step 2: Expand the `InstData` subscription type**

Find the `InstData` type definition (around line 48). The `subscription` field currently reads:
```tsx
  subscription?: {
    plan?: { name: string };
    status?: string;
    startDate?: string;
    endDate?: string;
  } | null;
```
Change it to:
```tsx
  subscription?: {
    plan?: { name: string };
    status?: string;
    startDate?: string;
    endDate?: string;
    trialDays?: number | null;
    trialOutcome?: string | null;
  } | null;
```

- [ ] **Step 3: Extract `fetchInstitution` and add `showPlanSelection` state**

Find the `InstitutionDetailPage` function body. The state declarations start around line 3313:
```tsx
  const [institution, setInstitution] = useState<InstData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "plan">("details");
```
Add `showPlanSelection` after these:
```tsx
  const [institution, setInstitution] = useState<InstData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "plan">("details");
  const [showPlanSelection, setShowPlanSelection] = useState(false);
```

Then find the existing `useEffect` that defines `const load` (around line 3326):
```tsx
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(false);
        const res = await api.get(`/superadmin/institutions/${id}`);
        // Enrich with role counts (same logic as list page)
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
    };
    load();
  }, [id]);
```
Replace with:
```tsx
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
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /home/hacksmith010/Programming/qubeex/qubeex-web
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/superadmin/institutions/\[id\]/page.tsx
git commit -m "refactor: expand InstData subscription type and extract fetchInstitution"
```

---

## Task 3: Create TrialManagementSection Component

**Files:**
- Create: `components/superadmin/TrialManagementSection.tsx`

- [ ] **Step 1: Create the file with the full component**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Clock, Users, Sparkles, HardDrive } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface TrialUsage {
  users: { used: number; limit: number };
  storageGb: { used: number; limit: number };
  aiTokens: { used: number; limit: number };
  daysRemaining: number | null;
  trialEndDate: string | null;
  status: string | null;
}

interface TrialManagementSectionProps {
  institutionId: string;
  institutionName: string;
  institutionStatus: string;
  subscription: {
    status: string;
    endDate: string | null;
    trialDays: number | null;
    trialOutcome: string | null;
  };
  onRefresh: () => void;
  onSelectPlan: () => void;
}

function UsageCard({
  icon: Icon,
  label,
  used,
  limit,
  loading,
  format,
}: {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number;
  loading: boolean;
  format?: (n: number) => string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const barColor =
    pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary";
  const textColor =
    pct >= 95
      ? "text-red-400"
      : pct >= 80
      ? "text-amber-400"
      : "text-foreground";
  const fmt = format ?? ((n: number) => `${n}`);

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className="text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={`text-lg font-bold ${textColor}`}>
        {loading ? "…" : fmt(used)}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        of {fmt(limit)}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function TrialManagementSection({
  institutionId,
  institutionName,
  institutionStatus,
  subscription,
  onRefresh,
  onSelectPlan,
}: TrialManagementSectionProps) {
  const router = useRouter();
  const [usage, setUsage] = useState<TrialUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState("");
  const [extending, setExtending] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [confirmChurn, setConfirmChurn] = useState(false);
  const [churning, setChurning] = useState(false);

  const fetchUsage = async () => {
    setUsageLoading(true);
    try {
      const res = await api.get(
        `/superadmin/institutions/${institutionId}/trial/usage`
      );
      setUsage(res.data.data);
    } catch {
      // non-blocking
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    if (subscription.status === "TRIAL" && institutionStatus === "ACTIVE") {
      fetchUsage();
      const interval = setInterval(fetchUsage, 60_000);
      return () => clearInterval(interval);
    }
    if (subscription.status === "LOCKED") {
      onSelectPlan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription.status, institutionStatus]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      await api.post(`/superadmin/institutions/${institutionId}/activate`);
      toast.success("Trial activated successfully");
      onRefresh();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? "Failed to activate trial"
      );
    } finally {
      setActivating(false);
    }
  };

  const handleExtend = async () => {
    const days = parseInt(extendDays, 10);
    if (!days || days < 1 || days > 365) {
      toast.error("Enter a number between 1 and 365");
      return;
    }
    setExtending(true);
    try {
      await api.post(
        `/superadmin/institutions/${institutionId}/trial/extend`,
        { extraDays: days }
      );
      toast.success(`Trial extended by ${days} days`);
      setExtendOpen(false);
      setExtendDays("");
      onRefresh();
      fetchUsage();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? "Failed to extend trial"
      );
    } finally {
      setExtending(false);
    }
  };

  const handleChurn = async () => {
    setChurning(true);
    try {
      await api.post(
        `/superadmin/institutions/${institutionId}/trial/churn`
      );
      toast.success("Institution churned");
      router.push("/superadmin/institutions");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? "Failed to churn institution"
      );
      setChurning(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  const trialEndFormatted = formatDate(subscription.endDate);

  // ── VIEW 3: LOCKED → auto-trigger plan selection ──
  if (subscription.status === "LOCKED") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 text-center gap-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Lock size={24} className="text-amber-500" />
        </div>
        <div>
          <p className="text-base font-semibold">Trial Ended</p>
          <p className="text-sm text-muted-foreground mt-1">
            Loading plan selection…
          </p>
        </div>
      </motion.div>
    );
  }

  // ── VIEW 1: PENDING ──
  if (institutionStatus === "PENDING") {
    const calculatedEndDate = subscription.endDate
      ? formatDate(subscription.endDate)
      : subscription.trialDays
      ? formatDate(
          new Date(
            Date.now() + subscription.trialDays * 86_400_000
          ).toISOString()
        )
      : "—";

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Trial Account Setup</h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              TRIAL
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="text-sm font-semibold mt-0.5">Trial</p>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-semibold mt-0.5">
                {subscription.trialDays ?? "—"} days
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
              <p className="text-xs text-muted-foreground">Trial ends</p>
              <p className="text-sm font-semibold mt-0.5">
                {calculatedEndDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border border-border/40">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users size={13} />
              <span>500 users</span>
            </div>
            <div className="w-px h-3 bg-border/60" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles size={13} />
              <span>2M AI tokens</span>
            </div>
            <div className="w-px h-3 bg-border/60" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HardDrive size={13} />
              <span>10 GB storage</span>
            </div>
          </div>

          <button
            onClick={handleActivate}
            disabled={activating}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-[#7C3AED] to-[#DA7756] hover:opacity-90 disabled:opacity-60 transition-all"
          >
            {activating ? "Activating…" : "Activate Trial"}
          </button>
        </div>
      </motion.div>
    );
  }

  // ── VIEW 2: ACTIVE TRIAL ──
  const daysRemaining = usage?.daysRemaining ?? null;
  const isDaysWarning = daysRemaining !== null && daysRemaining <= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-green-500/5 border border-green-500/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold text-green-400">
            Trial Active
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Ends {trialEndFormatted}
        </span>
      </div>

      {/* Usage Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className={`rounded-2xl border p-4 bg-card ${
            isDaysWarning
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-border/50"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Clock
              size={13}
              className={
                isDaysWarning ? "text-amber-400" : "text-muted-foreground"
              }
            />
            <p className="text-xs text-muted-foreground">Days Left</p>
          </div>
          <p
            className={`text-3xl font-bold ${
              isDaysWarning ? "text-amber-400" : "text-foreground"
            }`}
          >
            {usageLoading ? "…" : daysRemaining ?? "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {trialEndFormatted}
          </p>
        </div>

        <UsageCard
          icon={Users}
          label="Users"
          used={usage?.users.used ?? 0}
          limit={500}
          loading={usageLoading}
        />

        <UsageCard
          icon={Sparkles}
          label="AI Tokens"
          used={usage?.aiTokens.used ?? 0}
          limit={2_000_000}
          loading={usageLoading}
          format={(n) =>
            n >= 1_000_000
              ? `${(n / 1_000_000).toFixed(1)}M`
              : n >= 1000
              ? `${(n / 1000).toFixed(0)}K`
              : `${n}`
          }
        />

        <UsageCard
          icon={HardDrive}
          label="Storage"
          used={usage?.storageGb.used ?? 0}
          limit={10}
          loading={usageLoading}
          format={(n) => `${n} GB`}
        />
      </div>

      {/* Extend Trial */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Extend Trial</p>
          <button
            onClick={() => {
              setExtendOpen((v) => !v);
              setExtendDays("");
            }}
            className="text-xs text-primary hover:underline"
          >
            {extendOpen ? "Cancel" : "Extend"}
          </button>
        </div>
        {extendOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex gap-2"
          >
            <input
              type="number"
              min={1}
              max={365}
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
              placeholder="Additional days (1–365)"
              className="flex-1 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={handleExtend}
              disabled={extending || !extendDays}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#DA7756] hover:opacity-90 disabled:opacity-60 transition-all whitespace-nowrap"
            >
              {extending ? "Saving…" : "Confirm"}
            </button>
          </motion.div>
        )}
      </div>

      {/* Stop Trial Early */}
      {!stopOpen ? (
        <button
          onClick={() => setStopOpen(true)}
          className="w-full py-3 rounded-xl border border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/5 transition-all"
        >
          Stop Trial Early
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border/50 bg-card p-4 space-y-3"
        >
          <p className="text-sm font-semibold">What would you like to do?</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Churn */}
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-400">
                Churn Institution
              </p>
              <p className="text-xs text-muted-foreground">
                End trial permanently. The institution will be locked.
              </p>
              {!confirmChurn ? (
                <button
                  onClick={() => setConfirmChurn(true)}
                  className="w-full py-2 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-all"
                >
                  Yes, Churn
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-400 font-medium">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmChurn(false)}
                      className="flex-1 py-1.5 rounded-lg border border-border/50 text-xs text-muted-foreground hover:bg-muted/30 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleChurn}
                      disabled={churning}
                      className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
                    >
                      {churning ? "…" : "Confirm"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Activate Plan */}
            <div className="rounded-xl border border-[#DA7756]/30 bg-[#DA7756]/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-[#DA7756]">
                Activate Plan
              </p>
              <p className="text-xs text-muted-foreground">
                Convert to a paid plan now.
              </p>
              <button
                onClick={onSelectPlan}
                className="w-full py-2 rounded-lg border border-[#DA7756]/40 text-[#DA7756] text-xs font-semibold hover:bg-[#DA7756]/10 transition-all"
              >
                Select Plan
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              setStopOpen(false);
              setConfirmChurn(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Cancel
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /home/hacksmith010/Programming/qubeex/qubeex-web
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/superadmin/TrialManagementSection.tsx
git commit -m "feat: add TrialManagementSection — pending/active/locked trial views"
```

---

## Task 4: Wire TrialManagementSection into Institution Detail Page

**Files:**
- Modify: `app/superadmin/institutions/[id]/page.tsx`

- [ ] **Step 1: Import TrialManagementSection**

Find the import block at the top of the file (around lines 1–20). Add after the last import:
```tsx
import { TrialManagementSection } from "@/components/superadmin/TrialManagementSection";
```

- [ ] **Step 2: Add `hideTrial` prop to `ManagePlanTab`**

Find the `ManagePlanTab` function signature at line 973:
```tsx
function ManagePlanTab({ inst }: { inst: InstData }) {
```
Change to:
```tsx
function ManagePlanTab({ inst, hideTrial = false }: { inst: InstData; hideTrial?: boolean }) {
```

- [ ] **Step 3: Filter TRIAL from plan selector when hideTrial is true**

Inside `ManagePlanTab`, find the grid that maps `PLAN_OPTS` (around line 2975):
```tsx
        <div className="grid grid-cols-3 gap-3">
          {PLAN_OPTS.map((p) => {
```
Change to:
```tsx
        <div className="grid grid-cols-3 gap-3">
          {(hideTrial ? PLAN_OPTS.filter((p) => p.key !== "TRIAL") : PLAN_OPTS).map((p) => {
```

- [ ] **Step 4: Replace the tab render with the conditional**

Find the `AnimatePresence` block at line 3464:
```tsx
      <AnimatePresence mode="wait">
        {activeTab === "details" ? (
          <ViewDetailsTab
            key="details"
            inst={institution}
            onStatusToggle={handleStatusToggle}
            onResendInvite={handleResendInvite}
          />
        ) : (
          <ManagePlanTab key="plan" inst={institution} />
        )}
      </AnimatePresence>
```
Replace with:
```tsx
      <AnimatePresence mode="wait">
        {activeTab === "details" ? (
          <ViewDetailsTab
            key="details"
            inst={institution}
            onStatusToggle={handleStatusToggle}
            onResendInvite={handleResendInvite}
          />
        ) : (() => {
          const isTrialLifecycle =
            institution.subscription?.status === "TRIAL" ||
            institution.subscription?.status === "LOCKED";

          if (isTrialLifecycle && !showPlanSelection) {
            return (
              <TrialManagementSection
                key="trial"
                institutionId={institution.id}
                institutionName={institution.name}
                institutionStatus={institution.status as "PENDING" | "ACTIVE" | "SUSPENDED"}
                subscription={{
                  status: institution.subscription?.status ?? "",
                  endDate: institution.subscription?.endDate ?? null,
                  trialDays: institution.subscription?.trialDays ?? null,
                  trialOutcome: institution.subscription?.trialOutcome ?? null,
                }}
                onRefresh={fetchInstitution}
                onSelectPlan={() => setShowPlanSelection(true)}
              />
            );
          }

          if (isTrialLifecycle && showPlanSelection) {
            return (
              <motion.div
                key="plan-select"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {institution.subscription?.status === "TRIAL" && (
                  <button
                    onClick={() => setShowPlanSelection(false)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft size={14} /> Back to Trial
                  </button>
                )}
                <ManagePlanTab key="plan" inst={institution} hideTrial />
              </motion.div>
            );
          }

          return <ManagePlanTab key="plan" inst={institution} />;
        })()}
      </AnimatePresence>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /home/hacksmith010/Programming/qubeex/qubeex-web
npx tsc --noEmit
```
Expected: no errors. If there are errors related to `ArrowLeft` not found, check the existing imports — it is already imported as `ArrowLeft` at line 8. If `motion` is not imported, it is already imported from `framer-motion`.

- [ ] **Step 6: Start the dev server and manually test**

```bash
cd /home/hacksmith010/Programming/qubeex/qubeex-web
npm run dev
```

Open `http://localhost:3000/superadmin/institutions` and test:
1. Create a TRIAL institution → should redirect to `[id]?tab=plan` → should show View 1 (Trial Account Setup card with Activate Trial button)
2. Navigate to an existing TRIAL institution with status ACTIVE → should show View 2 (usage dashboard, Extend Trial, Stop Trial Early)
3. Click "Stop Trial Early" → should show the two-option panel (Churn / Activate Plan)
4. Click "Activate Plan" → "Select Plan" → should show plan selector with only BASIC and PRO (no TRIAL button), and a "← Back to Trial" link

- [ ] **Step 7: Commit**

```bash
git add app/superadmin/institutions/\[id\]/page.tsx
git commit -m "feat: wire TrialManagementSection into institution detail manage plan tab"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|-----------------|------|
| Post-creation redirect for TRIAL | Task 1 |
| Help text fix (2M tokens, 10 GB) | Task 1 |
| View 1: pending trial activation card | Task 3 |
| View 2: active trial usage dashboard | Task 3 |
| View 2: extend trial with day input | Task 3 |
| View 2: stop trial early → churn/activate options | Task 3 |
| View 3: locked → auto-trigger plan selection | Task 3 |
| TRIAL option hidden in plan selector when coming from trial | Task 4 |
| "← Back to Trial" link when plan is still TRIAL | Task 4 |
| `fetchInstitution` exposed for onRefresh | Task 2 |
| `subscription.trialDays` / `trialOutcome` in InstData type | Task 2 |

All spec requirements covered. ✓
