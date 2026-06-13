import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import LandingPage from '@/components/landing/LandingPage';

const display = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-display' });

export const metadata: Metadata = {
    title: 'QubeEx — AI-Powered Student Assessment System',
    description: 'QubeEx brings attendance, assessments, fees and AI-driven insights into one calm platform — built for schools, colleges and coaching institutes.',
};

export default function RootPage() {
    return (
        <div className={display.variable}>
            <LandingPage />
        </div>
    );
}
