import { redirect } from 'next/navigation';

export default function SystemPage() {
    redirect('/superadmin/system/health');
}