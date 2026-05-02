# Trial Period Management — Frontend Design

**Date:** 2026-05-03
**Scope:** Frontend only (Next.js App Router, qubeex-web)
**Companion backend spec:** `backend/docs/superpowers/specs/2026-05-02-trial-period-management-design.md`

---

## Overview

When a superadmin creates a TRIAL institution, they are redirected directly to the institution's Manage Plan tab. That tab conditionally renders a `TrialManagementSection` component (instead of the existing plan setup / active plan UI) for all trial and post-trial states. Once a trial converts to a paid plan, the existing active plan UI takes over unchanged.

---

## 1. State Model

The Manage Plan tab renders based on `subscription.status` from the institution detail API:

| State | Condition | Rendered by |
|-------|-----------|-------------|
| Pending Trial | `institution.status = PENDING` + `subscription.status = TRIAL` | `TrialManagementSection` — View 1 |
| Active Trial | `institution.status = ACTIVE` + `subscription.status = TRIAL` | `TrialManagementSection` — View 2 |
| Trial Ended | `subscription.status = LOCKED` | `TrialManagementSection` — View 3 |
| Paid Plan | `subscription.status = ACTIVE` | Existing active plan UI (no changes) |

---

## 2. Post-Creation Redirect

**File:** `components/superadmin/CreateInstitutionModal.tsx`

After a successful institution creation:
- If the selected plan is `TRIAL` → call `router.push('/superadmin/institutions/${newInst.id}?tab=plan')`
- If the selected plan is `BASIC` or `PRO` → existing behaviour (close modal, refresh list)

Also fix the stale help text in this file: change `"1M AI tokens"` to `"2M AI tokens"` and `"5 GB storage"` to `"10 GB storage"` in the trial duration input helper text.

---

## 3. Backend API Verification

**File:** `app/superadmin/institutions/[id]/page.tsx`

Before implementation, verify that the `GET /superadmin/institutions/:id` response includes a `subscription` object with at minimum:

```ts
{
  status: "TRIAL" | "ACTIVE" | "LOCKED" | "PAUSED" | "EXPIRED",
  endDate: string | null,
  trialDays: number | null,
  trialOutcome: "EXTENDED" | "ACTIVATED" | "CHURNED" | null,
}
```

If `subscription` is missing from the response, add it to the backend `getInstitutionById` service (select the subscription relation). No frontend workaround.

Trial usage data is fetched separately by `TrialManagementSection` from:
```
GET /superadmin/institutions/:id/trial-usage
```
Response shape (already implemented in backend):
```ts
{
  users:        { used: number, limit: 500 },
  storageGb:    { used: number, limit: 10 },
  aiTokens:     { used: number, limit: 2_000_000 },
  daysRemaining: number | null,
  trialEndDate:  string | null,
  status:        string | null,
}
```

---

## 4. TrialManagementSection Component

**File:** `components/superadmin/TrialManagementSection.tsx`

### Props

```ts
interface TrialManagementSectionProps {
  institutionId: string;
  institutionName: string;
  institutionStatus: "PENDING" | "ACTIVE" | "SUSPENDED";
  subscription: {
    status: string;
    endDate: string | null;
    trialDays: number | null;
    trialOutcome: string | null;
  };
  onRefresh: () => void;      // re-fetches institution data in parent
  onSelectPlan: () => void;   // tells parent to show plan selection with TRIAL hidden
}
```

### View 1 — Pending Trial (`institutionStatus === "PENDING"`)

A single card with:
- Heading: "Trial Account Setup" with a purple TRIAL badge
- Info row: plan (Trial), duration (X days), calculated end date
- Limits row: 500 users · 2M AI tokens · 10 GB storage
- Single button: **"Activate Trial"** (orange gradient)
  - On click: calls `POST /superadmin/institutions/:id/activate-plan` (existing endpoint)
  - On success: calls `onRefresh()` — parent re-fetches, component re-renders into View 2
  - On error: shows inline error message

### View 2 — Active Trial (`subscription.status === "TRIAL"`)

**Header bar:**
- "Trial Active" badge (green with pulse dot) + trial end date on the right

**Usage cards (fetched from `getTrialUsage`, auto-refreshed every 60 seconds):**
Four cards in a responsive grid:
1. **Days Remaining** — large number, end date below, amber colour when ≤ 3 days
2. **Users** — `used / 500` with a progress bar (green → amber at 80% → red at 95%)
3. **AI Tokens** — `used / 2M` with a progress bar (same colour thresholds)
4. **Storage** — `used / 10 GB` with a progress bar (same colour thresholds)

