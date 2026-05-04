import { create } from 'zustand';

interface DivisionState {
    passedOutDivisions: string[]; // division IDs jo passout ho gayi
    promotedDivisions: string[];  // division IDs jo promote ho gayi
    markPassedOut: (divisionId: string) => void;
    markPromoted: (divisionId: string) => void;
    isPassedOut: (divisionId: string) => boolean;
    isPromoted: (divisionId: string) => boolean;
}

export const useClassStore = create<DivisionState>((set, get) => ({
    passedOutDivisions: [],
    promotedDivisions: [],

    markPassedOut: (divisionId) => {
        set(state => ({
            passedOutDivisions: [...state.passedOutDivisions, divisionId]
        }));
    },

    markPromoted: (divisionId) => {
        set(state => ({
            promotedDivisions: [...state.promotedDivisions, divisionId]
        }));
    },

    isPassedOut: (divisionId) => {
        return get().passedOutDivisions.includes(divisionId);
    },

    isPromoted: (divisionId) => {
        return get().promotedDivisions.includes(divisionId);
    },
}));