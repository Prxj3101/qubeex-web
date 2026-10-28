import { create } from 'zustand';

// Counts shown on the "Parents" nav items. Filled by the role layouts (which poll
// the API) and read by the Parents pages for their tab badges.
interface ParentChatBadgeState {
    teacherUnread: number;
    adminReported: number;
    setTeacherUnread: (n: number) => void;
    setAdminReported: (n: number) => void;
}

export const useParentChatBadgeStore = create<ParentChatBadgeState>((set) => ({
    teacherUnread: 0,
    adminReported: 0,
    setTeacherUnread: (teacherUnread) => set({ teacherUnread }),
    setAdminReported: (adminReported) => set({ adminReported }),
}));
