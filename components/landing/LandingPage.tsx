'use client';

import { useEffect, useState } from 'react';
import LandingNav from './LandingNav';
import NotebookHero from './notebook/NotebookHero';
import BusRoute from './notebook/BusRoute';
import MeetJarvis from './notebook/MeetJarvis';
import ModulesGrid from './notebook/ModulesGrid';
// DayInSchool (notebook/DayInSchool.tsx) is parked.
import { paper } from './notebook/paper';
// Old Features section is parked: the bus route + MeetJarvis (#features) replace it.
// import Features from './Features';
import RolesBook from './notebook/RolesBook';
import PrivacyReportCard from './notebook/PrivacyReportCard';
import FAQPad from './notebook/FAQPad';
import BellFooter from './notebook/BellFooter';
// Old Modules / FAQ / CTAFooter are parked: replaced by the notebook versions above.
import Pricing from './Pricing';
// Testimonials hidden until real pilot-school quotes are available — see landing-data.ts
// import Testimonials from './Testimonials';
import DemoModal from './DemoModal';
import { SHOW_PRICING } from './landing-data';

export default function LandingPage() {
    const [demoOpen, setDemoOpen] = useState(false);
    const openDemo = () => setDemoOpen(true);

    // show the page scrollbar on the landing page only (hidden app-wide)
    useEffect(() => {
        document.documentElement.classList.add('landing-scrollbar');
        return () => document.documentElement.classList.remove('landing-scrollbar');
    }, []);

    return (
        <main className="min-h-screen bg-[#FCF8F5] text-[#190D2E] antialiased">
            <LandingNav onDemo={openDemo} />
            {/* one drawing-book sheet behind all of these, so there are no seams */}
            <div style={paper}>
                <NotebookHero onDemo={openDemo} />
                <BusRoute />
                <MeetJarvis />
                <ModulesGrid />
                <RolesBook />
                <PrivacyReportCard />
                {SHOW_PRICING && <Pricing onDemo={openDemo} />}
                <FAQPad />
                <BellFooter onDemo={openDemo} />
            </div>
            <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
        </main>
    );
}
