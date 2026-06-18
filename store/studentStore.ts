import { create } from 'zustand';

interface Guardian { name: string; number: string; relation: string; }

interface StudentState {
    // Student Info
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

    // Actions
    updateInfo: (data: Partial<StudentState>) => void;
}

export const useStudentStore = create<StudentState>((set) => ({
    name: 'Prajwal Jagdish Kotian',
    dob: '2001-05-31',
    email: 'prajwal.kotian@gmail.com',
    phone: '+91 98765 43210',
    gender: 'Male',
    nationality: 'Indian',
    admissionYear: '2022',
    religion: 'Hindu',
    category: 'General',

    bloodGroup: 'B+',
    aadharNo: '1234 5678 9012',
    panNo: 'ABCPK1234D',
    emergencyContact: '+91 98765 00003',

    address: 'Flat 12, Shanti Niwas, Sector 7, Andheri West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400058',
    country: 'India',

    guardians: [
        { name: 'Jagdish Kotian', number: '+91 98765 00001', relation: 'Father' },
        { name: 'Poornima Kotian', number: '+91 98765 00002', relation: 'Mother' },
    ],

    updateInfo: (data) => set((state) => ({ ...state, ...data })),
}));
