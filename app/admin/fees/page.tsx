import { redirect } from 'next/navigation';

export default function FeesHome() {
    redirect('/admin/fees/collect');
}
