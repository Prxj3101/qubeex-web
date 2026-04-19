import type { InstitutionType } from '@/types';

export interface InstitutionAccent {
    bg: string;
    bgDark: string;
    emoji: string;
    label: string;
}

export function getInstitutionAccent(type: InstitutionType): InstitutionAccent {
    switch (type) {
        case 'SCHOOL':
            return { bg: '#7C3AED', bgDark: '#4C1D95', emoji: '🏫', label: 'School' };
        case 'COLLEGE':
            return { bg: '#059669', bgDark: '#064E3B', emoji: '🎓', label: 'College' };
        case 'COACHING':
            return { bg: '#D97706', bgDark: '#78350F', emoji: '📚', label: 'Coaching' };
    }
}

export function getFourthStatLabel(type: InstitutionType): string {
    switch (type) {
        case 'SCHOOL': return 'Classes';
        case 'COLLEGE': return 'Courses';
        case 'COACHING': return 'Batches';
    }
}

export function getStructureLabels(type: InstitutionType) {
    switch (type) {
        case 'SCHOOL':
            return { l1: 'Standard', l2: 'Subject', l3: 'Division', l1Plural: 'Standards', l2Plural: 'Subjects', l3Plural: 'Divisions' };
        case 'COLLEGE':
            return { l1: 'Course', l2: 'Stream', l3: 'Division', l1Plural: 'Courses', l2Plural: 'Streams', l3Plural: 'Divisions' };
        case 'COACHING':
            return { l1: 'Course', l2: 'Subject', l3: 'Batch', l1Plural: 'Courses', l2Plural: 'Subjects', l3Plural: 'Batches' };
    }
}
