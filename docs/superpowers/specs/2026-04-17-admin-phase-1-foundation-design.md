# Admin Phase 1 — Foundation (Design)

**Date:** 2026-04-17
**Scope:** Institution Admin module, Phase 1 of 5
**Dependencies:** Existing `/invite/accept`, `/login`, `lib/api.ts`, `store/authStore.ts`, `components/shared/Topbar.tsx`

---

## 1. Phase Decomposition (context)

The full Admin spec (16 sections) is split into 5 phases. This doc covers only Phase 1. Later phases get their own specs.

| Phase | Scope |
|---|---|
| **1. Foundation** *(this doc)* | Admin layout shell, nav, Overview dashboard, Settings, Suspended page, protected-route guard |
| 2. Institution Structure | Variant-aware module: School (standards/subjects/divisions), College (courses/streams/divisions), Coaching (courses/subjects/batches) |
| 3. People & Classes | Teachers, Students (read-only from Admin side — teachers create students in their classes), Class/Division/Batch, teacher assignment, join codes |
| 4. Growth & Ops | Analytics/reports, Plan & feature management, Notifications (inbox + compose) |
| 5. Support & Trail | Tickets (create + thread), Audit logs |

---

## 2. Goals

- Stand up the Admin shell mirroring the SuperAdmin visual language so downstream phases slot into a consistent chrome.
- Give an admin landing on `/admin/overview` immediate visibility into institution health (users, plan usage, recent activity, notifications).
- Enforce that a suspended institution's admin is logged out and blocked from re-entry on the client side.
- Keep `/admin/settings` reachable but out of the primary nav (consistent with SuperAdmin).

Out of scope for Phase 1: wiring any dashboard data to real endpoints beyond what already exists, editing plan/features from settings, notifications compose, tickets.

---

## 3. Navigation Structure

Grouped pill topbar (consistent with SuperAdmin `Topbar`). Primary tabs:

| Tab | Route | Sub-pages (added in later phases) |
|---|---|---|
| Overview | `/admin/overview` | — |
| Structure | `/admin/structure` | variant-aware (Phase 2) |
| People | `/admin/people/teachers` | Teachers · Students · Classes & Batches (Phase 3) |
| Insights | `/admin/insights/analytics` | Analytics · Plan & Features (Phase 4) |
| Support | `/admin/support/notifications` | Notifications · Tickets (Phase 5) |
| Audit Logs | `/admin/audit-logs` | — |

**Settings** — not in primary nav. Reachable via avatar dropdown (to be added to `Topbar`). Route: `/admin/settings`.

For Phase 1, Overview and Settings render real content; all other tabs route to a placeholder page (`"Coming in Phase N"`) so the nav is complete and navigable.

**SuperAdmin consistency fix:** The avatar-dropdown pattern is added to the shared `Topbar`. SuperAdmin gets the same dropdown so `/superadmin/settings` (already built, currently orphan) becomes reachable too.

---

## 4. Theming by Institution Type

Per-institution accent color drives the dashboard hero (and is available for Phase-2 variant branding).

| Type | Accent (light) | Accent (dark) | Emoji |
|---|---|---|---|
| SCHOOL | `#7C3AED` violet | `#4C1D95` | 🏫 |
| COLLEGE | `#059669` emerald | `#064E3B` | 🎓 |
| COACHING | `#D97706` amber | `#78350F` | 📚 |

Exposed as a helper `getInstitutionAccent(type)` returning `{ bg, bgDark, emoji, label }`. Used by hero and (in later phases) variant-specific UI.

---

## 5. Pages

### 5.1 `app/admin/layout.tsx`

Structure mirrors `app/superadmin/layout.tsx`:

```
<div className="flex flex-col h-screen bg-background px-0 pt-3 gap-3">
  <Topbar navItems={ADMIN_NAV_ITEMS} />
  <main className="flex-1 overflow-y-auto px-2">{children}</main>
</div>
```

**Route guard (client-side):** Two-layer check.

1. **Layout mount (role check):** On mount of `app/admin/layout.tsx`, read `useAuthStore().user`. If missing or `user.role !== 'ADMIN'` → `router.replace('/login')`. Runs synchronously, no network call.
2. **Suspension check (reactive to API):** The existing axios interceptor in `lib/api.ts` is extended — on any `403` response with a body `{ code: 'INSTITUTION_SUSPENDED' }` (or equivalent convention — confirm with backend), clear auth store and `router.replace('/suspended')`. The interceptor fires from any admin route's first data fetch, so no extra work needed in individual pages. `GET /admin/overview` is the earliest trigger after login; if the institution is suspended it responds 403 and the interceptor takes over.

