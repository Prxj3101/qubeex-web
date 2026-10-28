import { redirect } from 'next/navigation';

export default function Page() {
    redirect('/admin/insights/parents?tab=meetings');
}
