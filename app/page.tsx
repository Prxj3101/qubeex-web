import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import LandingPage from '@/components/landing/LandingPage';

const display = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-display' });

export const metadata: Metadata = {
    title: 'QubeEx — AI-Powered Student Assessment System',
    description: 'QubeEx brings attendance, assessments, fees and AI-driven insights into one calm platform — built for schools, colleges and coaching institutes.',
    // Public marketing page — always QubeEx's own icon, regardless of any
    // institution branding cookie left over from a previous logged-in
    // session on this browser. Overrides the root layout's dynamic icon.
    icons: { icon: '/QubeEx_darkmode_DA7756.png' },
};

export default function RootPage() {
    return (
        <div className={display.variable}>
            <LandingPage />
        </div>
    );
}
