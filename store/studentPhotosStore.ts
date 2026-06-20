import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StudentPhotosState {
    photos: Record<string, string>; // studentId → base64 photo
    setPhoto: (studentId: string, photo: string) => void;
}

export const useStudentPhotosStore = create<StudentPhotosState>()(
    persist(
        (set) => ({
            photos: {},
            setPhoto: (studentId, photo) =>
                set(state => ({ photos: { ...state.photos, [studentId]: photo } })),
        }),
        { name: 'student-photos-store' }
    )
);
