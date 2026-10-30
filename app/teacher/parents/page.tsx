'use client';

import { CalendarClock, ClipboardCheck, MessageCircle } from 'lucide-react';
import { ParentsHub } from '@/components/parent-portal/ParentsHub';
import { FormsManager } from '@/components/parent-portal/FormsManager';
import { PtmManager } from '@/components/parent-portal/PtmManager';
import { useParentChatBadgeStore } from '@/store/parentChatBadgeStore';
import { TeacherMessages } from '../messages/TeacherMessages';

export default function TeacherParentsPage() {
    const unread = useParentChatBadgeStore(s => s.teacherUnread);
    return (
        <ParentsHub
            tabs={[
                { key: 'messages', label: 'Messages', icon: MessageCircle, content: <TeacherMessages />, badge: unread },
                { key: 'forms', label: 'Forms & polls', icon: ClipboardCheck, content: <FormsManager apiBase="/teacher/parent-forms" canSendSchoolWide={false} /> },
                { key: 'meetings', label: 'Meetings', icon: CalendarClock, content: <PtmManager mode="teacher" /> },
            ]}
        />
    );
}