**Extend Trial panel:**
- "Extend Trial" button (secondary/outlined) → expands inline below the usage cards
- Expanded state shows: number input (1–365 days, labelled "Additional days") + "Confirm Extension" button
- On confirm: calls `PATCH /superadmin/institutions/:id/extend-trial` with `{ extraDays: number }`
- On success: collapses panel, calls `onRefresh()`, re-fetches usage data
- On error: shows inline error

**Stop Trial Early:**
- "Stop Trial Early" button (outlined red) → replaces itself with a confirmation panel
- Confirmation panel shows two side-by-side option cards:
  - **Churn Institution** (red border): "End trial permanently. The institution will be locked." + "Yes, Churn" button
  - **Activate Plan** (orange border): "Convert to a paid plan now." + "Select Plan" button
- Either option has a "Cancel" link that returns to the normal View 2

**Churn flow:**
- Clicking "Yes, Churn" shows a confirmation dialog: "Are you sure? This cannot be undone."
- On confirm: calls `PATCH /superadmin/institutions/:id/churn` (existing `markTrialChurned` endpoint)
- On success: `router.push('/superadmin/institutions')` (back to list)

**Activate Plan flow:**
- Clicking "Select Plan" calls the `onSelectPlan()` prop (see Section 5), which tells the parent page to show the existing plan selection UI with `hideTrial = true`
- The parent renders a "← Back to Trial" link above the plan selector that resets this state and returns to `TrialManagementSection`

### View 3 — Trial Ended (`subscription.status === "LOCKED"`)

- Amber banner: lock icon + "Trial Ended" heading + the trial end date
- Body text: "This institution's trial has expired. Select a plan below to restore access."
- Calls `onSelectPlan()` automatically on mount (no back link — trial is over), causing the parent to show plan selection with `hideTrial = true`

---

## 5. Integration in Main Page

**File:** `app/superadmin/institutions/[id]/page.tsx`

Inside the Manage Plan tab render, add a `showPlanSelection` boolean state (default `false`) and a condition before the existing `planActive` check:

```tsx
const [showPlanSelection, setShowPlanSelection] = useState(false);
const isTrialLifecycle =
  subscription?.status === "TRIAL" || subscription?.status === "LOCKED";

{isTrialLifecycle && !showPlanSelection ? (
  <TrialManagementSection
    institutionId={id}
    institutionName={institution.name}
    institutionStatus={institution.status}
    subscription={subscription}
    onRefresh={fetchInstitution}
    onSelectPlan={() => setShowPlanSelection(true)}
  />
) : isTrialLifecycle && showPlanSelection ? (
  <>
    {/* "← Back to Trial" only shown when trial is still running (not LOCKED) */}
    {subscription?.status === "TRIAL" && (
      <button onClick={() => setShowPlanSelection(false)}>← Back to Trial</button>
    )}
    {/* existing plan selection UI with hideTrial=true */}
    {existingPlanSetupUI({ hideTrial: true })}
  </>
) : (
  // existing planActive / active plan UI — unchanged
)}
```

`hideTrial = true` means the TRIAL button is hidden from the 3-plan selector row. The existing plan setup UI accepts a `hideTrial` prop (a new boolean, default `false`, added to the inline plan selector — one conditional to hide the TRIAL button).

The existing `planActive` condition and all active plan UI (billing, addons, bills, etc.) remain completely untouched.

---

## 6. File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `components/superadmin/CreateInstitutionModal.tsx` | Add redirect after TRIAL creation; fix help text limits |
| Create | `components/superadmin/TrialManagementSection.tsx` | New component — all 3 trial views |
| Modify | `app/superadmin/institutions/[id]/page.tsx` | Add `isTrialState` condition in Manage Plan tab; pass `subscription` to TrialManagementSection |

Backend change (if needed):
| Modify | `backend/src/modules/superadmin/superadmin.service.ts` | Add `subscription` to `getInstitutionById` response if missing |

---

## 7. Design Constraints

- Match the existing dark theme exactly (`#0F0A1E` background, `#1A112E` cards, orange/purple gradients, white text)
- Do not redesign or reorganise any existing UI — only add the trial-specific path
- The TRIAL option in the plan selector (the 3-button row) must be hidden when rendering plan selection from the Activate Plan or Trial Ended flows
- No new routes, no new pages — everything lives within the existing `[id]` page and the new component

---

## Out of Scope

- Storage usage tracking (backend stub returns 0; UI shows 0/10 GB until tracking is built)
- AI token usage tracking (backend stub returns 0; UI shows 0/2M until Redis pool tracking is built)
- Push notification display in the UI
- Any changes to the institution list page cards
