'use client';

import { CalendarClock, ClipboardCheck, MessageCircle } from 'lucide-react';
import { ParentsHub } from '@/components/parent-portal/ParentsHub';
import { FormsManager } from '@/components/parent-portal/FormsManager';
import { PtmManager } from '@/components/parent-portal/PtmManager';
import { useParentChatBadgeStore } from '@/store/parentChatBadgeStore';
import { ParentChatAdmin } from '@/components/parent-portal/ParentChatAdmin';

export default function AdminParentsPage() {
    const reported = useParentChatBadgeStore(s => s.adminReported);
    return (
        <div className="pt-4 h-full">
            <ParentsHub
                tabs={[
                    { key: 'chat', label: 'Chat', icon: MessageCircle, content: <ParentChatAdmin />, badge: reported },
                    { key: 'forms', label: 'Forms & polls', icon: ClipboardCheck, content: <FormsManager apiBase="/admin/parent-forms" canSendSchoolWide /> },
                    { key: 'meetings', label: 'Meetings', icon: CalendarClock, content: <PtmManager mode="admin" /> },
                ]}
            />
        </div>
    );
}
