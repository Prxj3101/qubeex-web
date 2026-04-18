'use client';

import { Hammer } from 'lucide-react';

interface PhaseStubProps {
    phase: number;
    title: string;
    description?: string;
}

export function PhaseStub({ phase, title, description }: PhaseStubProps) {
    return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="text-center max-w-md">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
                    <Hammer size={24} className="text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-poppins)' }}>
                    {title}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {description ?? `This module arrives in Phase ${phase}.`}
                </p>
            </div>
        </div>
    );
}
