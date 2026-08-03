export type CardType = 'yellow' | 'red';
export type Severity = 'low' | 'medium' | 'high';
export type Status = 'open' | 'under_review' | 'resolved' | 'rejected' | 'appealed';

export interface FlagItem {
    id: string;
    studentId: string;
    studentName: string;
    divisionId: string | null;
    standardId: string | null;
    className?: string;
    type: CardType;
    severity: Severity;
    category: string;
    title: string;
    detail: string;
    date: string;
    subject?: string;
    reportedBy: string;
    role: string;
    status: Status;
    actionTaken?: string;
    attachmentUrl?: string;
    attachmentType?: string;
    attachmentName?: string;
    assignedToName?: string;
    reviewRemark?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    canReview: boolean;
}