Backend still blocks API calls with 401/403; the client guard is defense-in-depth + UX.

### 5.2 `app/admin/overview/page.tsx`

**Data source (Phase 1):** Single `GET /admin/overview` endpoint assumed. If backend isn't ready, the page falls back to a shaped mock constant `MOCK_OVERVIEW` exported from the file with a `// TODO: wire to API` marker. This keeps Phase 1 unblocked.

Response shape (shared via `types/index.ts` in a new `AdminOverview` type):

```ts
interface AdminOverview {
  institution: {
    id: string;
    name: string;
    type: InstitutionType;
    status: InstitutionStatus;
    logoUrl?: string;
  };
  stats: {
    totalUsers: number;
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;    // label adapts to institution type
  };
  enrollmentGrowth: { month: string; students: number; teachers: number }[];
  plan: {
    name: string;            // e.g. 'Pro'
    usage: {
      users: { used: number; limit: number };
      storage: { used: number; limit: number };  // in MB
      tests:   { used: number; limit: number };
    };
  };
  recentActivity: { id: string; dot: string; text: string; time: string }[];
  notifications: { id: string; title: string; body: string; time: string }[];
}
```

**Layout:**

1. **Hero** — same dimensions as SuperAdmin hero (`rounded-b-[65px]`, orbs, stars, greeting + date left, SVG right). Accent color from `getInstitutionAccent(institution.type)`. Greeting uses admin's display name; subtitle shows institution name.
2. **Stat cards (4)** — Total users / Students / Teachers / Classes|Courses|Batches. The 4th label maps to institution type:
   - SCHOOL → "Classes"
   - COLLEGE → "Courses"
   - COACHING → "Batches"
3. **Mid row (2-col + 1-col):**
   - **Left (lg:col-span-2):** Enrollment growth `BarChart` (6 months, `students` vs `teachers` — teachers uses `hsl(var(--border))`, students uses accent).
   - **Right (1 col):** **Plan usage card** — `plan.name` heading; 3 progress bars (users, storage, tests) each showing `used/limit`; "Request upgrade" link (routes to `/admin/insights/plan` — Phase 4 placeholder in Phase 1).
4. **Bottom row (single column stacked):**
   - **Recent activity** — last 5 events with colored dot + text + time (same style as SuperAdmin Recent audit logs).
   - **Notifications preview** — last 3 items (title + one-line body + time), "View all →" links to `/admin/support/notifications`.

### 5.3 `app/admin/settings/page.tsx`

Two cards:

**Institution details** (editable, PATCH `/admin/institution`):
- Name (text)
- Logo (upload — shadcn file input; preview round 64px)
- Contact email (text)
- Phone (text)

Form uses `react-hook-form` + `zod` (name required, email format, phone optional).
Success → `toast.success('Institution updated')`, refresh form defaults from response.
**Type is shown as read-only** (admin cannot change institution type).

**Account:**
- Admin email (read-only)
- "Change password" link → opens a modal with current + new + confirm password (zod same rules as invite accept)
- Theme toggle (reuse `ThemeToggle`)
- Logout button → `authStore.logout()` + `router.push('/login')`

### 5.4 `app/suspended/page.tsx`

Standalone page (not wrapped in admin layout). Centered card:

- Icon (`ShieldAlert` or similar), red tint
- Heading: "Institution suspended"
- Body: "Your institution's access has been suspended. Please contact your super admin."
- Buttons: *Logout* (primary), *Contact support* (secondary, `mailto:` link — address from an env var `NEXT_PUBLIC_SUPPORT_EMAIL` with a reasonable fallback).

### 5.5 Placeholder pages (Phase 2-5 stubs)

For each nav route not yet implemented:
- `/admin/structure`
- `/admin/people/teachers` (+ a default redirect from `/admin/people`)
- `/admin/insights/analytics` (+ default redirect from `/admin/insights`)
- `/admin/support/notifications` (+ default redirect from `/admin/support`)
- `/admin/audit-logs`

Shared `<PhaseStub phase={2} title="Institution Structure" />` component renders a muted card: icon, title, "This module arrives in Phase N."

---

## 6. Shared Component Changes

### 6.1 `components/shared/Topbar.tsx`

