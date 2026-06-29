import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

interface Guardian { name: string; number: string; relation: string; }

interface StudentState {
    // Read-only academic (from API)
    studentId: string;
    rollNo: string;
    standard: string;
    division: string;
    divisionId: string;
    houseColor: string;
    institutionName: string;
    tempPassword: string | null;
    mustChangePassword: boolean;

    // Photo (server URL preferred; falls back to local for upload preview)
    photo: string | null;

    // Personal info
    name: string;
    dob: string;
    email: string;
    phone: string;
    gender: string;
    nationality: string;
    admissionYear: string;
    religion: string;
    category: string;

    // Medical
    bloodGroup: string;
    aadharNo: string;
    panNo: string;
    emergencyContact: string;

    // Address
    address: string;
    city: string;
    state: string;
    pincode: string;
    country: string;

    // Guardians
    guardians: Guardian[];

    // UI state
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    // Actions
    fetchProfile: () => Promise<void>;
    saveProfile: (patch: Partial<Omit<StudentState, 'fetchProfile' | 'saveProfile' | 'uploadPhoto' | 'updateInfo' | 'isLoading' | 'isSaving' | 'error' | 'studentId' | 'rollNo' | 'standard' | 'division' | 'houseColor' | 'institutionName' | 'tempPassword' | 'mustChangePassword'>>) => Promise<void>;
    uploadPhoto: (file: File) => Promise<void>;
    updateInfo: (data: Partial<StudentState>) => void;
}

export const useStudentStore = create<StudentState>()(persist((set, get) => ({
    studentId: '',
    rollNo: '',
    standard: '',
    division: '',
    divisionId: '',
    houseColor: '',
    institutionName: '',
    tempPassword: null,
    mustChangePassword: false,

    photo: null,

    name: '',
    dob: '',
    email: '',
    phone: '',
    gender: '',
    nationality: '',
    admissionYear: '',
    religion: '',
    category: '',

    bloodGroup: '',
    aadharNo: '',
    panNo: '',
    emergencyContact: '',

    address: '',
    city: '',
    state: '',
    pincode: '',
    country: '',

    guardians: [],

    isLoading: false,
    isSaving: false,
    error: null,

    fetchProfile: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await api.get('/student/me');
            const s = res.data.data;
            const guardians = Array.isArray(s.guardians) ? s.guardians : [];
            set({
                studentId: s.studentId ?? '',
                rollNo: s.rollNo ?? '',
                standard: s.standard?.name ?? '',
                division: s.division?.name ?? '',
                divisionId: s.division?.id ?? '',
                houseColor: s.houseColor ?? '',
                institutionName: s.institution?.name ?? '',
                tempPassword: s.tempPassword ?? null,
                mustChangePassword: s.user?.mustChangePassword ?? false,
                photo: s.avatarUrl ?? null,
                name: s.user?.name ?? '',
                email: s.user?.email ?? '',
                dob: s.dob ?? '',
                phone: s.phone ?? '',
                gender: s.gender ?? '',
                nationality: s.nationality ?? '',
                admissionYear: s.admissionYear ?? '',
                religion: s.religion ?? '',
                category: s.category ?? '',
                bloodGroup: s.bloodGroup ?? '',
                aadharNo: s.aadharNo ?? '',
                panNo: s.panNo ?? '',
                emergencyContact: s.emergencyContact ?? '',
                address: s.address ?? '',
                city: s.city ?? '',
                state: s.state ?? '',
                pincode: s.pincode ?? '',
                country: s.country ?? '',
                guardians,
                isLoading: false,
            });
        } catch {
            set({ isLoading: false, error: 'Failed to load profile' });
        }
    },

    saveProfile: async (patch) => {
        set({ isSaving: true, error: null });
        try {
            await api.patch('/student/profile', patch);
            await get().fetchProfile();
        } catch {
            set({ isSaving: false, error: 'Failed to save profile' });
            throw new Error('Failed to save profile');
        }
        set({ isSaving: false });
    },

    uploadPhoto: async (file: File) => {
        set({ isSaving: true, error: null });
        try {
            const form = new FormData();
            form.append('photo', file);
            const res = await api.post('/student/photo', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            set({ photo: res.data.data.avatarUrl, isSaving: false });
        } catch {
            set({ isSaving: false, error: 'Failed to upload photo' });
            throw new Error('Failed to upload photo');
        }
    },

    updateInfo: (data) => set((state) => ({ ...state, ...data })),
}), {
    name: 'student-store',
    partialize: () => ({}),
}));
