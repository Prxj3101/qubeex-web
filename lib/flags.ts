export type CardType = 'yellow' | 'red';
export type Status = 'active' | 'resolved' | 'appealed';

export interface FlagItem {
    id: number;
    type: CardType;
    category: string;
    title: string;
    detail: string;
    date: string;
    subject?: string;
    reportedBy: string;
    role: string;
    status: Status;
    actionTaken?: string;
}

export const FLAGS: FlagItem[] = [
    {
        id: 1, type: 'yellow', category: 'Late Submission',
        title: 'Assignment submitted after deadline',
        detail: 'Operating Systems Assignment 3 was submitted 2 days after the deadline of 5th Feb without prior intimation or valid reason.',
        date: '7 Feb 2025, 10:15 AM', subject: 'Operating Systems', reportedBy: 'Prof. Rekha Nair', role: 'Faculty',
        status: 'active', actionTaken: 'Marks deducted — 20% penalty applied on assignment score.',
    },
    {
        id: 2, type: 'yellow', category: 'Classroom Misconduct',
        title: 'Disturbance during lecture',
        detail: 'Student was repeatedly talking and disturbing peers during the Data Structures lecture. Verbal warning was given twice before reporting.',
        date: '14 Jan 2025, 11:40 AM', subject: 'Data Structures', reportedBy: 'Prof. Amit Shah', role: 'Faculty',
        status: 'resolved', actionTaken: 'Verbal warning issued. Student was counselled by class mentor.',
    },
    {
        id: 3, type: 'yellow', category: 'Attendance Shortfall',
        title: 'Below 75% attendance warning',
        detail: 'Attendance in Computer Networks has fallen to 65%, which is below the mandatory 75% threshold.',
        date: '20 Feb 2025, 9:00 AM', subject: 'Computer Networks', reportedBy: 'Prof. Anita Roy', role: 'Faculty',
        status: 'active', actionTaken: 'Parents notified. Student must maintain 90%+ attendance hereafter.',
    },
    {
        id: 4, type: 'yellow', category: 'Dress Code Violation',
        title: 'Not in prescribed uniform',
        detail: 'Student arrived without college ID card and not in prescribed college uniform on a formal assessment day.',
        date: '3 Mar 2025, 8:30 AM', subject: undefined, reportedBy: 'Security Department', role: 'Admin',
        status: 'resolved', actionTaken: 'Warning noted in record. Student was allowed entry after parent confirmation.',
    },
    {
        id: 5, type: 'yellow', category: 'Lab Misconduct',
        title: 'Unauthorized software usage in lab',
        detail: 'During the DBMS lab session, student was found browsing social media and running unauthorized applications.',
        date: '11 Mar 2025, 2:20 PM', subject: 'DBMS Lab', reportedBy: 'Prof. Sunil Mehta', role: 'Faculty',
        status: 'active', actionTaken: 'Lab session marks withheld. Formal warning issued.',
    },
    {
        id: 6, type: 'red', category: 'Tab Switch Violation',
        title: 'Multiple tab switches during online test',
        detail: 'During Computer Networks Test 2, the system detected 3 tab switch attempts. First switch triggered a warning; subsequent switches resulted in automatic test submission.',
        date: '12 Mar 2025, 3:05 PM', subject: 'Computer Networks', reportedBy: 'Prof. Anita Roy', role: 'Faculty',
        status: 'active', actionTaken: 'Test marked as 0. Case escalated to HOD for review.',
    },
    {
        id: 7, type: 'red', category: 'Academic Dishonesty',
        title: 'Copying during mid-semester examination',
        detail: 'Student was caught referring to handwritten cheat notes concealed inside the hall ticket during the Mid-Semester Exam for Data Structures.',
        date: '25 Feb 2025, 10:50 AM', subject: 'Data Structures', reportedBy: 'Mr. Ramesh Shetty', role: 'Invigilator',
        status: 'appealed', actionTaken: 'Paper cancelled. Disciplinary committee hearing scheduled.',
    },
    {
        id: 8, type: 'red', category: 'Impersonation Attempt',
        title: 'Proxy attendance via friend',
        detail: 'A fellow student attempted to mark proxy attendance for this student during the morning session.',
        date: '8 Jan 2025, 9:15 AM', subject: undefined, reportedBy: 'HOD Office', role: 'Admin',
        status: 'resolved', actionTaken: 'Attendance marked absent. Both students issued red card warning.',
    },
    {
        id: 9, type: 'red', category: 'Screenshot Attempt',
        title: 'Attempted to screenshot exam questions',
        detail: 'During the DBMS online test, the system flagged a screen recording attempt.',
        date: '18 Feb 2025, 4:30 PM', subject: 'DBMS', reportedBy: 'Prof. Sunil Mehta', role: 'Faculty',
        status: 'active', actionTaken: 'Test invalidated. Student barred from makeup exam.',
    },
];
