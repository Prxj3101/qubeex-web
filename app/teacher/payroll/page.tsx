import { redirect } from 'next/navigation';

// My Payroll now lives in Profile -> My Payroll. Old links keep working.
export default function TeacherPayrollRedirect() {
    redirect('/teacher/profile?tab=payroll');
}