- **Dead code removal:** Delete unreachable `useState`/`useRef`/`handleHover` after the early return in `RoleBadge` (lines 83-94).
- **Avatar dropdown:** Wrap the avatar with a shadcn `DropdownMenu`. Items: "Settings" (role-aware href: `/admin/settings` vs `/superadmin/settings`), "Logout".

### 6.2 `types/index.ts`

Add:
- `AdminOverview` (see 5.2)
- `Plan` type (`{ id: string; name: 'BASIC' | 'PRO'; limits: {...} }`) — minimal for Phase 1; fleshed out in Phase 4.
- Extend `Institution` with `logoUrl?: string`, `phone?: string` (phone already present).

### 6.3 `lib/getInstitutionAccent.ts`

New helper:

```ts
export function getInstitutionAccent(type: InstitutionType) {
  switch (type) {
    case 'SCHOOL':   return { bg: '#7C3AED', bgDark: '#4C1D95', emoji: '🏫', label: 'School' };
    case 'COLLEGE':  return { bg: '#059669', bgDark: '#064E3B', emoji: '🎓', label: 'College' };
    case 'COACHING': return { bg: '#D97706', bgDark: '#78350F', emoji: '📚', label: 'Coaching' };
  }
}
```

---

## 7. API Assumptions

Endpoints used in Phase 1 (all scoped to the authenticated admin's institution):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/overview` | Dashboard bundle (see 5.2) |
| `PATCH` | `/admin/institution` | Update institution name/logo/email/phone |
| `POST` | `/admin/institution/logo` | Logo upload (multipart) — if backend prefers separate endpoint |
| `POST` | `/auth/change-password` | Change password |

If any endpoint is not yet available, page falls back to a clearly-marked mock and renders without crashing. No endpoint creation happens in this repo (frontend only).

---

## 8. File Layout

New files:

```
app/
  admin/
    layout.tsx
    overview/page.tsx
    settings/page.tsx
    structure/page.tsx              (stub)
    people/
      page.tsx                      (redirect → /admin/people/teachers)
      teachers/page.tsx             (stub)
    insights/
      page.tsx                      (redirect → /admin/insights/analytics)
      analytics/page.tsx            (stub)
    support/
      page.tsx                      (redirect → /admin/support/notifications)
      notifications/page.tsx        (stub)
    audit-logs/page.tsx             (stub)
  suspended/page.tsx

components/
  admin/
    OverviewHero.tsx
    StatCards.tsx
    EnrollmentGrowthChart.tsx
    PlanUsageCard.tsx
    RecentActivityCard.tsx
    NotificationsPreviewCard.tsx
    InstitutionDetailsForm.tsx
    AccountCard.tsx
    ChangePasswordModal.tsx
    PhaseStub.tsx

lib/
  getInstitutionAccent.ts
```

Modified files:

- `components/shared/Topbar.tsx` — dead code removal + avatar dropdown.
- `types/index.ts` — new types.

---

## 9. Testing / Verification

Frontend-only repo, no unit tests currently. Manual verification for Phase 1:

1. Visit `/login`, log in as an ADMIN user → redirected to `/admin/overview`.
2. Nav tabs render in grouped form; clicking each lands on the correct page (stubs OK for later phases).
3. Hero accent color matches institution type.
4. Stat cards render with the correct 4th-label ("Classes" / "Courses" / "Batches").
5. Plan usage bars show correct `used/limit` percentages.
6. Avatar dropdown shows Settings + Logout; clicking Settings lands on `/admin/settings`.
7. On `/admin/settings`, edit institution name → toast success → value persists on refresh.
8. Change-password modal validates, submits, toasts success.
9. Trigger suspension (manually flip `status` in mock or have backend do it) → on next navigation, user is kicked to `/suspended`.
10. Theme toggle works on both overview and settings.
11. Dead code in `Topbar.tsx` is gone; SuperAdmin still works identically.

---

## 10. Open Questions / Risks

- **Logo upload transport:** single PATCH with multipart vs separate POST. Defer to backend convention; both are cheap to wire.
- **"Recent activity" data source:** for Phase 1, we assume `/admin/overview` bundles it. If backend splits it into `/admin/audit-logs?limit=5`, swap the source; no UI change.
- **Suspension detection:** depends on backend returning status in `/admin/overview` or 403 on all admin routes. Either works; guard handles both.
- **Institution type change:** Phase-1 scope locks type as read-only in settings. If product later wants migration between types, that's its own epic.
