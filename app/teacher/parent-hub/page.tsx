import { redirect } from 'next/navigation';

export default function Page() {
    redirect('/teacher/parents?tab=forms');
}
