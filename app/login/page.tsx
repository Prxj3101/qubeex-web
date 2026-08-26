import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';

// Public auth page — no institution is logged in yet here, so this must
// always show QubeEx's own title/icon, never a stale white-label cookie
// left over from a previous session on this browser. Overrides the root
// layout's dynamic (cookie-driven) metadata for this specific route.
export const metadata: Metadata = {
    title: 'QubeEx',
    icons: { icon: '/QubeEx_darkmode_DA7756.png' },
};

export default function LoginPage() {
    return <LoginForm />;
}