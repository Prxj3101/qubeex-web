'use client';

import { useState } from 'react';
import LandingNav from './LandingNav';
import Hero from './Hero';
import VelocityMarquee from './VelocityMarquee';
import Features from './Features';
import Modules from './Modules';
import Pricing from './Pricing';
import Testimonials from './Testimonials';
import FAQ from './FAQ';
import CTAFooter from './CTAFooter';
import DemoModal from './DemoModal';

export default function LandingPage() {
    const [demoOpen, setDemoOpen] = useState(false);
    const openDemo = () => setDemoOpen(true);

    return (
        <main className="min-h-screen bg-[#FBFAFF] text-[#190D2E] antialiased">
            <LandingNav onDemo={openDemo} />
            <Hero onDemo={openDemo} />
            <VelocityMarquee />
            <Features />
            <Modules />
            <Pricing onDemo={openDemo} />
            <Testimonials />
            <FAQ />
            <CTAFooter onDemo={openDemo} />
            <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
        </main>
    );
}
