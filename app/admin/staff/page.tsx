'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

// Priority order mirrors the tab order in ./layout.tsx — first entry the
// sub-admin has permission for wins, so the section opens on a tab they can
// actually use instead of always landing on Teachers.
const STAFF_TABS_PRIORITY = [
    { href: '/admin/staff/teachers', permKey: 'STAFF_TEACHERS' },
    { href: '/admin/staff/subadmins', permKey: 'STAFF_SUBADMINS' },
    { href: '/admin/staff/staffroom', permKey: 'STAFF_STAFFROOM' },
];

export default function PeopleIndexPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    useEffect(() => {
        if (user?.role !== 'SUB_ADMIN') {
            router.replace('/admin/staff/teachers');
            return;
        }
        const permissions = user.permissions ?? [];
        const first = STAFF_TABS_PRIORITY.find(t => permissions.includes(t.permKey));
        router.replace(first ? first.href : '/admin/overview');
    }, [user, router]);

    return null;
}
