@AGENTS.md

## Project
QubeEx — multi-tenant EdTech SaaS for student assessments. Frontend only in this repo; backend is a separate Node.js + Express + Prisma + PostgreSQL project.

## Roles
SUPER_ADMIN → ADMIN (per institution) → TEACHER → STUDENT

## Structure
- `app/` — Next.js App Router pages (superadmin/, admin/, teacher/, student/, login/, invite/)
- `components/` — role-specific (superadmin/, auth/) + shared/ + ui/ (shadcn)
- `lib/api.ts` — axios instance with JWT Bearer interceptor, auto-redirects to /login on 401
- `store/authStore.ts` — zustand auth store (persisted), holds user + token
- `types/index.ts` — all shared TypeScript types (Role, Institution, User, AuditLog, etc.)

## Conventions
- UI components: shadcn/ui only (`components/ui/`)
- Forms: react-hook-form + zod (`@hookform/resolvers/zod`)
- API calls: always via `lib/api.ts`, never raw fetch or axios import
- Notifications: sonner — `toast.success()` / `toast.error()`
- Animations: framer-motion
- Global state: zustand; local state: useState
- Styling: Tailwind 4 utility classes; theme-aware via `bg-background`, `text-foreground`, etc.

